//! Run on a desktop after building the frontend:
//! cargo run --example lifecycle --features tauri/custom-protocol
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
        const button = [...document.querySelectorAll('button,label')].find(button =>
          button.textContent.trim() === {label} || button.getAttribute('aria-label') === {label});
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

fn presence_server() -> Result<(String, Receiver<String>), String> {
    let listener = TcpListener::bind("127.0.0.1:0").map_err(|error| error.to_string())?;
    let base = format!(
        "http://{}",
        listener.local_addr().map_err(|error| error.to_string())?
    );
    let (sent, requests) = mpsc::channel();
    thread::spawn(move || {
        for (index, socket) in listener.incoming().enumerate() {
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
            if sent.send(request).is_err() {
                break;
            }
            let status = if index == 1 { 503 } else { 200 };
            let body = r#"{"self":{"id":"presence-check","name":"Presence","character":"cat","status":""},"friends":[]}"#;
            let _ = write!(socket, "HTTP/1.1 {status} Test\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}", body.len());
        }
    });
    Ok((base, requests))
}

fn main() -> Result<(), String> {
    let mut context = tauri::generate_context!();
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
                .js_init_script("window.setTimeout = () => 0; window.setInterval = () => 0;")
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
    let completed = Arc::new(AtomicBool::new(false));
    let completed_by_worker = completed.clone();
    thread::spawn(move || {
        let check = || -> Result<(), String> {
            let initial = snapshot(&received, |_| true)?;
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

            // These are the same events emitted by the native tray menu, while hidden.
            handle
                .emit_to("main", "wappy:tray-control", "toggle-paused")
                .map_err(|error| error.to_string())?;
            let paused = !initial["paused"].as_bool().ok_or("Missing paused state")?;
            snapshot(&received, |value| value["paused"] == paused)?;
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
            let (server, requests) = presence_server()?;
            let session = serde_json::json!({ "server": server, "token": "a".repeat(43) });
            sidebar.eval(format!("localStorage.setItem('wappy.session.v1', JSON.stringify({session})); location.reload();"))
                .map_err(|error| error.to_string())?;
            for connected in [true, false, true] {
                snapshot(&received, |value| {
                    value["state"]["self"]["id"] == "presence-check"
                        && value["connected"] == connected
                })?;
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
            }
            // Exercise the real UI handlers without relying on WebView timers.
            click_button(&sidebar, "내 모습")?;
            click_button(&sidebar, "프로필 보관하고 서버 바꾸기")?;
            snapshot(&received, |value| value["state"].is_null())?;
            if !matches!(
                requests.recv_timeout(Duration::from_secs(6)),
                Err(mpsc::RecvTimeoutError::Timeout)
            ) {
                return Err("A saved profile kept polling after switching to onboarding".into());
            }
            click_button(&sidebar, &format!("Presence · {server} 프로필로 돌아가기"))?;
            snapshot(&received, |value| {
                value["state"]["self"]["id"] == "presence-check" && value["connected"] == true
            })?;
            let request = requests
                .recv_timeout(Duration::from_secs(1))
                .map_err(|error| error.to_string())?;
            if !request.contains(&format!("Bearer {}", "a".repeat(43))) {
                return Err("Returning to a saved profile lost its credential".into());
            }
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
            Ok(()) => println!("PASS: login startup opt-in/readback/removal, launch visibility, duplicate login stays hidden, native tray, hidden presence with WebView timers disabled, reconnect, saved profiles, session cleanup, normal relaunch and minimized restore; requesting full exit"),
            Err(error) => eprintln!("FAIL: {error}"),
        }
        completed_by_worker.store(true, Ordering::SeqCst);
        handle.exit(exit_code);
    });
    app.run(move |_, event| {
        if matches!(event, tauri::RunEvent::ExitRequested { .. })
            && !completed.load(Ordering::SeqCst)
        {
            eprintln!("FAIL: the app exited before the check finished");
            std::process::exit(1);
        }
    });
    Ok(())
}
