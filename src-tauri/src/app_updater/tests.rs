use super::{
    build_updater, build_updater_with_timeout, latest_alpha_release_metadata_url,
    requires_package_manager_update, should_install_update,
    should_recover_poisoned_calendar_version, AppUpdateDownloadEvent, AppUpdateMetadata,
    GitHubAsset, GitHubRelease, ReleaseChannel, UPDATER_HTTP_TIMEOUT,
};
use serde_json::json;
use std::{
    io::{Read, Write},
    net::TcpListener,
    thread,
    time::{Duration, Instant},
};

fn delayed_response_server(
    delay: Duration,
    accept_timeout: Duration,
) -> (String, thread::JoinHandle<Result<(), String>>) {
    let listener = TcpListener::bind("127.0.0.1:0").unwrap();
    listener.set_nonblocking(true).unwrap();
    let endpoint = format!("http://{}/latest.json", listener.local_addr().unwrap())
        .parse()
        .unwrap();
    let server = thread::spawn(move || {
        let mut connection = accept_updater_request(&listener, accept_timeout)?;
        connection
            .set_read_timeout(Some(Duration::from_secs(1)))
            .map_err(|error| format!("failed to set request read timeout: {error}"))?;
        connection
            .set_write_timeout(Some(Duration::from_secs(1)))
            .map_err(|error| format!("failed to set response write timeout: {error}"))?;
        let mut request = [0; 1024];
        connection
            .read(&mut request)
            .map_err(|error| format!("failed to read updater request: {error}"))?;
        thread::sleep(delay.min(Duration::from_secs(10)));
        let _ = connection.write_all(
            b"HTTP/1.1 204 No Content\r\nContent-Length: 0\r\nConnection: close\r\n\r\n",
        );
        Ok(())
    });

    (endpoint, server)
}

fn accept_updater_request(
    listener: &TcpListener,
    timeout: Duration,
) -> Result<std::net::TcpStream, String> {
    let deadline = Instant::now() + timeout;
    loop {
        if Instant::now() >= deadline {
            return Err("timed out waiting for updater request".to_string());
        }

        if let Some(connection) = try_accept_updater_request(listener)? {
            return Ok(connection);
        }
        thread::sleep(Duration::from_millis(10));
    }
}

fn try_accept_updater_request(
    listener: &TcpListener,
) -> Result<Option<std::net::TcpStream>, String> {
    match listener.accept() {
        Ok((connection, _)) => Ok(Some(connection)),
        Err(error) if error.kind() == std::io::ErrorKind::WouldBlock => Ok(None),
        Err(error) => Err(format!("failed to accept updater request: {error}")),
    }
}

#[test]
fn updater_test_server_stops_waiting_when_no_request_arrives() {
    let (_endpoint, server) = delayed_response_server(Duration::ZERO, Duration::from_millis(20));
    let result = server.join().expect("server thread should exit cleanly");

    assert_eq!(
        result,
        Err("timed out waiting for updater request".to_string())
    );
}

fn mock_updater_app() -> tauri::App<tauri::test::MockRuntime> {
    let mut context = tauri::test::mock_context(tauri::test::noop_assets());
    context
        .config_mut()
        .plugins
        .0
        .insert("updater".into(), json!({ "pubkey": "test-only-key" }));

    tauri::test::mock_builder()
        .plugin(tauri_plugin_updater::Builder::new().build())
        .build(context)
        .unwrap()
}

#[tokio::test]
async fn updater_builder_applies_its_timeout_to_the_update_check_request() {
    let (endpoint, server) =
        delayed_response_server(Duration::from_millis(100), Duration::from_secs(2));
    let endpoint = endpoint.parse().unwrap();
    let app = mock_updater_app();
    let updater =
        build_updater_with_timeout(app.handle(), endpoint, Duration::from_millis(20)).unwrap();

    let result = tokio::time::timeout(Duration::from_millis(500), updater.check())
        .await
        .expect("the server response should arrive before the test guard");

    assert!(
        result.is_err(),
        "the configured request timeout should abort the delayed check"
    );
    server
        .join()
        .expect("server thread should exit")
        .expect("server should receive the updater request");
}

#[tokio::test]
async fn production_updater_check_completes_after_five_seconds() {
    let (endpoint, server) =
        delayed_response_server(Duration::from_millis(5_100), Duration::from_secs(2));
    let endpoint = endpoint.parse().unwrap();
    let app = mock_updater_app();
    let updater = build_updater(app.handle(), endpoint).unwrap();

    let result = tokio::time::timeout(Duration::from_secs(10), updater.check())
        .await
        .expect("the delayed server response should arrive before the test guard");

    assert!(
        result.is_ok(),
        "production updater check should survive a 5.1s response delay"
    );
    assert_eq!(UPDATER_HTTP_TIMEOUT, Duration::from_secs(120));
    server
        .join()
        .expect("server thread should exit")
        .expect("server should receive the updater request");
}

#[test]
fn only_deb_and_rpm_owned_linux_installs_use_package_manager_updates() {
    assert!(requires_package_manager_update(true, false, true));
    assert!(!requires_package_manager_update(true, true, true));
    assert!(!requires_package_manager_update(true, false, false));
    assert!(!requires_package_manager_update(false, false, true));
}

#[test]
fn release_channel_defaults_to_stable() {
    assert_eq!(
        ReleaseChannel::from_settings_value(None),
        ReleaseChannel::Stable
    );
    assert_eq!(
        ReleaseChannel::from_settings_value(Some("stable")),
        ReleaseChannel::Stable
    );
    assert_eq!(
        ReleaseChannel::from_settings_value(Some("beta")),
        ReleaseChannel::Stable
    );
    assert_eq!(
        ReleaseChannel::from_settings_value(Some("invalid")),
        ReleaseChannel::Stable
    );
}

#[test]
fn release_channel_accepts_alpha() {
    assert_eq!(
        ReleaseChannel::from_settings_value(Some("alpha")),
        ReleaseChannel::Alpha
    );
    assert_eq!(
        ReleaseChannel::from_settings_value(Some("  alpha  ")),
        ReleaseChannel::Alpha
    );
}

#[test]
fn release_channel_endpoints_match_expected_paths() {
    assert_eq!(
        ReleaseChannel::Alpha.updater_endpoint().unwrap().as_str(),
        "https://refactoringhq.github.io/tolaria/alpha/latest.json"
    );
    assert_eq!(
        ReleaseChannel::Stable.updater_endpoint().unwrap().as_str(),
        "https://refactoringhq.github.io/tolaria/stable/latest.json"
    );
}

#[test]
fn alpha_release_metadata_url_uses_highest_calendar_sequence_tag() {
    let releases = vec![
            github_alpha_release(
                "alpha-v2026.5.8-alpha.0007",
                "2026-05-08T07:00:00Z",
                "https://github.com/refactoringhq/tolaria/releases/download/alpha-v2026.5.8-alpha.0007/alpha-latest.json",
            ),
            github_alpha_release(
                "alpha-v2026.5.8-alpha.0017",
                "2026-05-08T17:00:00Z",
                "https://github.com/refactoringhq/tolaria/releases/download/alpha-v2026.5.8-alpha.0017/alpha-latest.json",
            ),
            github_alpha_release(
                "alpha-v2026.5.7-alpha.0099",
                "2026-05-07T23:00:00Z",
                "https://github.com/refactoringhq/tolaria/releases/download/alpha-v2026.5.7-alpha.0099/alpha-latest.json",
            ),
        ];

    assert_eq!(
            latest_alpha_release_metadata_url(&releases)
                .unwrap()
                .as_str(),
            "https://github.com/refactoringhq/tolaria/releases/download/alpha-v2026.5.8-alpha.0017/alpha-latest.json"
        );
}

#[test]
fn alpha_release_metadata_url_prefers_the_most_recently_published_recovery_release() {
    let releases = vec![
        github_alpha_release(
            "alpha-v2027.8.2-alpha.0001",
            "2026-08-02T08:00:00Z",
            "https://example.com/recovery-bridge.json",
        ),
        github_alpha_release(
            "alpha-v2026.8.2-alpha.0001",
            "2026-08-02T09:00:00Z",
            "https://example.com/corrected-release.json",
        ),
    ];

    assert_eq!(
        latest_alpha_release_metadata_url(&releases)
            .unwrap()
            .as_str(),
        "https://example.com/corrected-release.json"
    );
}

#[test]
fn updater_accepts_only_the_expected_stable_version_transitions() {
    let date = |month, day| chrono::NaiveDate::from_ymd_opt(2026, month, day).unwrap();
    let cases = [
        ("2027.7.31", "2027.8.28", true, date(8, 28), true),
        ("2027.8.28", "2026.8.28", false, date(8, 28), true),
        ("2027.8.28", "2026.8.11", false, date(8, 28), false),
        ("2026.8.19", "2026.8.28", true, date(8, 28), true),
        ("2026.8.28", "2026.8.19", false, date(8, 28), false),
        ("2027.8.28", "2026.8.19", false, date(9, 15), true),
    ];

    for (current, remote, remote_is_semver_newer, today, expected) in cases {
        assert_eq!(
            should_install_update(current, remote, remote_is_semver_newer, today),
            expected,
            "unexpected update decision for {current} -> {remote}",
        );
    }
}

#[test]
fn updater_allows_only_the_targeted_future_calendar_recovery() {
    let today = chrono::NaiveDate::from_ymd_opt(2026, 8, 2).unwrap();

    assert!(should_recover_poisoned_calendar_version(
        "2027.8.2-alpha.1",
        "2026.8.2-alpha.1",
        today,
    ));
    assert!(!should_recover_poisoned_calendar_version(
        "2026.8.1-alpha.1",
        "2026.8.2-alpha.1",
        today,
    ));
    assert!(!should_recover_poisoned_calendar_version(
        "2027.8.2-alpha.1",
        "2025.8.2-alpha.1",
        today,
    ));
}

#[test]
fn alpha_release_metadata_url_ignores_drafts_and_non_alpha_assets() {
    let releases = vec![
        GitHubRelease {
            tag_name: "alpha-v2026.5.8-alpha.0018".into(),
            draft: true,
            published_at: "2026-05-08T18:00:00Z".parse().unwrap(),
            assets: vec![GitHubAsset {
                name: "alpha-latest.json".into(),
                browser_download_url: "https://example.com/draft.json".into(),
            }],
        },
        GitHubRelease {
            tag_name: "stable-v2026.5.8".into(),
            draft: false,
            published_at: "2026-05-08T19:00:00Z".parse().unwrap(),
            assets: vec![GitHubAsset {
                name: "stable-latest.json".into(),
                browser_download_url: "https://example.com/stable.json".into(),
            }],
        },
        github_alpha_release(
            "alpha-v2026.5.8-alpha.0017",
            "2026-05-08T17:00:00Z",
            "https://example.com/alpha-latest.json",
        ),
    ];

    assert_eq!(
        latest_alpha_release_metadata_url(&releases)
            .unwrap()
            .as_str(),
        "https://example.com/alpha-latest.json"
    );
}

#[test]
fn update_metadata_serializes_for_frontend_consumers() {
    let metadata = AppUpdateMetadata {
        current_version: "2026.4.1".into(),
        version: "2026.4.2".into(),
        date: Some("2026-04-30T12:00:00Z".into()),
        body: Some("Bug fixes".into()),
    };

    assert_eq!(
        serde_json::to_value(metadata).unwrap(),
        json!({
            "currentVersion": "2026.4.1",
            "version": "2026.4.2",
            "date": "2026-04-30T12:00:00Z",
            "body": "Bug fixes"
        })
    );
}

#[test]
fn download_events_serialize_as_tagged_frontend_events() {
    let events = [
        (
            AppUpdateDownloadEvent::Started {
                content_length: Some(4096),
            },
            json!({
                "event": "Started",
                "data": { "contentLength": 4096 }
            }),
        ),
        (
            AppUpdateDownloadEvent::Progress { chunk_length: 512 },
            json!({
                "event": "Progress",
                "data": { "chunkLength": 512 }
            }),
        ),
        (
            AppUpdateDownloadEvent::Finished,
            json!({ "event": "Finished" }),
        ),
    ];

    for (event, expected) in events {
        assert_eq!(serde_json::to_value(event).unwrap(), expected);
    }
}

fn github_alpha_release(
    tag_name: &str,
    published_at: &str,
    browser_download_url: &str,
) -> GitHubRelease {
    GitHubRelease {
        tag_name: tag_name.into(),
        draft: false,
        published_at: published_at.parse().unwrap(),
        assets: vec![GitHubAsset {
            name: "alpha-latest.json".into(),
            browser_download_url: browser_download_url.into(),
        }],
    }
}
