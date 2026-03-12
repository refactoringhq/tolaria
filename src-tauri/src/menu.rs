use tauri::{
    menu::{MenuBuilder, MenuItemBuilder, MenuItemKind, Submenu, SubmenuBuilder},
    App, AppHandle, Emitter,
};

// Custom menu item IDs that emit events to the frontend.
const APP_SETTINGS: &str = "app-settings";
const APP_CHECK_FOR_UPDATES: &str = "app-check-for-updates";

const FILE_NEW_NOTE: &str = "file-new-note";
const FILE_NEW_TYPE: &str = "file-new-type";
const FILE_DAILY_NOTE: &str = "file-daily-note";
const FILE_QUICK_OPEN: &str = "file-quick-open";
const FILE_SAVE: &str = "file-save";
const FILE_CLOSE_TAB: &str = "file-close-tab";
const FILE_REOPEN_CLOSED_TAB: &str = "file-reopen-closed-tab";

const EDIT_FIND_IN_VAULT: &str = "edit-find-in-vault";
const EDIT_TOGGLE_RAW_EDITOR: &str = "edit-toggle-raw-editor";
const EDIT_TOGGLE_DIFF: &str = "edit-toggle-diff";

const VIEW_EDITOR_ONLY: &str = "view-editor-only";
const VIEW_EDITOR_LIST: &str = "view-editor-list";
const VIEW_ALL: &str = "view-all";
const VIEW_TOGGLE_PROPERTIES: &str = "view-toggle-properties";
const VIEW_TOGGLE_AI_CHAT: &str = "view-toggle-ai-chat";
const VIEW_TOGGLE_BACKLINKS: &str = "view-toggle-backlinks";
const VIEW_COMMAND_PALETTE: &str = "view-command-palette";
const VIEW_ZOOM_IN: &str = "view-zoom-in";
const VIEW_ZOOM_OUT: &str = "view-zoom-out";
const VIEW_ZOOM_RESET: &str = "view-zoom-reset";
const VIEW_GO_BACK: &str = "view-go-back";
const VIEW_GO_FORWARD: &str = "view-go-forward";

const GO_ALL_NOTES: &str = "go-all-notes";
const GO_ARCHIVED: &str = "go-archived";
const GO_TRASH: &str = "go-trash";
const GO_CHANGES: &str = "go-changes";

const NOTE_ARCHIVE: &str = "note-archive";
const NOTE_TRASH: &str = "note-trash";
const NOTE_EMPTY_TRASH: &str = "note-empty-trash";

const VAULT_OPEN: &str = "vault-open";
const VAULT_REMOVE: &str = "vault-remove";
const VAULT_RESTORE_GETTING_STARTED: &str = "vault-restore-getting-started";
const VAULT_NEW_THEME: &str = "vault-new-theme";
const VAULT_RESTORE_DEFAULT_THEMES: &str = "vault-restore-default-themes";
const VAULT_COMMIT_PUSH: &str = "vault-commit-push";
const VAULT_RESOLVE_CONFLICTS: &str = "vault-resolve-conflicts";
const VAULT_VIEW_CHANGES: &str = "vault-view-changes";
const VAULT_INSTALL_MCP: &str = "vault-install-mcp";
const VAULT_REINDEX: &str = "vault-reindex";
const VAULT_RELOAD: &str = "vault-reload";
const VAULT_REPAIR: &str = "vault-repair";

const CUSTOM_IDS: &[&str] = &[
    APP_SETTINGS,
    APP_CHECK_FOR_UPDATES,
    FILE_NEW_NOTE,
    FILE_NEW_TYPE,
    FILE_DAILY_NOTE,
    FILE_QUICK_OPEN,
    FILE_SAVE,
    FILE_CLOSE_TAB,
    FILE_REOPEN_CLOSED_TAB,
    EDIT_FIND_IN_VAULT,
    EDIT_TOGGLE_RAW_EDITOR,
    EDIT_TOGGLE_DIFF,
    VIEW_EDITOR_ONLY,
    VIEW_EDITOR_LIST,
    VIEW_ALL,
    VIEW_TOGGLE_PROPERTIES,
    VIEW_TOGGLE_AI_CHAT,
    VIEW_TOGGLE_BACKLINKS,
    VIEW_COMMAND_PALETTE,
    VIEW_ZOOM_IN,
    VIEW_ZOOM_OUT,
    VIEW_ZOOM_RESET,
    VIEW_GO_BACK,
    VIEW_GO_FORWARD,
    GO_ALL_NOTES,
    GO_ARCHIVED,
    GO_TRASH,
    GO_CHANGES,
    NOTE_ARCHIVE,
    NOTE_TRASH,
    NOTE_EMPTY_TRASH,
    VAULT_OPEN,
    VAULT_REMOVE,
    VAULT_RESTORE_GETTING_STARTED,
    VAULT_NEW_THEME,
    VAULT_RESTORE_DEFAULT_THEMES,
    VAULT_COMMIT_PUSH,
    VAULT_RESOLVE_CONFLICTS,
    VAULT_VIEW_CHANGES,
    VAULT_INSTALL_MCP,
    VAULT_REINDEX,
    VAULT_RELOAD,
    VAULT_REPAIR,
];

/// IDs of menu items that should be disabled when no note tab is active.
const NOTE_DEPENDENT_IDS: &[&str] = &[
    FILE_SAVE,
    FILE_CLOSE_TAB,
    NOTE_ARCHIVE,
    NOTE_TRASH,
    EDIT_TOGGLE_RAW_EDITOR,
    EDIT_TOGGLE_DIFF,
    VIEW_TOGGLE_BACKLINKS,
];

/// IDs of menu items that depend on having uncommitted changes.
const GIT_COMMIT_DEPENDENT_IDS: &[&str] = &[VAULT_COMMIT_PUSH];

/// IDs of menu items that depend on having merge conflicts.
const GIT_CONFLICT_DEPENDENT_IDS: &[&str] = &[VAULT_RESOLVE_CONFLICTS];

type MenuResult = Result<Submenu<tauri::Wry>, Box<dyn std::error::Error>>;

fn build_app_menu(app: &App) -> MenuResult {
    let settings_item = MenuItemBuilder::new("Settings...")
        .id(APP_SETTINGS)
        .accelerator("CmdOrCtrl+,")
        .build(app)?;
    let check_updates_item = MenuItemBuilder::new("Check for Updates...")
        .id(APP_CHECK_FOR_UPDATES)
        .build(app)?;

    Ok(SubmenuBuilder::new(app, "Laputa")
        .about(None)
        .separator()
        .item(&check_updates_item)
        .separator()
        .item(&settings_item)
        .separator()
        .services()
        .separator()
        .hide()
        .hide_others()
        .show_all()
        .separator()
        .quit()
        .build()?)
}

fn build_file_menu(app: &App) -> MenuResult {
    let new_note = MenuItemBuilder::new("New Note")
        .id(FILE_NEW_NOTE)
        .accelerator("CmdOrCtrl+N")
        .build(app)?;
    let new_type = MenuItemBuilder::new("New Type")
        .id(FILE_NEW_TYPE)
        .build(app)?;
    let daily_note = MenuItemBuilder::new("Open Today's Note")
        .id(FILE_DAILY_NOTE)
        .accelerator("CmdOrCtrl+J")
        .build(app)?;
    let quick_open = MenuItemBuilder::new("Quick Open")
        .id(FILE_QUICK_OPEN)
        .accelerator("CmdOrCtrl+P")
        .build(app)?;
    let save = MenuItemBuilder::new("Save")
        .id(FILE_SAVE)
        .accelerator("CmdOrCtrl+S")
        .build(app)?;
    let close_tab = MenuItemBuilder::new("Close Tab")
        .id(FILE_CLOSE_TAB)
        .accelerator("CmdOrCtrl+W")
        .build(app)?;
    let reopen_closed_tab = MenuItemBuilder::new("Reopen Closed Tab")
        .id(FILE_REOPEN_CLOSED_TAB)
        .accelerator("CmdOrCtrl+Shift+T")
        .build(app)?;

    Ok(SubmenuBuilder::new(app, "File")
        .item(&new_note)
        .item(&new_type)
        .item(&daily_note)
        .item(&quick_open)
        .separator()
        .item(&save)
        .item(&close_tab)
        .item(&reopen_closed_tab)
        .build()?)
}

fn build_edit_menu(app: &App) -> MenuResult {
    let find_in_vault = MenuItemBuilder::new("Find in Vault")
        .id(EDIT_FIND_IN_VAULT)
        .accelerator("CmdOrCtrl+Shift+F")
        .build(app)?;
    let toggle_diff = MenuItemBuilder::new("Toggle Diff Mode")
        .id(EDIT_TOGGLE_DIFF)
        .build(app)?;

    Ok(SubmenuBuilder::new(app, "Edit")
        .undo()
        .redo()
        .separator()
        .cut()
        .copy()
        .paste()
        .separator()
        .select_all()
        .separator()
        .item(&find_in_vault)
        .item(&toggle_diff)
        .build()?)
}

fn build_view_menu(app: &App) -> MenuResult {
    let editor_only = MenuItemBuilder::new("Editor Only")
        .id(VIEW_EDITOR_ONLY)
        .accelerator("CmdOrCtrl+1")
        .build(app)?;
    let editor_list = MenuItemBuilder::new("Editor + Notes")
        .id(VIEW_EDITOR_LIST)
        .accelerator("CmdOrCtrl+2")
        .build(app)?;
    let all_panels = MenuItemBuilder::new("All Panels")
        .id(VIEW_ALL)
        .accelerator("CmdOrCtrl+3")
        .build(app)?;
    let toggle_properties = MenuItemBuilder::new("Toggle Properties Panel")
        .id(VIEW_TOGGLE_PROPERTIES)
        .build(app)?;
    let command_palette = MenuItemBuilder::new("Command Palette")
        .id(VIEW_COMMAND_PALETTE)
        .accelerator("CmdOrCtrl+K")
        .build(app)?;
    let zoom_in = MenuItemBuilder::new("Zoom In")
        .id(VIEW_ZOOM_IN)
        .accelerator("CmdOrCtrl+=")
        .build(app)?;
    let zoom_out = MenuItemBuilder::new("Zoom Out")
        .id(VIEW_ZOOM_OUT)
        .accelerator("CmdOrCtrl+-")
        .build(app)?;
    let zoom_reset = MenuItemBuilder::new("Actual Size")
        .id(VIEW_ZOOM_RESET)
        .accelerator("CmdOrCtrl+0")
        .build(app)?;

    Ok(SubmenuBuilder::new(app, "View")
        .item(&editor_only)
        .item(&editor_list)
        .item(&all_panels)
        .separator()
        .item(&toggle_properties)
        .separator()
        .item(&zoom_in)
        .item(&zoom_out)
        .item(&zoom_reset)
        .separator()
        .item(&command_palette)
        .build()?)
}

fn build_go_menu(app: &App) -> MenuResult {
    let all_notes = MenuItemBuilder::new("All Notes")
        .id(GO_ALL_NOTES)
        .build(app)?;
    let archived = MenuItemBuilder::new("Archived")
        .id(GO_ARCHIVED)
        .build(app)?;
    let trash = MenuItemBuilder::new("Trash").id(GO_TRASH).build(app)?;
    let changes = MenuItemBuilder::new("Changes").id(GO_CHANGES).build(app)?;
    let go_back = MenuItemBuilder::new("Go Back")
        .id(VIEW_GO_BACK)
        .accelerator("CmdOrCtrl+[")
        .build(app)?;
    let go_forward = MenuItemBuilder::new("Go Forward")
        .id(VIEW_GO_FORWARD)
        .accelerator("CmdOrCtrl+]")
        .build(app)?;

    Ok(SubmenuBuilder::new(app, "Go")
        .item(&all_notes)
        .item(&archived)
        .item(&trash)
        .item(&changes)
        .separator()
        .item(&go_back)
        .item(&go_forward)
        .build()?)
}

fn build_note_menu(app: &App) -> MenuResult {
    let archive_note = MenuItemBuilder::new("Archive Note")
        .id(NOTE_ARCHIVE)
        .accelerator("CmdOrCtrl+E")
        .build(app)?;
    let trash_note = MenuItemBuilder::new("Trash Note")
        .id(NOTE_TRASH)
        .accelerator("CmdOrCtrl+Backspace")
        .build(app)?;
    let empty_trash = MenuItemBuilder::new("Empty Trash…")
        .id(NOTE_EMPTY_TRASH)
        .build(app)?;
    let toggle_raw_editor = MenuItemBuilder::new("Toggle Raw Editor")
        .id(EDIT_TOGGLE_RAW_EDITOR)
        .accelerator("CmdOrCtrl+\\")
        .build(app)?;
    let toggle_ai_chat = MenuItemBuilder::new("Toggle AI Chat")
        .id(VIEW_TOGGLE_AI_CHAT)
        .accelerator("CmdOrCtrl+I")
        .build(app)?;
    let toggle_backlinks = MenuItemBuilder::new("Toggle Backlinks")
        .id(VIEW_TOGGLE_BACKLINKS)
        .build(app)?;

    Ok(SubmenuBuilder::new(app, "Note")
        .item(&archive_note)
        .item(&trash_note)
        .item(&empty_trash)
        .separator()
        .item(&toggle_raw_editor)
        .item(&toggle_ai_chat)
        .item(&toggle_backlinks)
        .build()?)
}

fn build_vault_menu(app: &App) -> MenuResult {
    let open_vault = MenuItemBuilder::new("Open Vault…")
        .id(VAULT_OPEN)
        .build(app)?;
    let remove_vault = MenuItemBuilder::new("Remove Vault from List")
        .id(VAULT_REMOVE)
        .build(app)?;
    let restore_getting_started = MenuItemBuilder::new("Restore Getting Started")
        .id(VAULT_RESTORE_GETTING_STARTED)
        .build(app)?;
    let new_theme = MenuItemBuilder::new("New Theme")
        .id(VAULT_NEW_THEME)
        .build(app)?;
    let restore_default_themes = MenuItemBuilder::new("Restore Default Themes")
        .id(VAULT_RESTORE_DEFAULT_THEMES)
        .build(app)?;
    let commit_push = MenuItemBuilder::new("Commit & Push")
        .id(VAULT_COMMIT_PUSH)
        .build(app)?;
    let resolve_conflicts = MenuItemBuilder::new("Resolve Conflicts")
        .id(VAULT_RESOLVE_CONFLICTS)
        .enabled(false)
        .build(app)?;
    let view_changes = MenuItemBuilder::new("View Pending Changes")
        .id(VAULT_VIEW_CHANGES)
        .build(app)?;
    let install_mcp = MenuItemBuilder::new("Restore MCP Server")
        .id(VAULT_INSTALL_MCP)
        .build(app)?;
    let reindex = MenuItemBuilder::new("Reindex Vault")
        .id(VAULT_REINDEX)
        .build(app)?;
    let reload = MenuItemBuilder::new("Reload Vault")
        .id(VAULT_RELOAD)
        .build(app)?;
    let repair = MenuItemBuilder::new("Repair Vault")
        .id(VAULT_REPAIR)
        .build(app)?;

    Ok(SubmenuBuilder::new(app, "Vault")
        .item(&open_vault)
        .item(&remove_vault)
        .item(&restore_getting_started)
        .separator()
        .item(&new_theme)
        .item(&restore_default_themes)
        .separator()
        .item(&commit_push)
        .item(&resolve_conflicts)
        .item(&view_changes)
        .separator()
        .item(&reindex)
        .item(&reload)
        .item(&repair)
        .item(&install_mcp)
        .build()?)
}

fn build_window_menu(app: &App) -> MenuResult {
    Ok(SubmenuBuilder::new(app, "Window")
        .minimize()
        .maximize()
        .separator()
        .close_window()
        .build()?)
}

pub fn setup_menu(app: &App) -> Result<(), Box<dyn std::error::Error>> {
    let app_menu = build_app_menu(app)?;
    let file_menu = build_file_menu(app)?;
    let edit_menu = build_edit_menu(app)?;
    let view_menu = build_view_menu(app)?;
    let go_menu = build_go_menu(app)?;
    let note_menu = build_note_menu(app)?;
    let vault_menu = build_vault_menu(app)?;
    let window_menu = build_window_menu(app)?;

    let menu = MenuBuilder::new(app)
        .item(&app_menu)
        .item(&file_menu)
        .item(&edit_menu)
        .item(&view_menu)
        .item(&go_menu)
        .item(&note_menu)
        .item(&vault_menu)
        .item(&window_menu)
        .build()?;

    app.set_menu(menu)?;

    app.on_menu_event(|app_handle, event| {
        let id = event.id().0.as_str();
        if CUSTOM_IDS.contains(&id) {
            let _ = app_handle.emit("menu-event", id);
        }
    });

    Ok(())
}

fn set_items_enabled(app_handle: &AppHandle, ids: &[&str], enabled: bool) {
    let Some(menu) = app_handle.menu() else {
        return;
    };
    for id in ids {
        if let Some(MenuItemKind::MenuItem(mi)) = menu.get(*id) {
            let _ = mi.set_enabled(enabled);
        }
    }
}

/// Enable or disable menu items that depend on having an active note tab.
pub fn set_note_items_enabled(app_handle: &AppHandle, enabled: bool) {
    set_items_enabled(app_handle, NOTE_DEPENDENT_IDS, enabled);
}

/// Enable or disable menu items that depend on having uncommitted changes.
pub fn set_git_commit_items_enabled(app_handle: &AppHandle, enabled: bool) {
    set_items_enabled(app_handle, GIT_COMMIT_DEPENDENT_IDS, enabled);
}

/// Enable or disable menu items that depend on having merge conflicts.
pub fn set_git_conflict_items_enabled(app_handle: &AppHandle, enabled: bool) {
    set_items_enabled(app_handle, GIT_CONFLICT_DEPENDENT_IDS, enabled);
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn custom_ids_include_all_constants() {
        let expected = [
            APP_SETTINGS,
            APP_CHECK_FOR_UPDATES,
            FILE_NEW_NOTE,
            FILE_NEW_TYPE,
            FILE_DAILY_NOTE,
            FILE_QUICK_OPEN,
            FILE_SAVE,
            FILE_CLOSE_TAB,
            EDIT_FIND_IN_VAULT,
            EDIT_TOGGLE_RAW_EDITOR,
            EDIT_TOGGLE_DIFF,
            VIEW_EDITOR_ONLY,
            VIEW_EDITOR_LIST,
            VIEW_ALL,
            VIEW_TOGGLE_PROPERTIES,
            VIEW_TOGGLE_AI_CHAT,
            VIEW_TOGGLE_BACKLINKS,
            VIEW_COMMAND_PALETTE,
            VIEW_ZOOM_IN,
            VIEW_ZOOM_OUT,
            VIEW_ZOOM_RESET,
            VIEW_GO_BACK,
            VIEW_GO_FORWARD,
            GO_ALL_NOTES,
            GO_ARCHIVED,
            GO_TRASH,
            GO_CHANGES,
            NOTE_ARCHIVE,
            NOTE_TRASH,
            NOTE_EMPTY_TRASH,
            VAULT_OPEN,
            VAULT_REMOVE,
            VAULT_RESTORE_GETTING_STARTED,
            VAULT_NEW_THEME,
            VAULT_RESTORE_DEFAULT_THEMES,
            VAULT_COMMIT_PUSH,
            VAULT_RESOLVE_CONFLICTS,
            VAULT_VIEW_CHANGES,
            VAULT_INSTALL_MCP,
            VAULT_REINDEX,
            VAULT_RELOAD,
        ];
        for id in &expected {
            assert!(CUSTOM_IDS.contains(id), "missing custom ID: {id}");
        }
    }

    #[test]
    fn note_dependent_ids_are_subset_of_custom_ids() {
        for id in NOTE_DEPENDENT_IDS {
            assert!(
                CUSTOM_IDS.contains(id),
                "note-dependent ID {id} not in CUSTOM_IDS"
            );
        }
    }

    #[test]
    fn git_dependent_ids_are_subset_of_custom_ids() {
        for id in GIT_COMMIT_DEPENDENT_IDS {
            assert!(
                CUSTOM_IDS.contains(id),
                "git-commit-dependent ID {id} not in CUSTOM_IDS"
            );
        }
        for id in GIT_CONFLICT_DEPENDENT_IDS {
            assert!(
                CUSTOM_IDS.contains(id),
                "git-conflict-dependent ID {id} not in CUSTOM_IDS"
            );
        }
    }

    #[test]
    fn no_duplicate_custom_ids() {
        let mut seen = std::collections::HashSet::new();
        for id in CUSTOM_IDS {
            assert!(seen.insert(id), "duplicate custom ID: {id}");
        }
    }
}
