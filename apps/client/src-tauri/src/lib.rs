use tauri::{Manager, PhysicalPosition, PhysicalSize, WebviewWindow};

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
                window.show()?;
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![set_sidebar_compact])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
