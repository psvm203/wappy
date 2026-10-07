use tauri::{Manager, PhysicalPosition, PhysicalSize, WebviewWindow, WindowEvent};

fn raise_desktop(desktop: &WebviewWindow) -> tauri::Result<()> {
    #[cfg(target_os = "macos")]
    return desktop.with_webview(|webview| unsafe {
        // Tauri runs this closure on the main thread; the native window is alive here.
        let window = &*webview.ns_window().cast::<objc2_app_kit::NSWindow>();
        window.orderFrontRegardless();
    });
    #[cfg(windows)]
    {
        use windows::Win32::UI::WindowsAndMessaging::{
            SetWindowPos, HWND_TOPMOST, SWP_ASYNCWINDOWPOS, SWP_NOACTIVATE, SWP_NOMOVE, SWP_NOSIZE,
        };
        // Reapply the native z-order even when Tauri's always-on-top flag is unchanged.
        return unsafe {
            SetWindowPos(
                desktop.hwnd()?,
                Some(HWND_TOPMOST),
                0,
                0,
                0,
                0,
                SWP_ASYNCWINDOWPOS | SWP_NOACTIVATE | SWP_NOMOVE | SWP_NOSIZE,
            )
        }
        .map_err(|error| tauri::Error::Io(std::io::Error::other(error.to_string())));
    }
    #[cfg(not(any(target_os = "macos", windows)))]
    desktop.set_always_on_top(true)
}

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

#[tauri::command]
fn set_sidebar_pinned(window: WebviewWindow, pinned: bool) -> Result<(), String> {
    window
        .set_always_on_top(pinned)
        .map_err(|error| error.to_string())?;
    if let Some(desktop) = window.app_handle().get_webview_window("desktop") {
        raise_desktop(&desktop).map_err(|error| error.to_string())?;
    }
    Ok(())
}

#[tauri::command]
fn desktop_cursor_position(window: WebviewWindow) -> Result<(f64, f64), String> {
    if window.label() != "desktop" {
        return Err("Only the character window can track the cursor".into());
    }
    let cursor = window
        .cursor_position()
        .map_err(|error| error.to_string())?;
    let origin = window.inner_position().map_err(|error| error.to_string())?;
    let scale = window.scale_factor().map_err(|error| error.to_string())?;
    Ok((
        (cursor.x - origin.x as f64) / scale,
        (cursor.y - origin.y as f64) / scale,
    ))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            if let Some(window) = app.get_webview_window("main") {
                place_sidebar(&window, false)?;
                window.show()?;
                if let Some(desktop) = app.get_webview_window("desktop") {
                    // Start click-through; the character view enables input only on pets.
                    desktop.set_ignore_cursor_events(true)?;
                    place_desktop(&window)?;
                    desktop.show()?;
                    #[cfg(target_os = "macos")]
                    desktop.with_webview(|webview| unsafe {
                        let window = &*webview.ns_window().cast::<objc2_app_kit::NSWindow>();
                        // One level above Tauri's floating sidebar, without taking focus.
                        window.setLevel(window.level() + 1);
                        window.orderFrontRegardless();
                    })?;
                    #[cfg(not(target_os = "macos"))]
                    raise_desktop(&desktop)?;
                }
            }
            Ok(())
        })
        .on_window_event(|window, event| {
            if window.label() != "main" {
                return;
            }
            match event {
                WindowEvent::Destroyed => window.app_handle().exit(0),
                WindowEvent::Moved(_)
                | WindowEvent::ScaleFactorChanged { .. }
                | WindowEvent::Focused(true) => {
                    if let Some(sidebar) = window.app_handle().get_webview_window("main") {
                        if let Err(error) = place_desktop(&sidebar) {
                            eprintln!("Could not position desktop characters: {error}");
                        }
                    }
                    if let Some(desktop) = window.app_handle().get_webview_window("desktop") {
                        if let Err(error) = raise_desktop(&desktop) {
                            eprintln!("Could not raise desktop characters: {error}");
                        }
                    }
                }
                _ => {}
            }
        })
        .invoke_handler(tauri::generate_handler![
            set_sidebar_compact,
            set_sidebar_pinned,
            desktop_cursor_position
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
