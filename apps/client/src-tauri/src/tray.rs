use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::TrayIconBuilder,
    App, AppHandle, Emitter, Manager, WebviewWindow,
};

const CONTROL_EVENT: &str = "wappy:tray-control";

struct TrayControls {
    motion: MenuItem<tauri::Wry>,
    visibility: MenuItem<tauri::Wry>,
}

pub fn show_sidebar(app: &AppHandle) -> tauri::Result<()> {
    if let Some(window) = app.get_webview_window("main") {
        window.show()?;
        window.unminimize()?;
        window.set_focus()?;
    }
    Ok(())
}

#[tauri::command]
pub fn open_sidebar(window: WebviewWindow) -> Result<(), String> {
    if window.label() != "main" {
        return Err("Only the sidebar can open itself".into());
    }
    show_sidebar(window.app_handle()).map_err(|error| error.to_string())
}

pub fn setup(app: &App) -> tauri::Result<()> {
    let show = MenuItem::with_id(app, "wappy-show", "사이드바 열기", true, None::<&str>)?;
    // Enable controls only after the sidebar has registered its event listener.
    let motion = MenuItem::with_id(app, "wappy-motion", "잠깐 쉬기", false, None::<&str>)?;
    let visibility = MenuItem::with_id(
        app,
        "wappy-visibility",
        "캐릭터 숨기기",
        false,
        None::<&str>,
    )?;
    let quit = MenuItem::with_id(app, "wappy-quit", "Wappy 종료", true, None::<&str>)?;
    let separator = PredefinedMenuItem::separator(app)?;
    let menu = Menu::with_items(app, &[&show, &motion, &visibility, &separator, &quit])?;
    let icon = app
        .default_window_icon()
        .cloned()
        .ok_or_else(|| tauri::Error::Io(std::io::Error::other("The Wappy tray icon is missing")))?;
    TrayIconBuilder::with_id("wappy")
        .icon(icon)
        .tooltip("Wappy — 친구들과 함께")
        .menu(&menu)
        .show_menu_on_left_click(true)
        .on_menu_event(|app, event| {
            let result = match event.id.as_ref() {
                "wappy-show" => show_sidebar(app),
                "wappy-motion" => app.emit_to("main", CONTROL_EVENT, "toggle-paused"),
                "wappy-visibility" => app.emit_to("main", CONTROL_EVENT, "toggle-visible"),
                "wappy-quit" => {
                    app.exit(0);
                    Ok(())
                }
                _ => Ok(()),
            };
            if let Err(error) = result {
                eprintln!("Could not handle Wappy tray action: {error}");
            }
        })
        .build(app)?;
    app.manage(TrayControls { motion, visibility });
    Ok(())
}

#[tauri::command]
pub fn sync_tray_controls(
    window: WebviewWindow,
    paused: bool,
    visible: bool,
) -> Result<(), String> {
    if window.label() != "main" {
        return Err("Only the sidebar can update tray controls".into());
    }
    let controls = window.state::<TrayControls>();
    let update = || -> tauri::Result<()> {
        controls.motion.set_text(if paused {
            "다시 걷기"
        } else {
            "잠깐 쉬기"
        })?;
        controls.visibility.set_text(if visible {
            "캐릭터 숨기기"
        } else {
            "캐릭터 표시"
        })?;
        controls.motion.set_enabled(true)?;
        controls.visibility.set_enabled(true)?;
        Ok(())
    };
    update().map_err(|error| error.to_string())
}
