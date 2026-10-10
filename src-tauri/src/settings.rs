use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

use crate::ai_models::{normalize_ai_model_providers, AiModelProvider};

const SUPPORTED_DEFAULT_AI_AGENTS: &[&str] = &[
    "claude_code",
    "codex",
    "copilot",
    "opencode",
    "pi",
    "antigravity",
    "kiro",
    "hermes",
];
pub const DEFAULT_HIDE_GITIGNORED_FILES: bool = true;
const SUPPORTED_NOTE_WIDTH_MODES: &[&str] = &["normal", "wide"];
const SUPPORTED_DATE_DISPLAY_FORMATS: &[&str] = &["us", "european", "friendly", "iso"];
const SUPPORTED_UI_LANGUAGE_ALIASES: &[(&str, &str)] = &[
    ("en", "en"),
    ("en-us", "en"),
    ("en-gb", "en"),
    ("en-ca", "en"),
    ("en-au", "en"),
    ("it", "it-IT"),
    ("it-it", "it-IT"),
    ("fr", "fr-FR"),
    ("fr-fr", "fr-FR"),
    ("de", "de-DE"),
    ("de-de", "de-DE"),
    ("ru", "ru-RU"),
    ("ru-ru", "ru-RU"),
    ("es-es", "es-ES"),
    ("pt-br", "pt-BR"),
    ("pt-pt", "pt-PT"),
    ("es-419", "es-419"),
    ("es-ar", "es-419"),
    ("es-bo", "es-419"),
    ("es-cl", "es-419"),
    ("es-co", "es-419"),
    ("es-cr", "es-419"),
    ("es-cu", "es-419"),
    ("es-do", "es-419"),
    ("es-ec", "es-419"),
    ("es-gt", "es-419"),
    ("es-hn", "es-419"),
    ("es-mx", "es-419"),
    ("es-ni", "es-419"),
    ("es-pa", "es-419"),
    ("es-pe", "es-419"),
    ("es-pr", "es-419"),
    ("es-py", "es-419"),
    ("es-sv", "es-419"),
    ("es-us", "es-419"),
    ("es-uy", "es-419"),
    ("es-ve", "es-419"),
    ("zh", "zh-CN"),
    ("zh-cn", "zh-CN"),
    ("zh-hans", "zh-CN"),
    ("zh-sg", "zh-CN"),
    ("zh-tw", "zh-TW"),
    ("zh-hant", "zh-TW"),
    ("zh-hk", "zh-TW"),
    ("zh-mo", "zh-TW"),
    ("ja", "ja-JP"),
    ("ja-jp", "ja-JP"),
    ("ko", "ko-KR"),
    ("ko-kr", "ko-KR"),
    ("vi", "vi"),
    ("vi-vn", "vi"),
    ("pl", "pl-PL"),
    ("pl-pl", "pl-PL"),
    ("be", "be-BY"),
    ("be-by", "be-BY"),
    ("be-latn", "be-Latn"),
    ("id", "id-ID"),
    ("id-id", "id-ID"),
    ("sk", "sk-SK"),
    ("sk-sk", "sk-SK"),
];

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Default)]
pub struct AiWorkspaceConversationSetting {
    pub archived: Option<bool>,
    pub id: String,
    pub model_id: Option<String>,
    pub target_id: Option<String>,
    pub title: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct CommitMessageTemplate {
    pub id: String,
    pub name: String,
    #[serde(default)]
    pub title_template: String,
    #[serde(default)]
    pub body_template: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Default)]
pub struct Settings {
    pub auto_pull_interval_minutes: Option<u32>,
    pub git_enabled: Option<bool>,
    pub git_path: Option<String>,
    pub git_provider: Option<String>,
    pub git_wsl_distro: Option<String>,
    pub autogit_enabled: Option<bool>,
    pub autogit_use_ai_commit_messages: Option<bool>,
    pub autogit_idle_threshold_seconds: Option<u32>,
    pub autogit_inactive_threshold_seconds: Option<u32>,
    pub auto_advance_inbox_after_organize: Option<bool>,
    pub telemetry_consent: Option<bool>,
    pub crash_reporting_enabled: Option<bool>,
    pub analytics_enabled: Option<bool>,
    pub anonymous_id: Option<String>,
    pub release_channel: Option<String>,
    pub automatic_update_checks_enabled: Option<bool>,
    pub theme_mode: Option<String>,
    pub ui_language: Option<String>,
    pub date_display_format: Option<String>,
    pub note_width_mode: Option<String>,
    pub sidebar_type_pluralization_enabled: Option<bool>,
    pub initial_h1_auto_rename_enabled: Option<bool>,
    pub ai_features_enabled: Option<bool>,
    pub default_ai_agent: Option<String>,
    pub default_ai_target: Option<String>,
    pub ai_model_providers: Option<Vec<AiModelProvider>>,
    pub ai_workspace_conversations: Option<Vec<AiWorkspaceConversationSetting>>,
    pub commit_message_templates: Option<Vec<CommitMessageTemplate>>,
    pub hide_gitignored_files: Option<bool>,
    pub all_notes_show_pdfs: Option<bool>,
    pub all_notes_show_images: Option<bool>,
    pub all_notes_show_unsupported: Option<bool>,
    pub multi_workspace_enabled: Option<bool>,
}

fn normalize_optional_string(value: Option<String>) -> Option<String> {
    value
        .map(|candidate| candidate.trim().to_string())
        .filter(|candidate| !candidate.is_empty())
}

fn normalize_optional_positive_u32(value: Option<u32>) -> Option<u32> {
    value.filter(|candidate| *candidate > 0)
}

pub fn normalize_release_channel(value: Option<&str>) -> Option<String> {
    match value.map(|candidate| candidate.trim().to_ascii_lowercase()) {
        Some(channel) if channel == "alpha" => Some(channel),
        _ => None,
    }
}

pub fn effective_release_channel(value: Option<&str>) -> &'static str {
    if normalize_release_channel(value).is_some() {
        "alpha"
    } else {
        "stable"
    }
}

pub fn normalize_default_ai_agent(value: Option<&str>) -> Option<String> {
    match value.map(|candidate| candidate.trim().to_ascii_lowercase()) {
        Some(agent) if agent == "gemini" => Some("antigravity".to_string()),
        Some(agent) if SUPPORTED_DEFAULT_AI_AGENTS.contains(&agent.as_str()) => Some(agent),
        _ => None,
    }
}

pub fn normalize_theme_mode(value: Option<&str>) -> Option<String> {
    match value.map(|candidate| candidate.trim().to_ascii_lowercase()) {
        Some(mode) if mode == "light" || mode == "dark" || mode == "system" => Some(mode),
        _ => None,
    }
}

pub fn normalize_note_width_mode(value: Option<&str>) -> Option<String> {
    match value.map(|candidate| candidate.trim().to_ascii_lowercase()) {
        Some(mode) if SUPPORTED_NOTE_WIDTH_MODES.contains(&mode.as_str()) => Some(mode),
        _ => None,
    }
}

pub fn normalize_date_display_format(value: Option<&str>) -> Option<String> {
    match value.map(|candidate| candidate.trim().to_ascii_lowercase()) {
        Some(format) if SUPPORTED_DATE_DISPLAY_FORMATS.contains(&format.as_str()) => Some(format),
        _ => None,
    }
}

pub fn should_hide_gitignored_files(settings: &Settings) -> bool {
    settings
        .hide_gitignored_files
        .unwrap_or(DEFAULT_HIDE_GITIGNORED_FILES)
}

pub fn normalize_git_provider(value: Option<&str>) -> Option<String> {
    match value.map(|candidate| candidate.trim().to_ascii_lowercase()) {
        Some(provider) if provider == "native" || provider == "wsl" => Some(provider),
        _ => None,
    }
}

pub fn hide_gitignored_files_enabled() -> bool {
    get_settings()
        .map(|settings| should_hide_gitignored_files(&settings))
        .unwrap_or(DEFAULT_HIDE_GITIGNORED_FILES)
}

fn canonical_language_code(value: &str) -> Option<String> {
    let code = value.trim().replace('_', "-").to_ascii_lowercase();
    if code.is_empty() {
        None
    } else {
        Some(code)
    }
}

pub fn normalize_ui_language(value: Option<&str>) -> Option<String> {
    let language = canonical_language_code(value?)?;
    SUPPORTED_UI_LANGUAGE_ALIASES
        .iter()
        .find_map(|(alias, canonical)| (*alias == language).then(|| (*canonical).to_string()))
}

fn normalize_settings(settings: Settings) -> Settings {
    Settings {
        auto_pull_interval_minutes: settings.auto_pull_interval_minutes,
        git_enabled: settings.git_enabled,
        git_path: normalize_optional_string(settings.git_path),
        git_provider: normalize_git_provider(settings.git_provider.as_deref()),
        git_wsl_distro: normalize_optional_string(settings.git_wsl_distro),
        autogit_enabled: settings.autogit_enabled,
        autogit_use_ai_commit_messages: settings.autogit_use_ai_commit_messages,
        autogit_idle_threshold_seconds: normalize_optional_positive_u32(
            settings.autogit_idle_threshold_seconds,
        ),
        autogit_inactive_threshold_seconds: normalize_optional_positive_u32(
            settings.autogit_inactive_threshold_seconds,
        ),
        auto_advance_inbox_after_organize: settings.auto_advance_inbox_after_organize,
        telemetry_consent: settings.telemetry_consent,
        crash_reporting_enabled: settings.crash_reporting_enabled,
        analytics_enabled: settings.analytics_enabled,
        anonymous_id: normalize_optional_string(settings.anonymous_id),
        release_channel: normalize_release_channel(settings.release_channel.as_deref()),
        automatic_update_checks_enabled: settings.automatic_update_checks_enabled,
        theme_mode: normalize_theme_mode(settings.theme_mode.as_deref()),
        ui_language: normalize_ui_language(settings.ui_language.as_deref()),
        date_display_format: normalize_date_display_format(settings.date_display_format.as_deref()),
        note_width_mode: normalize_note_width_mode(settings.note_width_mode.as_deref()),
        sidebar_type_pluralization_enabled: settings.sidebar_type_pluralization_enabled,
        initial_h1_auto_rename_enabled: settings.initial_h1_auto_rename_enabled,
        ai_features_enabled: settings.ai_features_enabled,
        default_ai_agent: normalize_default_ai_agent(settings.default_ai_agent.as_deref()),
        default_ai_target: normalize_optional_string(settings.default_ai_target),
        ai_model_providers: normalize_ai_model_providers(settings.ai_model_providers),
        ai_workspace_conversations: normalize_ai_workspace_conversations(
            settings.ai_workspace_conversations,
        ),
        commit_message_templates: normalize_commit_message_templates(settings.commit_message_templates),
        hide_gitignored_files: settings.hide_gitignored_files,
        all_notes_show_pdfs: settings.all_notes_show_pdfs,
        all_notes_show_images: settings.all_notes_show_images,
        all_notes_show_unsupported: settings.all_notes_show_unsupported,
        multi_workspace_enabled: settings.multi_workspace_enabled,
    }
}

fn normalize_ai_workspace_conversations(
    conversations: Option<Vec<AiWorkspaceConversationSetting>>,
) -> Option<Vec<AiWorkspaceConversationSetting>> {
    let normalized: Vec<AiWorkspaceConversationSetting> = conversations
        .unwrap_or_default()
        .into_iter()
        .filter_map(|conversation| {
            let id = conversation.id.trim().to_string();
            let title = conversation.title.trim().to_string();
            if id.is_empty() || title.is_empty() {
                return None;
            }

            Some(AiWorkspaceConversationSetting {
                archived: conversation.archived,
                id,
                model_id: normalize_optional_string(conversation.model_id),
                target_id: normalize_optional_string(conversation.target_id),
                title,
            })
        })
        .take(100)
        .collect();

    if normalized.is_empty() {
        None
    } else {
        Some(normalized)
    }
}

fn normalize_commit_message_templates(
    templates: Option<Vec<CommitMessageTemplate>>,
) -> Option<Vec<CommitMessageTemplate>> {
    let normalized: Vec<CommitMessageTemplate> = templates
        .unwrap_or_default()
        .into_iter()
        .filter_map(|template| {
            let id = template.id.trim().to_string();
            let name = template.name.trim().to_string();
            let title_template = template.title_template.trim().to_string();
            if id.is_empty() || name.is_empty() || title_template.is_empty() {
                return None;
            }

            Some(CommitMessageTemplate {
                id,
                name,
                title_template,
                body_template: template.body_template.trim().to_string(),
            })
        })
        .take(100)
        .collect();

    if normalized.is_empty() {
        None
    } else {
        Some(normalized)
    }
}

pub(crate) fn preferred_app_config_path(file_name: &str) -> Result<PathBuf, String> {
    crate::app_config::preferred_app_config_path(file_name)
}

fn resolve_existing_or_preferred_app_config_path(file_name: &str) -> Result<PathBuf, String> {
    crate::app_config::resolve_existing_or_preferred_app_config_path(file_name)
}

fn settings_path() -> Result<PathBuf, String> {
    resolve_existing_or_preferred_app_config_path("settings.json")
}

fn get_settings_at(path: &PathBuf) -> Result<Settings, String> {
    if !path.exists() {
        return Ok(Settings::default());
    }
    let content =
        fs::read_to_string(path).map_err(|e| format!("Failed to read settings: {}", e))?;
    let mut value: serde_json::Value =
        serde_json::from_str(&content).map_err(|e| format!("Failed to parse settings: {}", e))?;

    let removed_hidden_defaults = value
        .as_object_mut()
        .and_then(|settings| settings.remove("hidden_defaults"))
        .is_some();
    if removed_hidden_defaults {
        let json = serde_json::to_string_pretty(&value)
            .map_err(|e| format!("Failed to serialize settings: {}", e))?;
        fs::write(path, json).map_err(|e| format!("Failed to update settings: {}", e))?;
    }

    let settings =
        serde_json::from_value(value).map_err(|e| format!("Failed to parse settings: {}", e))?;
    Ok(normalize_settings(settings))
}

fn save_settings_at(path: &PathBuf, settings: Settings) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create config directory: {}", e))?;
    }

    let cleaned = normalize_settings(settings);

    let json = serde_json::to_string_pretty(&cleaned)
        .map_err(|e| format!("Failed to serialize settings: {}", e))?;
    fs::write(path, json).map_err(|e| format!("Failed to write settings: {}", e))
}

pub fn get_settings() -> Result<Settings, String> {
    get_settings_at(&settings_path()?)
}

pub fn save_settings(settings: Settings) -> Result<(), String> {
    save_settings_at(&preferred_app_config_path("settings.json")?, settings)
}

fn ai_workspace_sessions_path() -> Result<PathBuf, String> {
    resolve_existing_or_preferred_app_config_path("ai-workspace-sessions.json")
}

fn get_ai_workspace_sessions_at(path: &PathBuf) -> Result<serde_json::Value, String> {
    if !path.exists() {
        return Ok(serde_json::json!({}));
    }

    let content = fs::read_to_string(path)
        .map_err(|e| format!("Failed to read AI workspace sessions: {}", e))?;
    let sessions: serde_json::Value = serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse AI workspace sessions: {}", e))?;
    if sessions.is_object() {
        Ok(sessions)
    } else {
        Ok(serde_json::json!({}))
    }
}

fn save_ai_workspace_sessions_at(
    path: &PathBuf,
    sessions: serde_json::Value,
) -> Result<(), String> {
    if !sessions.is_object() {
        return Err("AI workspace sessions must be a JSON object".to_string());
    }

    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create config directory: {}", e))?;
    }

    let json = serde_json::to_string_pretty(&sessions)
        .map_err(|e| format!("Failed to serialize AI workspace sessions: {}", e))?;
    fs::write(path, json).map_err(|e| format!("Failed to write AI workspace sessions: {}", e))
}

pub fn get_ai_workspace_sessions() -> Result<serde_json::Value, String> {
    get_ai_workspace_sessions_at(&ai_workspace_sessions_path()?)
}

pub fn save_ai_workspace_sessions(sessions: serde_json::Value) -> Result<(), String> {
    save_ai_workspace_sessions_at(
        &preferred_app_config_path("ai-workspace-sessions.json")?,
        sessions,
    )
}

fn last_vault_file() -> Result<PathBuf, String> {
    resolve_existing_or_preferred_app_config_path("last-vault.txt")
}

fn get_last_vault_at(path: &PathBuf) -> Option<String> {
    fs::read_to_string(path)
        .ok()
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
}

fn set_last_vault_at(path: &PathBuf, vault_path: &str) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create config directory: {}", e))?;
    }
    fs::write(path, vault_path.trim())
        .map_err(|e| format!("Failed to write last vault path: {}", e))
}

pub fn get_last_vault() -> Option<String> {
    last_vault_file().ok().and_then(|p| get_last_vault_at(&p))
}

pub fn set_last_vault(vault_path: &str) -> Result<(), String> {
    set_last_vault_at(&preferred_app_config_path("last-vault.txt")?, vault_path)
}

#[cfg(test)]
#[path = "settings_normalization_tests.rs"]
mod normalization_tests;

#[cfg(test)]
#[path = "settings_storage_tests.rs"]
mod storage_tests;
