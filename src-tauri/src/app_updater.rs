use chrono::Datelike;
use serde::{Deserialize, Serialize};
use std::time::Duration;
use tauri::{ipc::Channel, AppHandle, Runtime, Url};
use tauri_plugin_updater::UpdaterExt;
mod timeout;
use timeout::timeout_updater_check;

const ALPHA_METADATA_ASSET_NAME: &str = "alpha-latest.json";
const GITHUB_RELEASES_API_URL: &str =
    "https://api.github.com/repos/refactoringhq/tolaria/releases?per_page=100";
const RELEASES_BASE_URL: &str = "https://refactoringhq.github.io/tolaria";
const POISONED_STABLE_RECOVERY_FLOOR: &str = "2026.8.19";
const UPDATER_HTTP_TIMEOUT: Duration = Duration::from_secs(5);
const UPDATER_USER_AGENT: &str = concat!("Tolaria/", env!("CARGO_PKG_VERSION"));

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppUpdateMetadata {
    pub current_version: String,
    pub version: String,
    pub date: Option<String>,
    pub body: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(tag = "event", content = "data")]
pub enum AppUpdateDownloadEvent {
    #[serde(rename_all = "camelCase")]
    Started {
        content_length: Option<u64>,
    },
    #[serde(rename_all = "camelCase")]
    Progress {
        chunk_length: usize,
    },
    Finished,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum ReleaseChannel {
    Alpha,
    Stable,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
struct AlphaReleaseVersion {
    year: i32,
    month: u32,
    day: u32,
    sequence: u32,
}

#[derive(Debug, Clone, Deserialize)]
struct GitHubRelease {
    tag_name: String,
    draft: bool,
    published_at: chrono::DateTime<chrono::Utc>,
    assets: Vec<GitHubAsset>,
}

#[derive(Debug, Clone, Deserialize)]
struct GitHubAsset {
    name: String,
    browser_download_url: String,
}

impl ReleaseChannel {
    fn from_settings_value(value: Option<&str>) -> Self {
        match crate::settings::effective_release_channel(value) {
            "alpha" => Self::Alpha,
            _ => Self::Stable,
        }
    }

    fn as_str(self) -> &'static str {
        match self {
            Self::Alpha => "alpha",
            Self::Stable => "stable",
        }
    }

    fn updater_endpoint(self) -> Result<Url, String> {
        let endpoint = format!("{}/{}/latest.json", RELEASES_BASE_URL, self.as_str());
        Url::parse(&endpoint).map_err(|e| format!("Invalid updater endpoint: {e}"))
    }
}

impl AlphaReleaseVersion {
    fn parse_tag(tag_name: &str) -> Option<Self> {
        let release = tag_name.strip_prefix("alpha-v")?;
        let (date, sequence) = release.split_once("-alpha.")?;
        let sequence = sequence.parse().ok()?;
        let (year, month, day) = parse_calendar_date(date)?;
        chrono::NaiveDate::from_ymd_opt(year, month, day)?;

        Some(Self {
            year,
            month,
            day,
            sequence,
        })
    }
}

fn parse_calendar_date(value: &str) -> Option<(i32, u32, u32)> {
    let mut parts = value.split('.');
    let year = parts.next()?.parse().ok()?;
    let month = parts.next()?.parse().ok()?;
    let day = parts.next()?.parse().ok()?;
    if parts.next().is_some() {
        return None;
    }

    Some((year, month, day))
}

fn calendar_version_date(version: &str) -> Option<chrono::NaiveDate> {
    let core = version.split_once('-').map_or(version, |(value, _)| value);
    let (year, month, day) = parse_calendar_date(core)?;
    chrono::NaiveDate::from_ymd_opt(year, month, day)
}

fn should_recover_poisoned_calendar_version(
    current_version: &str,
    remote_version: &str,
    today: chrono::NaiveDate,
) -> bool {
    let Some(current_date) = calendar_version_date(current_version) else {
        return false;
    };
    let Some(remote_date) = calendar_version_date(remote_version) else {
        return false;
    };
    let tomorrow = today.succ_opt().unwrap_or(today);
    let recovery_floor = calendar_version_date(POISONED_STABLE_RECOVERY_FLOOR)
        .expect("the stable recovery floor must be a valid calendar version");
    let stable_recovery =
        current_date.year() == 2027 && remote_date.year() == 2026 && remote_date >= recovery_floor;

    (stable_recovery || (current_date > tomorrow && remote_date >= today))
        && remote_date <= tomorrow
}

fn should_install_update(
    current_version: &str,
    remote_version: &str,
    remote_is_semver_newer: bool,
    today: chrono::NaiveDate,
) -> bool {
    remote_is_semver_newer
        || should_recover_poisoned_calendar_version(current_version, remote_version, today)
}

fn latest_alpha_release_metadata_url(releases: &[GitHubRelease]) -> Option<Url> {
    releases
        .iter()
        .filter(|release| !release.draft)
        .filter_map(alpha_release_metadata_candidate)
        .max_by_key(|(_, published_at, _)| *published_at)
        .map(|(_, _, url)| url)
}

fn alpha_release_metadata_candidate(
    release: &GitHubRelease,
) -> Option<(AlphaReleaseVersion, chrono::DateTime<chrono::Utc>, Url)> {
    let version = AlphaReleaseVersion::parse_tag(&release.tag_name)?;
    let asset = release
        .assets
        .iter()
        .find(|asset| asset.name == ALPHA_METADATA_ASSET_NAME)?;
    let url = Url::parse(&asset.browser_download_url).ok()?;

    Some((version, release.published_at, url))
}

async fn alpha_release_metadata_endpoint() -> Result<Url, String> {
    let client = reqwest::Client::builder()
        .timeout(UPDATER_HTTP_TIMEOUT)
        .user_agent(UPDATER_USER_AGENT)
        .build()
        .map_err(|e| format!("Failed to create updater metadata client: {e}"))?;

    let releases = client
        .get(GITHUB_RELEASES_API_URL)
        .header(reqwest::header::ACCEPT, "application/vnd.github+json")
        .send()
        .await
        .map_err(|e| format!("Failed to fetch GitHub releases: {e}"))?
        .error_for_status()
        .map_err(|e| format!("GitHub releases request failed: {e}"))?
        .json::<Vec<GitHubRelease>>()
        .await
        .map_err(|e| format!("Failed to parse GitHub releases: {e}"))?;

    latest_alpha_release_metadata_url(&releases)
        .ok_or_else(|| "No alpha updater metadata asset found in GitHub releases".to_string())
}

async fn updater_endpoint(release_channel: ReleaseChannel) -> Result<Url, String> {
    match release_channel {
        ReleaseChannel::Stable => release_channel.updater_endpoint(),
        ReleaseChannel::Alpha => alpha_release_metadata_endpoint()
            .await
            .or_else(|_| release_channel.updater_endpoint()),
    }
}

fn build_updater<R: Runtime>(
    app_handle: &AppHandle<R>,
    endpoint: Url,
) -> Result<tauri_plugin_updater::Updater, String> {
    app_handle
        .updater_builder()
        .version_comparator(|current, release| {
            let remote_is_semver_newer = release.version > current;
            should_install_update(
                &current.to_string(),
                &release.version.to_string(),
                remote_is_semver_newer,
                chrono::Utc::now().date_naive(),
            )
        })
        .endpoints(vec![endpoint])
        .map_err(|e| format!("Failed to configure updater endpoint: {e}"))?
        .build()
        .map_err(|e| format!("Failed to build updater: {e}"))
}

fn to_update_metadata(update: tauri_plugin_updater::Update) -> AppUpdateMetadata {
    AppUpdateMetadata {
        current_version: update.current_version,
        version: update.version,
        date: update.date.map(|value| value.to_string()),
        body: update.body,
    }
}

fn ensure_expected_update_version(
    update: &tauri_plugin_updater::Update,
    expected_version: &str,
) -> Result<(), String> {
    if update.version == expected_version {
        return Ok(());
    }

    Err(format!(
        "Expected update version {}, found {}",
        expected_version, update.version
    ))
}

async fn install_update(
    update: tauri_plugin_updater::Update,
    on_event: Channel<AppUpdateDownloadEvent>,
) -> Result<(), String> {
    let mut started = false;
    update
        .download_and_install(
            |chunk_length, content_length| {
                if !started {
                    started = true;
                    let _ = on_event.send(AppUpdateDownloadEvent::Started { content_length });
                }

                let _ = on_event.send(AppUpdateDownloadEvent::Progress { chunk_length });
            },
            || {
                let _ = on_event.send(AppUpdateDownloadEvent::Finished);
            },
        )
        .await
        .map_err(|e| format!("Failed to download and install update: {e}"))
}

async fn refreshed_update(
    updater: tauri_plugin_updater::Updater,
    expected_version: &str,
) -> Result<tauri_plugin_updater::Update, String> {
    let update = timeout_updater_check(|| updater.check(), UPDATER_HTTP_TIMEOUT)
        .await
        .map_err(|_| "Update check timed out".to_string())?
        .map_err(|e| format!("Failed to refresh update metadata: {e}"))?
        .ok_or_else(|| "No update is currently available".to_string())?;

    ensure_expected_update_version(&update, expected_version)?;
    Ok(update)
}

pub async fn check_for_app_update<R: Runtime>(
    app_handle: AppHandle<R>,
    release_channel: Option<String>,
) -> Result<Option<AppUpdateMetadata>, String> {
    timeout_updater_check(
        || async {
            let channel = ReleaseChannel::from_settings_value(release_channel.as_deref());
            let updater = build_updater(&app_handle, updater_endpoint(channel).await?)?;
            let update = updater
                .check()
                .await
                .map_err(|e| format!("Failed to check for updates: {e}"))?;

            Ok(update.map(to_update_metadata))
        },
        UPDATER_HTTP_TIMEOUT,
    )
    .await
    .map_err(|_| "Update check timed out".to_string())?
}

pub async fn download_and_install_app_update<R: Runtime>(
    app_handle: AppHandle<R>,
    release_channel: Option<String>,
    expected_version: String,
    on_event: Channel<AppUpdateDownloadEvent>,
) -> Result<(), String> {
    let channel = ReleaseChannel::from_settings_value(release_channel.as_deref());
    let updater = build_updater(&app_handle, updater_endpoint(channel).await?)?;
    let update = refreshed_update(updater, &expected_version).await?;

    install_update(update, on_event).await
}

#[cfg(test)]
#[path = "app_updater/tests.rs"]
mod tests;
