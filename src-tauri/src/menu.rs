use tauri::{
    menu::{MenuBuilder, MenuItemBuilder, PredefinedMenuItem, SubmenuBuilder},
    App, Emitter,
};

const VIEW_ITEMS: [(&str, &str, &str); 3] = [
    ("view-editor-only", "Editor Only", "CmdOrCtrl+1"),
    ("view-editor-list", "Editor + Notes", "CmdOrCtrl+2"),
    ("view-all", "All Panels", "CmdOrCtrl+3"),
];

pub fn setup_menu(app: &App) -> Result<(), Box<dyn std::error::Error>> {
    let edit_submenu = SubmenuBuilder::new(app, "Edit")
        .item(&PredefinedMenuItem::undo(app, Some("Undo"))?)
        .item(&PredefinedMenuItem::redo(app, Some("Redo"))?)
        .separator()
        .item(&PredefinedMenuItem::cut(app, Some("Cut"))?)
        .item(&PredefinedMenuItem::copy(app, Some("Copy"))?)
        .item(&PredefinedMenuItem::paste(app, Some("Paste"))?)
        .item(&PredefinedMenuItem::select_all(app, Some("Select All"))?)
        .build()?;

    let mut view_menu = SubmenuBuilder::new(app, "View");
    for (id, label, accel) in &VIEW_ITEMS {
        let item = MenuItemBuilder::new(*label)
            .id(*id)
            .accelerator(*accel)
            .build(app)?;
        view_menu = view_menu.item(&item);
    }
    let view_submenu = view_menu.build()?;

    let menu = MenuBuilder::new(app)
        .item(&edit_submenu)
        .item(&view_submenu)
        .build()?;

    app.set_menu(menu)?;

    app.on_menu_event(|app_handle, event| {
        let id = event.id().0.as_str();
        if id.starts_with("view-") {
            let _ = app_handle.emit("menu-event", id);
        }
    });

    Ok(())
}
