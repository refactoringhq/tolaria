use super::*;

fn assert_empty_settings(settings: &Settings) {
    assert_eq!(settings, &Settings::default());
}

/// Save settings to a temporary file and reload them.
fn save_and_reload(settings: Settings) -> Settings {
    let dir = tempfile::TempDir::new().unwrap();
    let path = dir.path().join("settings.json");
    save_settings_at(&path, settings).unwrap();
    get_settings_at(&path).unwrap()
}

#[test]
fn test_default_settings_all_none() {
    assert_empty_settings(&Settings::default());
}

#[test]
fn test_settings_json_roundtrip() {
    let settings = Settings {
        auto_pull_interval_minutes: Some(10),
        git_enabled: Some(false),
        git_path: Some("/opt/homebrew/bin/git".to_string()),
        git_provider: Some("wsl".to_string()),
        git_wsl_distro: Some("Ubuntu".to_string()),
        autogit_enabled: Some(true),
        autogit_use_ai_commit_messages: Some(true),
        autogit_idle_threshold_seconds: Some(90),
        autogit_inactive_threshold_seconds: Some(30),
        auto_advance_inbox_after_organize: Some(true),
        telemetry_consent: Some(true),
        crash_reporting_enabled: Some(true),
        analytics_enabled: Some(false),
        anonymous_id: Some("abc-123-uuid".to_string()),
        release_channel: Some("alpha".to_string()),
        automatic_update_checks_enabled: Some(false),
        theme_mode: Some("dark".to_string()),
        ui_language: Some("zh-Hans".to_string()),
        date_display_format: Some("iso".to_string()),
        note_width_mode: Some("wide".to_string()),
        sidebar_type_pluralization_enabled: Some(false),
        initial_h1_auto_rename_enabled: Some(false),
        ai_features_enabled: Some(false),
        default_ai_agent: Some("codex".to_string()),
        default_ai_target: Some("agent:codex".to_string()),
        ai_model_providers: None,
        ai_workspace_conversations: None,
        commit_message_templates: Some(vec![CommitMessageTemplate {
            id: "tpl-1".to_string(),
            name: "Daily sync".to_string(),
            title_template: "docs({vault}): update {date}".to_string(),
            body_template: "Synced from {branch}.".to_string(),
        }]),
        hide_gitignored_files: Some(false),
        multi_workspace_enabled: Some(true),
        all_notes_show_pdfs: Some(true),
        all_notes_show_images: Some(true),
        all_notes_show_unsupported: Some(false),
    };
    let json = serde_json::to_string(&settings).unwrap();
    let parsed: Settings = serde_json::from_str(&json).unwrap();
    assert_eq!(parsed, settings);
}

#[test]
fn test_get_settings_returns_default_for_missing_file() {
    let dir = tempfile::TempDir::new().unwrap();
    let path = dir.path().join("nonexistent.json");
    let result = get_settings_at(&path).unwrap();
    assert!(result.auto_pull_interval_minutes.is_none());
}

#[test]
fn test_save_and_load_preserves_values() {
    let loaded = save_and_reload(Settings {
        auto_pull_interval_minutes: Some(10),
        git_enabled: Some(false),
        autogit_enabled: Some(true),
        autogit_use_ai_commit_messages: Some(true),
        autogit_idle_threshold_seconds: Some(90),
        autogit_inactive_threshold_seconds: Some(30),
        auto_advance_inbox_after_organize: Some(true),
        release_channel: Some("alpha".to_string()),
        automatic_update_checks_enabled: Some(false),
        theme_mode: Some("dark".to_string()),
        ui_language: Some("zh-Hans".to_string()),
        date_display_format: Some("european".to_string()),
        note_width_mode: Some("wide".to_string()),
        sidebar_type_pluralization_enabled: Some(false),
        initial_h1_auto_rename_enabled: Some(false),
        ai_features_enabled: Some(false),
        default_ai_agent: Some("codex".to_string()),
        hide_gitignored_files: Some(false),
        multi_workspace_enabled: Some(true),
        all_notes_show_pdfs: Some(true),
        all_notes_show_images: Some(false),
        all_notes_show_unsupported: Some(true),
        ..Default::default()
    });
    assert_eq!(loaded.auto_pull_interval_minutes, Some(10));
    assert_eq!(loaded.git_enabled, Some(false));
    assert_eq!(loaded.autogit_enabled, Some(true));
    assert_eq!(loaded.autogit_use_ai_commit_messages, Some(true));
    assert_eq!(loaded.autogit_idle_threshold_seconds, Some(90));
    assert_eq!(loaded.autogit_inactive_threshold_seconds, Some(30));
    assert_eq!(loaded.auto_advance_inbox_after_organize, Some(true));
    assert_eq!(loaded.release_channel.as_deref(), Some("alpha"));
    assert_eq!(loaded.automatic_update_checks_enabled, Some(false));
    assert_eq!(loaded.theme_mode.as_deref(), Some("dark"));
    assert_eq!(loaded.ui_language.as_deref(), Some("zh-CN"));
    assert_eq!(loaded.date_display_format.as_deref(), Some("european"));
    assert_eq!(loaded.note_width_mode.as_deref(), Some("wide"));
    assert_eq!(loaded.sidebar_type_pluralization_enabled, Some(false));
    assert_eq!(loaded.initial_h1_auto_rename_enabled, Some(false));
    assert_eq!(loaded.ai_features_enabled, Some(false));
    assert_eq!(loaded.default_ai_agent.as_deref(), Some("codex"));
    assert_eq!(loaded.hide_gitignored_files, Some(false));
    assert_eq!(loaded.multi_workspace_enabled, Some(true));
    assert_eq!(loaded.all_notes_show_pdfs, Some(true));
    assert_eq!(loaded.all_notes_show_images, Some(false));
    assert_eq!(loaded.all_notes_show_unsupported, Some(true));
}

#[test]
fn test_gitignored_files_are_hidden_by_default() {
    assert!(should_hide_gitignored_files(&Settings::default()));
    assert!(should_hide_gitignored_files(&Settings {
        hide_gitignored_files: Some(true),
        ..Default::default()
    }));
    assert!(!should_hide_gitignored_files(&Settings {
        hide_gitignored_files: Some(false),
        ..Default::default()
    }));
}

#[test]
fn test_git_provider_settings_are_normalized() {
    let loaded = save_and_reload(Settings {
        git_provider: Some(" WSL ".to_string()),
        git_wsl_distro: Some(" Ubuntu-24.04 ".to_string()),
        ..Default::default()
    });
    assert_eq!(loaded.git_provider.as_deref(), Some("wsl"));
    assert_eq!(loaded.git_wsl_distro.as_deref(), Some("Ubuntu-24.04"));

    let invalid = save_and_reload(Settings {
        git_provider: Some("portable".to_string()),
        git_wsl_distro: Some("   ".to_string()),
        ..Default::default()
    });
    assert!(invalid.git_provider.is_none());
    assert!(invalid.git_wsl_distro.is_none());
}

#[test]
fn test_save_trims_whitespace() {
    let loaded = save_and_reload(Settings {
        anonymous_id: Some("  test-uuid  ".to_string()),
        git_path: Some("  /opt/homebrew/bin/git  ".to_string()),
        git_provider: Some("  native  ".to_string()),
        git_wsl_distro: Some("  Ubuntu  ".to_string()),
        release_channel: Some("  alpha  ".to_string()),
        theme_mode: Some("  dark  ".to_string()),
        ui_language: Some("  zh-cn  ".to_string()),
        date_display_format: Some("  ISO  ".to_string()),
        note_width_mode: Some("  WIDE  ".to_string()),
        default_ai_agent: Some("  codex  ".to_string()),
        ..Default::default()
    });
    assert_eq!(loaded.anonymous_id.as_deref(), Some("test-uuid"));
    assert_eq!(loaded.git_path.as_deref(), Some("/opt/homebrew/bin/git"));
    assert_eq!(loaded.git_provider.as_deref(), Some("native"));
    assert_eq!(loaded.git_wsl_distro.as_deref(), Some("Ubuntu"));
    assert_eq!(loaded.release_channel.as_deref(), Some("alpha"));
    assert_eq!(loaded.theme_mode.as_deref(), Some("dark"));
    assert_eq!(loaded.ui_language.as_deref(), Some("zh-CN"));
    assert_eq!(loaded.date_display_format.as_deref(), Some("iso"));
    assert_eq!(loaded.note_width_mode.as_deref(), Some("wide"));
    assert_eq!(loaded.default_ai_agent.as_deref(), Some("codex"));
}

#[test]
fn test_save_filters_empty_and_whitespace_only() {
    let loaded = save_and_reload(Settings {
        release_channel: Some("".to_string()),
        ..Default::default()
    });
    assert!(loaded.release_channel.is_none());
}

#[test]
fn test_non_positive_autogit_thresholds_are_filtered() {
    let loaded = save_and_reload(Settings {
        autogit_idle_threshold_seconds: Some(0),
        autogit_inactive_threshold_seconds: Some(0),
        ..Default::default()
    });
    assert!(loaded.autogit_idle_threshold_seconds.is_none());
    assert!(loaded.autogit_inactive_threshold_seconds.is_none());
}

#[test]
fn test_non_alpha_release_channels_normalize_to_stable() {
    let loaded = save_and_reload(Settings {
        release_channel: Some("beta".to_string()),
        ..Default::default()
    });
    assert!(loaded.release_channel.is_none());
}

#[test]
fn test_invalid_default_ai_agent_is_filtered() {
    let loaded = save_and_reload(Settings {
        default_ai_agent: Some("cursor".to_string()),
        ..Default::default()
    });
    assert!(loaded.default_ai_agent.is_none());
}

#[test]
fn test_opencode_default_ai_agent_is_preserved() {
    let loaded = save_and_reload(Settings {
        default_ai_agent: Some("opencode".to_string()),
        ..Default::default()
    });
    assert_eq!(loaded.default_ai_agent.as_deref(), Some("opencode"));
}

#[test]
fn test_copilot_default_ai_agent_is_preserved() {
    let loaded = normalize_settings(Settings {
        default_ai_agent: Some("copilot".to_string()),
        ..Default::default()
    });
    assert_eq!(loaded.default_ai_agent.as_deref(), Some("copilot"));
}

#[test]
fn test_pi_default_ai_agent_is_preserved() {
    let loaded = save_and_reload(Settings {
        default_ai_agent: Some("pi".to_string()),
        ..Default::default()
    });
    assert_eq!(loaded.default_ai_agent.as_deref(), Some("pi"));
}

#[test]
fn test_antigravity_default_ai_agent_is_preserved() {
    let loaded = save_and_reload(Settings {
        default_ai_agent: Some("antigravity".to_string()),
        ..Default::default()
    });
    assert_eq!(loaded.default_ai_agent.as_deref(), Some("antigravity"));
}

#[test]
fn test_legacy_gemini_default_ai_agent_migrates_to_antigravity() {
    let loaded = save_and_reload(Settings {
        default_ai_agent: Some("gemini".to_string()),
        ..Default::default()
    });
    assert_eq!(loaded.default_ai_agent.as_deref(), Some("antigravity"));
}

#[test]
fn test_hermes_default_ai_agent_is_preserved() {
    let loaded = save_and_reload(Settings {
        default_ai_agent: Some("hermes".to_string()),
        ..Default::default()
    });
    assert_eq!(loaded.default_ai_agent.as_deref(), Some("hermes"));
}

#[test]
fn test_system_theme_mode_is_preserved() {
    let loaded = save_and_reload(Settings {
        theme_mode: Some("system".to_string()),
        ..Default::default()
    });
    assert_eq!(loaded.theme_mode.as_deref(), Some("system"));
}

#[test]
fn test_invalid_theme_mode_is_filtered() {
    let loaded = save_and_reload(Settings {
        theme_mode: Some("sepia".to_string()),
        ..Default::default()
    });
    assert!(loaded.theme_mode.is_none());
}

#[test]
fn test_invalid_note_width_mode_is_filtered() {
    let loaded = save_and_reload(Settings {
        note_width_mode: Some("expanded".to_string()),
        ..Default::default()
    });
    assert!(loaded.note_width_mode.is_none());
}

#[test]
fn test_invalid_date_display_format_is_filtered() {
    let loaded = save_and_reload(Settings {
        date_display_format: Some("relative".to_string()),
        ..Default::default()
    });
    assert!(loaded.date_display_format.is_none());
}

#[test]
fn test_invalid_ui_language_is_filtered() {
    let loaded = save_and_reload(Settings {
        ui_language: Some("xx-ZZ".to_string()),
        ..Default::default()
    });
    assert!(loaded.ui_language.is_none());
}

#[test]
fn test_supported_ui_languages_are_saved_and_reloaded() {
    let expected_languages = [
        ("it-IT", "it-IT"),
        ("fr-FR", "fr-FR"),
        ("de-DE", "de-DE"),
        ("ru-RU", "ru-RU"),
        ("es-ES", "es-ES"),
        ("pt-BR", "pt-BR"),
        ("pt-PT", "pt-PT"),
        ("es-419", "es-419"),
        ("zh-CN", "zh-CN"),
        ("zh-TW", "zh-TW"),
        ("ja-JP", "ja-JP"),
        ("ko-KR", "ko-KR"),
        ("vi", "vi"),
        ("pl-PL", "pl-PL"),
        ("be-BY", "be-BY"),
        ("be-Latn", "be-Latn"),
        ("id-ID", "id-ID"),
        ("sk-SK", "sk-SK"),
    ];

    for (input, expected) in expected_languages {
        let loaded = save_and_reload(Settings {
            ui_language: Some(input.to_string()),
            ..Default::default()
        });
        assert_eq!(loaded.ui_language.as_deref(), Some(expected));
    }
}

#[test]
fn test_ui_language_aliases_are_canonicalized() {
    assert_eq!(normalize_ui_language(Some("en-US")).as_deref(), Some("en"));
    assert_eq!(
        normalize_ui_language(Some("zh_CN")).as_deref(),
        Some("zh-CN")
    );
    assert_eq!(
        normalize_ui_language(Some("zh-Hant")).as_deref(),
        Some("zh-TW")
    );
    assert_eq!(normalize_ui_language(Some("pl")).as_deref(), Some("pl-PL"));
    assert_eq!(normalize_ui_language(Some("be")).as_deref(), Some("be-BY"));
    assert_eq!(
        normalize_ui_language(Some("be-latn")).as_deref(),
        Some("be-Latn")
    );
    assert_eq!(normalize_ui_language(Some("id")).as_deref(), Some("id-ID"));
    assert_eq!(normalize_ui_language(Some("sk")).as_deref(), Some("sk-SK"));
}

#[test]
fn test_commit_message_templates_normalization() {
    let loaded = save_and_reload(Settings {
        commit_message_templates: Some(vec![
            CommitMessageTemplate {
                id: "  tpl-1  ".to_string(),
                name: "  Daily sync  ".to_string(),
                title_template: "  docs: update  ".to_string(),
                body_template: "  body  ".to_string(),
            },
            CommitMessageTemplate {
                id: "tpl-2".to_string(),
                name: "No body".to_string(),
                title_template: "title only".to_string(),
                body_template: String::new(),
            },
            // Invalid entries are dropped: blank id, blank name, blank title.
            CommitMessageTemplate {
                id: String::new(),
                name: "bad".to_string(),
                title_template: "title".to_string(),
                body_template: String::new(),
            },
            CommitMessageTemplate {
                id: "tpl-4".to_string(),
                name: "   ".to_string(),
                title_template: "title".to_string(),
                body_template: String::new(),
            },
            CommitMessageTemplate {
                id: "tpl-5".to_string(),
                name: "bad".to_string(),
                title_template: "   ".to_string(),
                body_template: String::new(),
            },
        ]),
        ..Default::default()
    });

    let templates = loaded.commit_message_templates.expect("templates survive save/load");
    assert_eq!(templates.len(), 2);
    assert_eq!(templates[0].id, "tpl-1");
    assert_eq!(templates[0].name, "Daily sync");
    assert_eq!(templates[0].title_template, "docs: update");
    assert_eq!(templates[0].body_template, "body");
    assert_eq!(templates[1].id, "tpl-2");
    assert_eq!(templates[1].body_template, "");
}

#[test]
fn test_commit_message_templates_empty_becomes_none() {
    let loaded = save_and_reload(Settings {
        commit_message_templates: Some(vec![]),
        ..Default::default()
    });
    assert_eq!(loaded.commit_message_templates, None);

    let loaded = save_and_reload(Settings {
        commit_message_templates: Some(vec![CommitMessageTemplate {
            id: String::new(),
            name: String::new(),
            title_template: String::new(),
            body_template: String::new(),
        }]),
        ..Default::default()
    });
    assert_eq!(loaded.commit_message_templates, None);
}
