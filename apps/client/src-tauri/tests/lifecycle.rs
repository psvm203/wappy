//! Run on a desktop after building the frontend:
//! cargo test --test lifecycle --features tauri/custom-protocol
//! Uses private browsing so the check cannot read or change a real profile.
use client_lib::startup::Startup;
use std::{
    io::{BufRead, BufReader, Write},
    net::TcpListener,
    process::Command,
    sync::{
        atomic::{AtomicBool, Ordering},
        mpsc::{self, Receiver},
        Arc,
    },
    thread,
    time::{Duration, Instant},
};
use tauri::{AppHandle, Emitter, Listener, Manager};

struct StartupCleanup(Startup);
impl Drop for StartupCleanup {
    fn drop(&mut self) {
        if let Err(error) = self.0.set_enabled(false) {
            eprintln!("Could not remove the smoke check startup entry: {error}");
        }
    }
}

fn secondary_launch(app: &AppHandle, autostart: bool) -> Result<(), String> {
    let mut command = Command::new(std::env::current_exe().map_err(|error| error.to_string())?);
    command
        .arg("--secondary")
        .env("WAPPY_LIFECYCLE_ID", &app.config().identifier);
    if autostart {
        command.arg("--autostart");
    }
    let mut child = command.spawn().map_err(|error| error.to_string())?;
    let mut status = None;
    if let Err(error) = until(|| {
        status = child.try_wait().ok().flatten();
        status.is_some()
    }) {
        let _ = child.kill();
        let _ = child.wait();
        return Err(format!("Second instance did not exit: {error}"));
    }
    if !status.is_some_and(|status| status.success()) {
        return Err("Second instance failed to hand over to the first".into());
    }
    Ok(())
}

fn until(mut check: impl FnMut() -> bool) -> Result<(), String> {
    let deadline = Instant::now() + Duration::from_secs(10);
    while Instant::now() < deadline {
        if check() {
            return Ok(());
        }
        thread::sleep(Duration::from_millis(50));
    }
    Err("Native window state did not change within 10 seconds".into())
}

fn snapshot(
    receiver: &Receiver<serde_json::Value>,
    matches: impl Fn(&serde_json::Value) -> bool,
) -> Result<serde_json::Value, String> {
    let deadline = Instant::now() + Duration::from_secs(10);
    loop {
        let value = receiver
            .recv_timeout(deadline.saturating_duration_since(Instant::now()))
            .map_err(|error| format!("Character state was not received: {error}"))?;
        if matches(&value) {
            return Ok(value);
        }
    }
}

fn click_button(sidebar: &tauri::WebviewWindow, label: &str) -> Result<(), String> {
    let label = serde_json::to_string(label).map_err(|error| error.to_string())?;
    sidebar
        .eval(format!(
            r#"(() => {{
      const click = () => {{
        const button = [...document.querySelectorAll('button,label')].find(button => {{
          const visible = button.cloneNode(true);
          visible.querySelectorAll('[aria-hidden="true"]').forEach(node => node.remove());
          return visible.textContent.trim() === {label} || button.getAttribute('aria-label') === {label};
        }});
        const control = button?.querySelector('input') || button;
        if (control && !control.disabled) {{ observer.disconnect(); control.click(); }}
      }};
      const observer = new MutationObserver(click);
      observer.observe(document.body, {{ childList: true, subtree: true, attributes: true }});
      click();
    }})()"#
        ))
        .map_err(|error| error.to_string())
}

fn text_rendered(
    window: &tauri::WebviewWindow,
    selector: &str,
    text: &str,
    present: bool,
) -> Result<(), String> {
    let selector = serde_json::to_string(selector).map_err(|error| error.to_string())?;
    let text = serde_json::to_string(text).map_err(|error| error.to_string())?;
    // Read directly through the native evaluation callback, without a temporary
    // event listener or the WebView timers disabled by this smoke check.
    let result = (|| -> Result<(), String> {
        // Keep delayed replies for this observation, isolated from later checks.
        let (sent, received) = mpsc::channel();
        let deadline = Instant::now() + Duration::from_secs(5);
        while Instant::now() < deadline {
            let sent = sent.clone();
            window
                .eval_with_callback(
                    format!(
                        r#"(() => {{
        const element = document.querySelector({selector});
        return !!element === {present} && (!element || element.textContent.includes({text}));
      }})()"#
                    ),
                    move |value| {
                        let _ = sent.send(value);
                    },
                )
                .map_err(|error| error.to_string())?;
            let wait =
                Duration::from_millis(250).min(deadline.saturating_duration_since(Instant::now()));
            match received.recv_timeout(wait) {
                Ok(value) => {
                    if serde_json::from_str::<bool>(&value).map_err(|error| error.to_string())? {
                        return Ok(());
                    }
                }
                Err(mpsc::RecvTimeoutError::Timeout) => continue,
                Err(error) => return Err(error.to_string()),
            }
            thread::sleep(Duration::from_millis(50));
        }
        Err("timed out after 5 seconds".into())
    })()
    .map_err(|error| {
        format!("Expected UI did not render ({selector}, text={text}, present={present}): {error}")
    });
    if result.is_err() {
        let (sent, received) = mpsc::channel();
        let _ = window.eval_with_callback(
            format!(
                r#"({{ focused: document.hasFocus(), visible: document.visibilityState,
            active: document.activeElement?.outerHTML.slice(0, 500),
            matched: document.querySelector({selector})?.outerHTML.slice(0, 500),
            friend: document.querySelector('.friend-card')?.outerHTML.slice(0, 500) }})"#
            ),
            move |value| {
                let _ = sent.send(value);
            },
        );
        eprintln!(
            "UI DIAGNOSTIC: native focused={:?}, visible={:?}, minimized={:?}; DOM={:?}",
            window.is_focused(),
            window.is_visible(),
            window.is_minimized(),
            received.recv_timeout(Duration::from_secs(2))
        );
    }
    result
}

fn set_activity(sidebar: &tauri::WebviewWindow, activity: &str) -> Result<(), String> {
    click_button(sidebar, "설정")?;
    text_rendered(sidebar, ".settings-panel", "캐릭터 활동", true)?;
    let activity = serde_json::to_string(activity).map_err(|error| error.to_string())?;
    sidebar
        .eval(format!(
            r#"(() => {{
            const label = [...document.querySelectorAll('.settings-panel label')]
                .find(label => label.textContent.includes('캐릭터 활동'));
            const select = label.querySelector('select');
            select.value = {activity};
            select.dispatchEvent(new Event('change', {{ bubbles: true }}));
        }})()"#
        ))
        .map_err(|error| error.to_string())
}

fn animation_frames(window: &tauri::WebviewWindow) -> Result<u64, String> {
    let (sent, received) = mpsc::channel();
    window
        .eval_with_callback("window.__wappyFrames", move |value| {
            let _ = sent.send(value);
        })
        .map_err(|error| error.to_string())?;
    let result = received
        .recv_timeout(Duration::from_secs(5))
        .map_err(|error| format!("Animation frame count was not received: {error}"))?;
    serde_json::from_str(&result).map_err(|error| format!("Invalid animation frame count: {error}"))
}

fn presence_server() -> Result<(String, Receiver<String>), String> {
    let listener = TcpListener::bind("127.0.0.1:0").map_err(|error| error.to_string())?;
    let base = format!(
        "http://{}",
        listener.local_addr().map_err(|error| error.to_string())?
    );
    let (sent, requests) = mpsc::channel();
    thread::spawn(move || {
        let mut state_requests = 0;
        for socket in listener.incoming() {
            let Ok(mut socket) = socket else {
                break;
            };
            let _ = socket.set_read_timeout(Some(Duration::from_secs(5)));
            let Ok(stream) = socket.try_clone() else {
                break;
            };
            let mut reader = BufReader::new(stream);
            let mut request = String::new();
            loop {
                let mut line = String::new();
                if reader.read_line(&mut line).unwrap_or(0) == 0 || line == "\r\n" {
                    break;
                }
                request.push_str(&line);
            }
            let health = request.starts_with("GET /health ");
            let unchanged = request
                .to_lowercase()
                .contains("if-none-match: \"lifecycle-v1\"");
            if sent.send(request).is_err() {
                break;
            }
            let status = if !health && state_requests == 1 {
                503
            } else if !health && unchanged {
                304
            } else {
                200
            };
            if !health {
                state_requests += 1;
            }
            let body = if status == 304 {
                ""
            } else if health {
                r#"{"ok":true}"#
            } else {
                r#"{"self":{"id":"presence-check","name":"Presence","character":"hachiware"},"presence":{"sharing":false,"revision":1},"friends":[{"id":"presence-friend","name":"Friend","character":"shisa","online":true}]}"#
            };
            let _ = write!(socket, "HTTP/1.1 {status} Test\r\nETag: \"lifecycle-v1\"\r\nContent-Type: application/json\r\nAccess-Control-Allow-Origin: *\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}", body.len());
        }
    });
    Ok((base, requests))
}

fn main() -> Result<(), String> {
    let mut context = tauri::generate_context!();
    // Integration tests do not inherit the main executable's Windows icon resource.
    context.set_default_window_icon(Some(tauri::include_image!("icons/32x32.png")));
    context.config_mut().identifier = std::env::var("WAPPY_LIFECYCLE_ID")
        .ok()
        .filter(|id| {
            id.strip_prefix("com.wappy.lifecycle-check-")
                .is_some_and(|suffix| {
                    !suffix.is_empty() && suffix.bytes().all(|byte| byte.is_ascii_digit())
                })
        })
        .unwrap_or_else(|| format!("com.wappy.lifecycle-check-{}", std::process::id()));
    for window in &mut context.config_mut().app.windows {
        window.incognito = true;
    }
    let app = client_lib::app_builder()
        .plugin(
            tauri::plugin::Builder::<tauri::Wry, ()>::new("disable-webview-timers")
                .js_init_script(
                    r#"
                    window.setTimeout = () => 0; window.setInterval = () => 0;
                    window.__wappyFrames = 0;
                    const raf = window.requestAnimationFrame.bind(window);
                    window.requestAnimationFrame = callback => raf(now => {
                        window.__wappyFrames++;
                        callback(now);
                    });
                "#,
                )
                .build(),
        )
        .build(context)
        .map_err(|error| error.to_string())?;
    if std::env::args().any(|arg| arg == "--secondary") {
        return Err("A second instance passed the single-instance guard".into());
    }
    let (states, received) = mpsc::channel();
    app.listen_any("wappy:desktop-state", move |event| {
        if let Ok(value) = serde_json::from_str(event.payload()) {
            let _ = states.send(value);
        }
    });
    let handle = app.handle().clone();
    let (ready, native_ready) = mpsc::channel();
    let completed = Arc::new(AtomicBool::new(false));
    let completed_by_worker = completed.clone();
    thread::spawn(move || {
        let check = || -> Result<(), String> {
            // Ready follows creation of both WebViews and the native setup hook.
            // A cold WebView2 start must not consume the state delivery deadline.
            native_ready
                .recv_timeout(Duration::from_secs(60))
                .map_err(|error| format!("Native app initialization did not finish: {error}"))?;
            println!("CHECK: native app ready; waiting for initial character state");
            let initial = snapshot(&received, |_| true)?;
            println!("CHECK: windows are ready; checking login startup and tray controls");
            if initial["state"] != serde_json::Value::Null {
                return Err("Smoke check unexpectedly accessed a saved profile".into());
            }
            if handle.tray_by_id("wappy").is_none() {
                return Err("Wappy tray was not created".into());
            }
            let sidebar = handle.get_webview_window("main").ok_or("Missing sidebar")?;
            let desktop = handle
                .get_webview_window("desktop")
                .ok_or("Missing character window")?;
            text_rendered(
                &sidebar,
                ".update-panel",
                "이 빌드는 자동 업데이트를 지원하지 않습니다.",
                true,
            )?;
            desktop.eval(r#"(async () => {
                const results = await Promise.all(['plugin:updater|check', 'plugin:process|restart'].map(command =>
                    window.__TAURI_INTERNALS__.invoke(command)
                        .then(() => false, error => /not allowed/i.test(String(error)))
                ));
                document.body.dataset.updaterScopeDenied = String(results.every(Boolean));
            })()"#).map_err(|error| error.to_string())?;
            text_rendered(&desktop, "body[data-updater-scope-denied='true']", "", true)?;
            let autostart = std::env::args().any(|arg| arg == "--autostart");
            if sidebar.is_visible().unwrap_or(false) == autostart {
                return Err("Initial sidebar visibility did not match the launch mode".into());
            }
            let startup = Startup::new(&handle)?;
            if startup.is_enabled().map_err(|error| error.to_string())? {
                return Err("The unique smoke check startup entry unexpectedly exists".into());
            }
            let startup = StartupCleanup(startup);
            if client_lib::startup::set_startup_enabled(desktop.clone(), true).is_ok() {
                return Err("The character window was allowed to change login startup".into());
            }
            click_button(&sidebar, "컴퓨터 로그인 시 Wappy 실행")?;
            until(|| startup.0.is_enabled().unwrap_or(false))?;
            // Wait for readback to re-enable the checkbox before toggling off.
            click_button(&sidebar, "컴퓨터 로그인 시 Wappy 실행")?;
            until(|| startup.0.is_enabled().is_ok_and(|enabled| !enabled))?;
            sidebar.close().map_err(|error| error.to_string())?;
            until(|| sidebar.is_visible().is_ok_and(|visible| !visible))?;
            if handle.get_webview_window("main").is_none() || !desktop.is_visible().unwrap_or(false)
            {
                return Err("Closing the sidebar destroyed a window or hid the characters".into());
            }

            println!("CHECK: tray settings opens before creating a profile");
            client_lib::show_settings(&handle).map_err(|error| error.to_string())?;
            until(|| sidebar.is_visible().unwrap_or(false))?;
            text_rendered(&sidebar, ".settings-panel", "캐릭터 활동", true)?;
            click_button(&sidebar, "시작 화면")?;
            text_rendered(&sidebar, ".onboarding", "처음이에요", true)?;
            client_lib::show_settings(&handle).map_err(|error| error.to_string())?;
            text_rendered(&sidebar, ".settings-panel", "캐릭터 활동", true)?;
            sidebar.close().map_err(|error| error.to_string())?;
            until(|| sidebar.is_visible().is_ok_and(|visible| !visible))?;

            let paused = !initial["paused"].as_bool().ok_or("Missing paused state")?;
            set_activity(&sidebar, if paused { "stopped" } else { "normal" })?;
            snapshot(&received, |value| value["paused"] == paused)?;
            // The native tray still controls character visibility while hidden.
            handle
                .emit_to("main", "wappy:tray-control", "toggle-visible")
                .map_err(|error| error.to_string())?;
            let visible = !initial["visible"]
                .as_bool()
                .ok_or("Missing visible state")?;
            snapshot(&received, |value| {
                value["paused"] == paused && value["visible"] == visible
            })?;

            // The real sidebar is hidden and all WebView timers are disabled.
            // Presence must still poll, report a failure and reconnect using native time.
            println!("CHECK: hidden background connection and reconnect");
            let (server, requests) = presence_server()?;
            let session = serde_json::json!({ "server": server, "token": "a".repeat(43) });
            sidebar.eval(format!("localStorage.setItem('wappy.session.v1', JSON.stringify({session})); location.reload();"))
                .map_err(|error| error.to_string())?;
            for (index, connected) in [true, false, true].into_iter().enumerate() {
                let update = snapshot(&received, |value| {
                    value["state"]["self"]["id"] == "presence-check"
                        && value["connected"] == connected
                })?;
                if update["state"]["presence"]["sharing"] != false {
                    return Err("The native connection dropped the private presence setting".into());
                }
                if sidebar.is_visible().unwrap_or(true) {
                    return Err("The presence check unexpectedly showed the sidebar".into());
                }
                let request = requests
                    .recv_timeout(Duration::from_secs(1))
                    .map_err(|error| error.to_string())?;
                if !request.starts_with("GET /state HTTP/1.1")
                    || !request.contains(&format!("Bearer {}", "a".repeat(43)))
                {
                    return Err("Background presence used the wrong request or credential".into());
                }
                if index > 0
                    && !request
                        .to_lowercase()
                        .contains("if-none-match: \"lifecycle-v1\"")
                {
                    return Err("Background presence did not reuse its state validator".into());
                }
            }
            handle
                .emit_to("main", "wappy:tray-control", "toggle-visible")
                .map_err(|error| error.to_string())?;
            let shown = snapshot(&received, |value| value["visible"] == true)?;
            text_rendered(
                &desktop,
                ".desktop-resident:nth-of-type(2) .resident-name",
                "Friend",
                true,
            )?;
            if shown["paused"] != true {
                set_activity(&sidebar, "stopped")?;
            }
            text_rendered(&desktop, ".desktop-characters.is-paused", "", true)?;
            // Count real WebView animation callbacks, rather than only checking the pause flag.
            println!("CHECK: animation stops and resumes");
            thread::sleep(Duration::from_millis(100));
            let idle_frames = animation_frames(&desktop)?;
            thread::sleep(Duration::from_millis(500));
            if animation_frames(&desktop)? != idle_frames {
                return Err("Paused characters continued to request animation frames".into());
            }
            set_activity(&sidebar, "normal")?;
            text_rendered(&desktop, ".desktop-characters.is-paused", "", false)?;
            thread::sleep(Duration::from_millis(500));
            if animation_frames(&desktop)? <= idle_frames {
                return Err("Characters did not resume animation after unpausing".into());
            }
            set_activity(&sidebar, "stopped")?;
            text_rendered(&desktop, ".desktop-characters.is-paused", "", true)?;
            text_rendered(
                &sidebar,
                ".connection-line",
                "접속 숨김 · 친구에게 오프라인으로 표시",
                true,
            )?;
            if sidebar.is_visible().unwrap_or(true) {
                return Err("A presence update unexpectedly opened the sidebar".into());
            }
            println!("CHECK: character visibility switches");
            click_button(&sidebar, "친구들")?;
            text_rendered(&sidebar, ".friend-card", "Friend", true)?;
            click_button(&sidebar, "Friend 캐릭터 표시")?;
            let selected = snapshot(&received, |value| {
                value["hiddenIds"] == serde_json::json!(["presence-friend"])
            })?;
            if selected["state"]["friends"][0]["id"] != "presence-friend" {
                return Err("Character selection removed a friend".into());
            }
            text_rendered(&desktop, ".desktop-resident:nth-of-type(2)", "", false)?;
            text_rendered(&desktop, ".resident-name", "Presence (나)", true)?;
            text_rendered(&sidebar, ".friend-card", "Friend", true)?;
            click_button(&sidebar, "Presence 캐릭터 표시")?;
            text_rendered(&desktop, ".desktop-characters", "", false)?;
            click_button(&sidebar, "Presence 캐릭터 표시")?;
            text_rendered(&desktop, ".resident-name", "Presence (나)", true)?;
            click_button(&sidebar, "Friend 캐릭터 표시")?;
            text_rendered(
                &desktop,
                ".desktop-resident:nth-of-type(2) .resident-name",
                "Friend",
                true,
            )?;
            click_button(&sidebar, "Friend 캐릭터 표시")?;
            text_rendered(&desktop, ".desktop-resident:nth-of-type(2)", "", false)?;
            println!("CHECK: tray settings expands the collapsed window");
            client_lib::show_sidebar(&handle).map_err(|error| error.to_string())?;
            click_button(&sidebar, "접기 ⇥")?;
            text_rendered(&sidebar, ".compact-sidebar", "", true)?;
            sidebar.minimize().map_err(|error| error.to_string())?;
            until(|| sidebar.is_minimized().unwrap_or(false))?;
            client_lib::show_settings(&handle).map_err(|error| error.to_string())?;
            until(|| {
                sidebar.is_visible().unwrap_or(false) && !sidebar.is_minimized().unwrap_or(true)
            })?;
            text_rendered(&sidebar, ".settings-panel", "캐릭터 활동", true)?;
            text_rendered(&sidebar, ".compact-sidebar", "", false)?;
            sidebar.close().map_err(|error| error.to_string())?;
            until(|| sidebar.is_visible().is_ok_and(|visible| !visible))?;
            println!("CHECK: session cleanup");
            // Drain earlier requests before checking that session removal stops polling.
            while requests.try_recv().is_ok() {}
            sidebar
                .eval("localStorage.removeItem('wappy.session.v1'); location.reload();")
                .map_err(|error| error.to_string())?;
            snapshot(&received, |value| value["state"].is_null())?;
            if !matches!(
                requests.recv_timeout(Duration::from_secs(6)),
                Err(mpsc::RecvTimeoutError::Timeout)
            ) {
                return Err("The previous session kept polling after page reload".into());
            }

            println!("CHECK: duplicate launches and minimized window restoration");
            secondary_launch(&handle, true)?;
            thread::sleep(Duration::from_millis(500));
            if sidebar.is_visible().unwrap_or(true) {
                return Err("A duplicate login launch unexpectedly opened the sidebar".into());
            }
            secondary_launch(&handle, false)?;
            until(|| sidebar.is_visible().unwrap_or(false))?;
            sidebar.minimize().map_err(|error| error.to_string())?;
            until(|| sidebar.is_minimized().unwrap_or(false))?;
            client_lib::show_sidebar(&handle).map_err(|error| error.to_string())?;
            until(|| {
                sidebar.is_visible().unwrap_or(false) && !sidebar.is_minimized().unwrap_or(true)
            })?;
            Ok(())
        };
        let outcome = check();
        let exit_code = i32::from(outcome.is_err());
        match outcome {
            Ok(()) => println!("PASS: restricted browser permissions, login startup opt-in/readback/removal, launch visibility, duplicate login stays hidden, native tray, paused animation idle/resume, hidden presence with WebView timers disabled, reconnect, character selection, session cleanup, normal relaunch and minimized restore; requesting full exit"),
            Err(error) => eprintln!("FAIL: {error}"),
        }
        completed_by_worker.store(true, Ordering::SeqCst);
        handle.exit(exit_code);
    });
    app.run(move |_, event| {
        if matches!(event, tauri::RunEvent::Ready) {
            let _ = ready.send(());
        }
        if matches!(event, tauri::RunEvent::ExitRequested { .. })
            && !completed.load(Ordering::SeqCst)
        {
            eprintln!("FAIL: the app exited before the check finished");
            std::process::exit(1);
        }
    });
    Ok(())
}
