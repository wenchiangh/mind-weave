use tauri::{
    image::Image,
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    ActivationPolicy, Manager, PhysicalPosition, Position, Rect, WebviewWindow, WindowEvent,
};

const PANEL_TOP_GAP: f64 = 8.0;
const TRAY_ICON_RGBA: &[u8] = include_bytes!("../icons/tray-template.rgba");

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            app.set_activation_policy(ActivationPolicy::Accessory);

            let show_panel =
                MenuItem::with_id(app, "show-panel", "Show Panel", true, None::<&str>)?;
            let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show_panel, &quit])?;

            TrayIconBuilder::new()
                .tooltip("MindWeave")
                .icon(load_tray_icon())
                .icon_as_template(true)
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        rect,
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        toggle_panel_window(tray.app_handle(), Some(rect));
                    }
                })
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "show-panel" => toggle_panel_window(app, None),
                    "quit" => app.exit(0),
                    _ => {}
                })
                .build(app)?;

            Ok(())
        })
        .on_window_event(|window, event| {
            if matches!(event, WindowEvent::Focused(false)) {
                hide_panel_window(window.app_handle());
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running MindWeave macOS shell");
}

fn load_tray_icon() -> Image<'static> {
    Image::new(TRAY_ICON_RGBA, 32, 32)
}

fn toggle_panel_window(app: &tauri::AppHandle, tray_rect: Option<Rect>) {
    if let Some(window) = app.get_webview_window("main") {
        if window.is_visible().unwrap_or(false) {
            let _ = window.hide();
            return;
        }

        if let Some(tray_rect) = tray_rect {
            position_panel_window(&window, tray_rect);
        }

        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
}

fn hide_panel_window(app: &tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.hide();
    }
}

fn position_panel_window(window: &WebviewWindow, tray_rect: Rect) {
    let Ok(panel_size) = window.outer_size() else {
        return;
    };

    let scale_factor = window.scale_factor().unwrap_or(1.0);
    let tray_position = tray_rect.position.to_physical::<f64>(scale_factor);
    let tray_size = tray_rect.size.to_physical::<f64>(scale_factor);

    let anchor_x = tray_position.x + tray_size.width / 2.0;
    let desired_x = anchor_x - f64::from(panel_size.width) / 2.0;
    let desired_y = tray_position.y + tray_size.height + PANEL_TOP_GAP;

    let monitor = window
        .app_handle()
        .monitor_from_point(anchor_x, tray_position.y)
        .ok()
        .flatten()
        .or_else(|| window.current_monitor().ok().flatten());

    let (x, y) = if let Some(monitor) = monitor {
        let work_area = monitor.work_area();
        let min_x = f64::from(work_area.position.x);
        let min_y = f64::from(work_area.position.y);
        let max_x = min_x + f64::from(work_area.size.width.saturating_sub(panel_size.width));
        let max_y = min_y + f64::from(work_area.size.height.saturating_sub(panel_size.height));

        (desired_x.clamp(min_x, max_x), desired_y.clamp(min_y, max_y))
    } else {
        (desired_x, desired_y)
    };

    let _ = window.set_position(Position::Physical(PhysicalPosition::new(
        x.round() as i32,
        y.round() as i32,
    )));
}
