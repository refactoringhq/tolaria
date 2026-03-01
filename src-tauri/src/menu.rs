use tauri::{
    menu::{MenuBuilder, MenuItemBuilder, MenuItemKind, Submenu, SubmenuBuilder},
    App, AppHandle, Emitter,
};

// Custom menu item IDs that emit events to the frontend.
const APP_SETTINGS: &str = "app-settings";
const FILE_NEW_NOTE: &str = "file-new-note";
const FILE_QUICK_OPEN: &str = "file-quick-open";
const FILE_SAVE: &str = "file-save";
const FILE_CLOSE_TAB: &str = "file-close-tab";
const VIEW_EDITOR_ONLY: &str = "view-editor-only";
const VIEW_EDITOR_LIST: &str = "view-editor-list";
const VIEW_ALL: &str = "view-all";
const VIEW_TOGGLE_INSPECTOR: &str = "view-toggle-inspector";
const VIEW_COMMAND_PALETTE: &str = "view-command-palette";
const VIEW_ZOOM_IN: &str = "view-zoom-in";
const VIEW_ZOOM_OUT: &str = "view-zoom-out";
const VIEW_ZOOM_RESET: &str = "view-zoom-reset";
const NOTE_ARCHIVE: &str = "note-archive";
const NOTE_TRASH: &str = "note-trash";
const EDIT_FIND_IN_VAULT: &str = "edit-find-in-vault";
const VIEW_GO_BACK: &str = "view-go-back";
const VIEW_GO_FORWARD: &str = "view-go-forward";

const CUSTOM_IDS: &[&str] = &[
    APP_SETTINGS,
    FILE_NEW_NOTE,
    FILE_QUICK_OPEN,
    FILE_SAVE,
    FILE_CLOSE_TAB,
    NOTE_ARCHIVE,
    NOTE_TRASH,
    EDIT_FIND_IN_VAULT,
    VIEW_EDITOR_ONLY,
    VIEW_EDITOR_LIST,
    VIEW_ALL,
    VIEW_TOGGLE_INSPECTOR,
    VIEW_COMMAND_PALETTE,
    VIEW_ZOOM_IN,
    VIEW_ZOOM_OUT,
    VIEW_ZOOM_RESET,
    VIEW_GO_BACK,
    VIEW_GO_FORWARD,
];

/// IDs of menu items that should be disabled when no note tab is active.
const NOTE_DEPENDENT_IDS: &[&str] = &[FILE_SAVE, FILE_CLOSE_TAB, NOTE_ARCHIVE, NOTE_TRASH];

type MenuResult = Result<Submenu<tauri::Wry>, Box<dyn std::error::Error>>;

fn build_app_menu(app: &App) -> MenuResult {
    let settings_item = MenuItemBuilder::new("Settings...")
        .id(APP_SETTINGS)
        .accelerator("CmdOrCtrl+,")
        .build(app)?;

    Ok(SubmenuBuilder::new(app, "Laputa")
        .about(None)
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
    let archive_note = MenuItemBuilder::new("Archive Note")
        .id(NOTE_ARCHIVE)
        .accelerator("CmdOrCtrl+E")
        .build(app)?;
    let trash_note = MenuItemBuilder::new("Trash Note")
        .id(NOTE_TRASH)
        .accelerator("CmdOrCtrl+Backspace")
        .build(app)?;

    Ok(SubmenuBuilder::new(app, "File")
        .item(&new_note)
        .item(&quick_open)
        .separator()
        .item(&save)
        .separator()
        .item(&archive_note)
        .item(&trash_note)
        .separator()
        .item(&close_tab)
        .build()?)
}

fn build_edit_menu(app: &App) -> MenuResult {
    let find_in_vault = MenuItemBuilder::new("Find in Vault")
        .id(EDIT_FIND_IN_VAULT)
        .accelerator("CmdOrCtrl+Shift+F")
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
    let toggle_inspector = MenuItemBuilder::new("Toggle Inspector")
        .id(VIEW_TOGGLE_INSPECTOR)
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
    let go_back = MenuItemBuilder::new("Go Back")
        .id(VIEW_GO_BACK)
        .accelerator("CmdOrCtrl+[")
        .build(app)?;
    let go_forward = MenuItemBuilder::new("Go Forward")
        .id(VIEW_GO_FORWARD)
        .accelerator("CmdOrCtrl+]")
        .build(app)?;

    Ok(SubmenuBuilder::new(app, "View")
        .item(&editor_only)
        .item(&editor_list)
        .item(&all_panels)
        .separator()
        .item(&toggle_inspector)
        .separator()
        .item(&go_back)
        .item(&go_forward)
        .separator()
        .item(&zoom_in)
        .item(&zoom_out)
        .item(&zoom_reset)
        .separator()
        .item(&command_palette)
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
    let window_menu = build_window_menu(app)?;

    let menu = MenuBuilder::new(app)
        .item(&app_menu)
        .item(&file_menu)
        .item(&edit_menu)
        .item(&view_menu)
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

/// Enable or disable menu items that depend on having an active note tab.
pub fn set_note_items_enabled(app_handle: &AppHandle, enabled: bool) {
    let Some(menu) = app_handle.menu() else {
        return;
    };
    for id in NOTE_DEPENDENT_IDS {
        if let Some(MenuItemKind::MenuItem(mi)) = menu.get(*id) {
            let _ = mi.set_enabled(enabled);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn custom_ids_include_all_expected_items() {
        let expected = [
            "app-settings",
            "file-new-note",
            "file-quick-open",
            "file-save",
            "file-close-tab",
            "note-archive",
            "note-trash",
            "edit-find-in-vault",
            "view-editor-only",
            "view-editor-list",
            "view-all",
            "view-toggle-inspector",
            "view-command-palette",
            "view-zoom-in",
            "view-zoom-out",
            "view-zoom-reset",
            "view-go-back",
            "view-go-forward",
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
}
