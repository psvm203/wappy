use tauri::{Manager, PhysicalPosition, PhysicalSize, WebviewWindow, WindowEvent};

fn place_desktop(sidebar: &WebviewWindow) -> tauri::Result<()> {
    let monitor = sidebar.current_monitor()?.or(sidebar.primary_monitor()?);
    if let (Some(monitor), Some(desktop)) =
        (monitor, sidebar.app_handle().get_webview_window("desktop"))
    {
        let area = monitor.work_area();
        if desktop.inner_size()? != area.size {
            desktop.set_size(area.size)?;
        }
        if desktop.outer_position()? != area.position {
            desktop.set_position(area.position)?;
        }
    }
    Ok(())
}

fn place_sidebar(window: &WebviewWindow, compact: bool) -> tauri::Result<()> {
    let monitor = window.current_monitor()?.or(window.primary_monitor()?);
    if let Some(monitor) = monitor {
        let area = monitor.work_area();
        let scale = monitor.scale_factor();
        let margin = (12.0 * scale).round() as u32;
        let width = ((if compact { 72.0 } else { 320.0 }) * scale).round() as u32;
        let height = (760.0 * scale).round() as u32;
        let width = width.min(area.size.width.saturating_sub(margin * 2)).max(1);
        let height = height
            .min(area.size.height.saturating_sub(margin * 2))
            .max(1);
        window.set_size(PhysicalSize::new(width, height))?;
        window.set_position(PhysicalPosition::new(
            area.position.x + area.size.width as i32 - width as i32 - margin as i32,
            area.position.y + (area.size.height as i32 - height as i32) / 2,
        ))?;
    }
    Ok(())
}

#[tauri::command]
fn set_sidebar_compact(window: WebviewWindow, compact: bool) -> Result<(), String> {
    place_sidebar(&window, compact).map_err(|error| error.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            if let Some(window) = app.get_webview_window("main") {
                place_sidebar(&window, false)?;
                if let Some(desktop) = app.get_webview_window("desktop") {
                    // The entire desktop surface must pass clicks through to other apps.
                    desktop.set_ignore_cursor_events(true)?;
                    place_desktop(&window)?;
                    desktop.show()?;
                }
                window.show()?;
            }
            Ok(())
        })
        .on_window_event(|window, event| {
            if window.label() != "main" {
                return;
            }
            match event {
                WindowEvent::Destroyed => window.app_handle().exit(0),
                WindowEvent::Moved(_) | WindowEvent::ScaleFactorChanged { .. } => {
                    if let Some(sidebar) = window.app_handle().get_webview_window("main") {
                        if let Err(error) = place_desktop(&sidebar) {
                            eprintln!("Could not position desktop characters: {error}");
                        }
                    }
                }
                _ => {}
            }
        })
        .invoke_handler(tauri::generate_handler![set_sidebar_compact])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
