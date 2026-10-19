use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::TrayIconBuilder,
    App, AppHandle, Emitter, Manager, WebviewWindow,
};

const CONTROL_EVENT: &str = "wappy:tray-control";

struct TrayControls {
    visibility: MenuItem<tauri::Wry>,
    settings: MenuItem<tauri::Wry>,
}

#[tauri::command]
pub fn minimize_sidebar(window: WebviewWindow) -> Result<(), String> {
    if window.label() != "main" {
        return Err("Only the sidebar can minimize itself".into());
    }
    #[cfg(windows)]
    let result = window.hide();
    #[cfg(not(windows))]
    let result = window.minimize();
    result.map_err(|error| error.to_string())
}

pub fn show_sidebar(app: &AppHandle) -> tauri::Result<()> {
    if let Some(window) = app.get_webview_window("main") {
        window.show()?;
        window.unminimize()?;
        window.set_focus()?;
        #[cfg(target_os = "macos")]
        window.with_webview(|webview| unsafe {
            // Raise an inactive app's sidebar explicitly, without making it always-on-top.
            let window = &*webview.ns_window().cast::<objc2_app_kit::NSWindow>();
            window.orderFrontRegardless();
        })?;
    }
    Ok(())
}

pub fn show_settings(app: &AppHandle) -> tauri::Result<()> {
    show_sidebar(app)?;
    app.emit_to("main", CONTROL_EVENT, "open-settings")
}

pub fn setup(app: &App) -> tauri::Result<()> {
    let show = MenuItem::with_id(app, "wappy-show", "Wappy 열기", true, None::<&str>)?;
    // Enable controls only after the sidebar has registered its event listener.
    let visibility = MenuItem::with_id(
        app,
        "wappy-visibility",
        "캐릭터 숨기기",
        false,
        None::<&str>,
    )?;
    let settings = MenuItem::with_id(app, "wappy-settings", "환경설정", false, None::<&str>)?;
    #[cfg(target_os = "macos")]
    {
        settings.set_accelerator(Some("Cmd+,"))?;
        let app_menu = Menu::default(app.handle())?;
        if let Some(tauri::menu::MenuItemKind::Submenu(menu)) = app_menu.items()?.first() {
            // Share the item so readiness and actions match the tray menu.
            menu.insert_items(&[&settings, &PredefinedMenuItem::separator(app)?], 2)?;
        }
        app.set_menu(app_menu)?;
    }
    let quit = MenuItem::with_id(app, "wappy-quit", "Wappy 종료", true, None::<&str>)?;
    let separator = PredefinedMenuItem::separator(app)?;
    let menu = Menu::with_items(app, &[&show, &visibility, &settings, &separator, &quit])?;
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
                "wappy-visibility" => app.emit_to("main", CONTROL_EVENT, "toggle-visible"),
                "wappy-settings" => show_settings(app),
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
    app.manage(TrayControls {
        visibility,
        settings,
    });
    Ok(())
}

#[tauri::command]
pub fn sync_tray_controls(window: WebviewWindow, visible: bool) -> Result<(), String> {
    if window.label() != "main" {
        return Err("Only the sidebar can update tray controls".into());
    }
    let controls = window.state::<TrayControls>();
    let update = || -> tauri::Result<()> {
        controls.visibility.set_text(if visible {
            "캐릭터 숨기기"
        } else {
            "캐릭터 표시"
        })?;
        controls.visibility.set_enabled(true)?;
        controls.settings.set_enabled(true)?;
        Ok(())
    };
    update().map_err(|error| error.to_string())
}
