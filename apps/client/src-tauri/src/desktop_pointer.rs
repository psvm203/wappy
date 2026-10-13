use tauri::WebviewWindow;

#[tauri::command]
pub async fn desktop_window_at_cursor(window: WebviewWindow) -> Result<bool, String> {
    if window.label() != "desktop" {
        return Err("Only the character window can check pointer input".into());
    }
    window_at_cursor(&window).await
}

#[cfg(target_os = "macos")]
async fn window_at_cursor(window: &WebviewWindow) -> Result<bool, String> {
    use objc2::MainThreadOnly;
    use objc2_app_kit::{NSEvent, NSWindow};
    use objc2_core_graphics::{CGWindowListCopyWindowInfo, CGWindowListOption};

    let (send, mut receive) = tauri::async_runtime::channel(1);
    window
        .with_webview(move |webview| {
            // AppKit hit-testing runs on the main thread and uses its own screen
            // coordinates, including mixed-scale displays and transparent windows.
            let native = unsafe { &*webview.ns_window().cast::<NSWindow>() };
            let number = NSWindow::windowNumberAtPoint_belowWindowWithWindowNumber(
                NSEvent::mouseLocation(),
                native.windowNumber(),
                native.mtm(),
            );
            let hit = if number <= 0 {
                Ok(false)
            } else {
                // Wallpaper and desktop icons should not disable character input.
                CGWindowListCopyWindowInfo(
                    CGWindowListOption::OptionIncludingWindow
                        | CGWindowListOption::ExcludeDesktopElements,
                    number as u32,
                )
                .map(|windows| !windows.is_empty())
                .ok_or_else(|| "Could not inspect the window under the cursor".to_string())
            };
            let _ = send.try_send(hit);
        })
        .map_err(|error| error.to_string())?;
    receive
        .recv()
        .await
        .ok_or("Character window closed during pointer tracking")?
}

#[cfg(windows)]
async fn window_at_cursor(window: &WebviewWindow) -> Result<bool, String> {
    use windows::core::BOOL;
    use windows::Win32::{
        Foundation::{HWND, LPARAM, RECT},
        Graphics::Dwm::{DwmGetWindowAttribute, DWMWA_CLOAKED},
        UI::WindowsAndMessaging::{
            EnumWindows, GetClassNameW, GetWindowLongPtrW, GetWindowRect, IsIconic,
            IsWindowVisible, GWL_EXSTYLE, WS_EX_TRANSPARENT,
        },
    };

    struct HitTest {
        overlay: HWND,
        cursor: tauri::PhysicalPosition<f64>,
        hit: bool,
    }

    unsafe extern "system" fn inspect(hwnd: HWND, data: LPARAM) -> BOOL {
        // EnumWindows invokes this synchronously while HitTest remains alive.
        let state = &mut *(data.0 as *mut HitTest);
        if hwnd == state.overlay
            || !IsWindowVisible(hwnd).as_bool()
            || IsIconic(hwnd).as_bool()
            || GetWindowLongPtrW(hwnd, GWL_EXSTYLE) as u32 & WS_EX_TRANSPARENT.0 != 0
        {
            return true.into();
        }
        let mut cloaked = 0u32;
        let _ = DwmGetWindowAttribute(
            hwnd,
            DWMWA_CLOAKED,
            (&mut cloaked as *mut u32).cast(),
            std::mem::size_of_val(&cloaked) as u32,
        );
        let mut class = [0u16; 256];
        let length = GetClassNameW(hwnd, &mut class) as usize;
        let class = String::from_utf16_lossy(&class[..length]);
        if cloaked != 0 || matches!(class.as_str(), "Progman" | "WorkerW") {
            return true.into();
        }
        let mut rect = RECT::default();
        // ponytail: prioritize the whole app window; control-level hit-testing
        // would require UI Automation and support from each underlying app.
        if GetWindowRect(hwnd, &mut rect).is_ok()
            && state.cursor.x >= rect.left as f64
            && state.cursor.x < rect.right as f64
            && state.cursor.y >= rect.top as f64
            && state.cursor.y < rect.bottom as f64
        {
            state.hit = true;
            return false.into();
        }
        true.into()
    }

    let mut state = HitTest {
        overlay: window.hwnd().map_err(|error| error.to_string())?,
        cursor: window
            .cursor_position()
            .map_err(|error| error.to_string())?,
        hit: false,
    };
    let result =
        unsafe { EnumWindows(Some(inspect), LPARAM((&mut state as *mut HitTest) as isize)) };
    // Stopping enumeration after a hit also returns a Win32 error.
    if !state.hit {
        result.map_err(|error| error.to_string())?;
    }
    Ok(state.hit)
}

#[cfg(not(any(target_os = "macos", windows)))]
async fn window_at_cursor(_window: &WebviewWindow) -> Result<bool, String> {
    Ok(false)
}
