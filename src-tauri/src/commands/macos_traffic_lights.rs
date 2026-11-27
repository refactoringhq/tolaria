use serde::Deserialize;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TrafficLightHeader {
    center_x: f64,
    top: f64,
    height: f64,
}

fn parent_of_view(
    ancestor: objc2::rc::Retained<objc2_app_kit::NSView>,
    view: &objc2_app_kit::NSView,
) -> Option<objc2::rc::Retained<objc2_app_kit::NSView>> {
    let child = ancestor
        .subviews()
        .iter()
        .find(|child| view.isDescendantOf(child))?;
    if std::ptr::eq(&*child, view) {
        return Some(ancestor);
    }
    parent_of_view(child, view)
}

fn position_traffic_light_buttons(
    buttons: [objc2::rc::Retained<objc2_app_kit::NSButton>; 3],
    first_center: objc2_foundation::NSPoint,
) {
    let spacing = buttons[1].frame().origin.x - buttons[0].frame().origin.x;
    for (index, button) in buttons.into_iter().enumerate() {
        let frame = button.frame();
        let origin = objc2_foundation::NSPoint::new(
            first_center.x + index as f64 * spacing - frame.size.width / 2.0,
            first_center.y - frame.size.height / 2.0,
        );
        if origin != frame.origin {
            button.setFrameOrigin(origin);
        }
    }
}

fn position_macos_traffic_lights(
    window: &objc2_app_kit::NSWindow,
    header: TrafficLightHeader,
) -> Option<()> {
    use objc2_app_kit::NSWindowButton;
    use objc2_foundation::NSPoint;

    let close = window.standardWindowButton(NSWindowButton::CloseButton)?;
    let minimize = window.standardWindowButton(NSWindowButton::MiniaturizeButton)?;
    let zoom = window.standardWindowButton(NSWindowButton::ZoomButton)?;
    let button_group = close.ancestorSharedWithView(&minimize)?;
    // Start at the common window ancestor and follow retained children into the title bar.
    let content = window.contentView()?;
    let window_root = button_group.ancestorSharedWithView(&content)?;
    let title_bar = parent_of_view(window_root, &button_group)?;
    let window_height = window.frame().size.height;
    let distance_from_top = header.top + header.height / 2.0;
    position_title_bar(
        &title_bar,
        window_height,
        distance_from_top,
        close.frame().size.height,
    );

    let first_center = button_group.convertPoint_fromView(
        NSPoint::new(header.center_x, window_height - distance_from_top),
        None,
    );
    position_traffic_light_buttons([close, minimize, zoom], first_center);
    Some(())
}

fn position_title_bar(
    title_bar: &objc2_app_kit::NSView,
    window_height: f64,
    distance_from_top: f64,
    close_button_height: f64,
) {
    // Keep the overlay large enough to display and hit-test the native buttons.
    let mut frame = title_bar.frame();
    frame.size.height = distance_from_top + close_button_height / 2.0 + 4.0;
    frame.origin.y = window_height - frame.size.height;
    if title_bar.frame() != frame {
        title_bar.setFrame(frame);
    }
}

fn retained_macos_window(
    window: &tauri::Window,
) -> Option<objc2::rc::Retained<objc2_app_kit::NSWindow>> {
    let thread = objc2::MainThreadMarker::new()?;
    let handle = window.ns_window().ok()?.cast::<objc2_app_kit::NSWindow>();
    objc2_app_kit::NSApplication::sharedApplication(thread)
        .windows()
        .iter()
        .find(|window| std::ptr::eq(&**window, handle))
        .filter(|window| {
            !window
                .styleMask()
                .contains(objc2_app_kit::NSWindowStyleMask::FullScreen)
        })
}

#[tauri::command]
pub fn update_macos_traffic_light_position(
    window: tauri::Window,
    header: TrafficLightHeader,
) -> Result<(), String> {
    let coordinates = [header.center_x, header.top];
    if !coordinates
        .iter()
        .all(|origin| (0.0..=100.0).contains(origin))
    {
        return Err("Invalid window header coordinates".to_string());
    }
    if !(1.0..=100.0).contains(&header.height) {
        return Err("Invalid window header height".to_string());
    }
    let current_window = window.clone();
    window
        .run_on_main_thread(move || {
            if let Some(native_window) = retained_macos_window(&current_window) {
                position_macos_traffic_lights(&native_window, header);
            }
        })
        .map_err(|error| error.to_string())
}
