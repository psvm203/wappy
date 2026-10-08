//! Run on a desktop after building the frontend:
//! cargo run --example lifecycle --features tauri/custom-protocol
//! Uses private browsing so the check cannot read or change a real profile.
use client_lib::startup::Startup;
use std::{
    io::{BufRead, BufReader, Write},
    net::TcpListener,
    process::Command,
    sync::{
        atomic::{AtomicBool, AtomicU64, Ordering},
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
    static SEQUENCE: AtomicU64 = AtomicU64::new(0);
    // A delayed signal from an earlier observation must never satisfy this one.
    let event = format!(
        "wappy:lifecycle-rendered-{}",
        SEQUENCE.fetch_add(1, Ordering::Relaxed)
    );
    let js_event = serde_json::to_string(&event).map_err(|error| error.to_string())?;
    let selector = serde_json::to_string(selector).map_err(|error| error.to_string())?;
    let text = serde_json::to_string(text).map_err(|error| error.to_string())?;
    let (sent, received) = mpsc::channel();
    let listener = window.app_handle().listen_any(event, move |event| {
        if let Ok(matches) = serde_json::from_str::<bool>(event.payload()) {
            let _ = sent.send(matches);
        }
    });
    // Native polling also observes focus/style changes that have no DOM mutation,
    // and does not depend on the WebView timers disabled by this smoke check.
    let result = (|| -> Result<(), String> {
        let deadline = Instant::now() + Duration::from_secs(5);
        while Instant::now() < deadline {
            window.eval(format!(r#"(() => {{
        const element = document.querySelector({selector});
        const matches = !!element === {present} && (!element || element.textContent.includes({text}));
        window.__TAURI_INTERNALS__.invoke('plugin:event|emit_to', {{ target: {{ kind: 'AnyLabel', label: 'main' }}, event: {js_event}, payload: matches }});
      }})()"#)).map_err(|error| error.to_string())?;
            if received.recv_timeout(deadline.saturating_duration_since(Instant::now()))
                .map_err(|error| error.to_string())? {
                return Ok(());
            }
            thread::sleep(Duration::from_millis(50));
        }
        Err("timed out after 5 seconds".into())
    })().map_err(|error| format!("Expected UI did not render ({selector}, text={text}, present={present}): {error}"));
    window.app_handle().unlisten(listener);
    if result.is_err() {
        let (sent, received) = mpsc::channel();
        let listener = window
            .app_handle()
            .listen_any("wappy:lifecycle-diagnostic", move |event| {
                let _ = sent.send(event.payload().to_string());
            });
        let _ = window.eval(format!(
            r#"window.__TAURI_INTERNALS__.invoke('plugin:event|emit_to', {{
          target: {{ kind: 'AnyLabel', label: 'main' }}, event: 'wappy:lifecycle-diagnostic',
          payload: {{ focused: document.hasFocus(), visible: document.visibilityState,
            active: document.activeElement?.outerHTML.slice(0, 500),
            matched: document.querySelector({selector})?.outerHTML.slice(0, 500),
            friend: document.querySelector('.friend-card')?.outerHTML.slice(0, 500) }}
        }});"#
        ));
        eprintln!(
            "UI DIAGNOSTIC: native focused={:?}, visible={:?}, minimized={:?}; DOM={:?}",
            window.is_focused(),
            window.is_visible(),
            window.is_minimized(),
            received.recv_timeout(Duration::from_secs(2))
        );
        window.app_handle().unlisten(listener);
    }
    result
}

fn animation_frames(window: &tauri::WebviewWindow) -> Result<u64, String> {
    let (sent, received) = mpsc::channel();
    let listener = window
        .app_handle()
        .listen_any("wappy:lifecycle-frames", move |event| {
            if let Ok(count) = serde_json::from_str::<u64>(event.payload()) {
                let _ = sent.send(count);
            }
        });
    window.eval("window.__TAURI_INTERNALS__.invoke('plugin:event|emit_to', { target: { kind: 'AnyLabel', label: 'main' }, event: 'wappy:lifecycle-frames', payload: window.__wappyFrames });")
        .map_err(|error| error.to_string())?;
    let result = received
        .recv_timeout(Duration::from_secs(5))
        .map_err(|error| format!("Animation frame count was not received: {error}"));
    window.app_handle().unlisten(listener);
    result
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
            if sent.send(request).is_err() {
                break;
            }
            let status = if !health && state_requests == 1 {
                503
            } else {
                200
            };
            if !health {
                state_requests += 1;
            }
            let body = if health {
                r#"{"ok":true}"#
            } else {
                r#"{"self":{"id":"presence-check","name":"Presence","character":"cat","status":""},"presence":{"sharing":false,"revision":1},"friends":[{"id":"greeting-friend","name":"Friend","character":"frog","status":"","online":true,"wave":{"id":"native-wave","sentAt":1800000000000}}]}"#
            };
            let _ = write!(socket, "HTTP/1.1 {status} Test\r\nContent-Type: application/json\r\nAccess-Control-Allow-Origin: *\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}", body.len());
        }
    });
    Ok((base, requests))
}

fn main() -> Result<(), String> {
    let mut context = tauri::generate_context!();
    // Cargo examples do not inherit the main executable's Windows icon resource.
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
            println!("CHECK: support diagnostics and restricted browser permissions");
            sidebar.eval(r#"
                document.querySelector('.support-panel').open = true;
                window.__originalClipboard = navigator.clipboard;
                Object.defineProperty(navigator, 'clipboard', { configurable: true, value: {
                    writeText: async value => {
                        const displayed = document.querySelector('.support-panel textarea').value;
                        document.body.dataset.supportCopied = String(value === displayed && value.startsWith('Wappy 문제 확인 정보'));
                    }
                }});
            "#).map_err(|error| error.to_string())?;
            text_rendered(
                &sidebar,
                ".support-panel textarea",
                &format!("앱 버전: {}", handle.package_info().version),
                true,
            )?;
            if let Ok(build) = std::env::var("VITE_BUILD_ID") {
                if build.len() == 40 && build.bytes().all(|byte| byte.is_ascii_hexdigit()) {
                    text_rendered(
                        &sidebar,
                        ".support-panel textarea",
                        &format!("빌드: {}", &build[..12]),
                        true,
                    )?;
                }
            }
            click_button(&sidebar, "문제 확인 정보 복사")?;
            text_rendered(&sidebar, "body[data-support-copied='true']", "", true)?;
            for window in [&sidebar, &desktop] {
                let requests = if window.label() == "main" {
                    serde_json::json!([
                        {"url": "https://github.com/psvm203/wappy/issues/new?body=scope-check"},
                        {"url": "https://example.invalid/wappy-scope-check"},
                        {"url": "file:///wappy-scope-check"},
                        {"url": "https://github.com/psvm203/wappy/issues/new", "with": "wappy-scope-check"}
                    ])
                } else {
                    serde_json::json!([{"url": "https://github.com/psvm203/wappy/issues/new"}])
                };
                window
                    .eval(format!(
                        r#"(async () => {{
                    const results = await Promise.all({requests}.map(args =>
                        window.__TAURI_INTERNALS__.invoke('plugin:opener|open_url', args)
                            .then(() => false, error => /not allowed/i.test(String(error)))
                    ));
                    document.body.dataset.supportScopeDenied = String(results.every(Boolean));
                }})()"#
                    ))
                    .map_err(|error| error.to_string())?;
                text_rendered(window, "body[data-support-scope-denied='true']", "", true)?;
            }
            sidebar
                .eval("document.querySelector('.support-panel').open = false; Object.defineProperty(navigator, 'clipboard', { configurable: true, value: window.__originalClipboard }); delete window.__originalClipboard;")
                .map_err(|error| error.to_string())?;
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
            println!("CHECK: local preview without a session or server requests");
            let (server, requests) = presence_server()?;
            let preview_server =
                serde_json::to_string(&server).map_err(|error| error.to_string())?;
            sidebar.eval(format!(r#"(() => {{
                const input = document.querySelector('.server-settings input[type="url"]');
                Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, {preview_server});
                input.dispatchEvent(new Event('input', {{ bubbles: true }}));
            }})()"#)).map_err(|error| error.to_string())?;
            click_button(&sidebar, "서버 없이 체험하기")?;
            let preview = snapshot(&received, |value| {
                value["state"]["self"]["id"] == "local-preview"
            })
            .map_err(|error| format!("Local preview did not start: {error}"))?;
            if preview["connected"] != false
                || preview["profileKey"] != serde_json::Value::Null
                || preview["paused"] != initial["paused"]
                || preview["visible"] != initial["visible"]
                || preview["state"]["friends"] != serde_json::json!([])
            {
                return Err(
                    "Local preview changed global preferences or claimed a server connection"
                        .into(),
                );
            }
            text_rendered(&desktop, ".resident-name", "체험 캐릭터", true)?;
            sidebar.close().map_err(|error| error.to_string())?;
            until(|| sidebar.is_visible().is_ok_and(|visible| !visible))?;
            text_rendered(&desktop, ".resident-name", "체험 캐릭터", true)?;
            client_lib::show_sidebar(&handle).map_err(|error| error.to_string())?;
            click_button(&sidebar, "고양이")?;
            click_button(&sidebar, "체험 모습 바꾸기")?;
            snapshot(&received, |value| {
                value["state"]["self"]["character"] == "cat"
            })
            .map_err(|error| format!("Local preview appearance did not change: {error}"))?;
            text_rendered(
                &desktop,
                ".desktop-resident svg[aria-label='고양이 캐릭터']",
                "",
                true,
            )?;
            sidebar
                .eval(
                    r#"document.body.dataset.previewCredentialsSafe = String(
                localStorage.getItem('wappy.session.v1') === null &&
                localStorage.getItem('wappy.saved-sessions.v1') === null &&
                !Object.keys(localStorage).some(key => key.startsWith('wappy.residents.v1:'))
            );"#,
                )
                .map_err(|error| error.to_string())?;
            text_rendered(
                &sidebar,
                "body[data-preview-credentials-safe='true']",
                "",
                true,
            )?;
            if requests.recv_timeout(Duration::from_millis(300)).is_ok() {
                return Err("Local preview contacted the configured server".into());
            }
            click_button(&sidebar, "체험 끝내고 시작하기")?;
            snapshot(&received, |value| value["state"] == serde_json::Value::Null)
                .map_err(|error| format!("Local preview did not stop: {error}"))?;
            text_rendered(&desktop, ".desktop-resident", "", false)?;
            println!("CHECK: public server connection check without profile credentials");
            sidebar
                .eval("document.querySelector('.server-settings').open = true;")
                .map_err(|error| error.to_string())?;
            click_button(&sidebar, "서버 연결 확인")?;
            let health = requests
                .recv_timeout(Duration::from_secs(5))
                .map_err(|error| format!("Server check was not sent: {error}"))?;
            if !health.starts_with("GET /health ")
                || health.to_ascii_lowercase().contains("authorization:")
                || health.to_ascii_lowercase().contains("cookie:")
            {
                return Err("Server check sent an unexpected request or credentials".into());
            }
            text_rendered(&sidebar, ".server-check", "서버 응답을 확인했어요", true)?;
            text_rendered(&desktop, ".desktop-resident", "", false)?;
            click_button(&sidebar, "서버 없이 체험하기")?;
            snapshot(&received, |value| {
                value["state"]["self"]["id"] == "local-preview"
            })
            .map_err(|error| format!("Local preview did not restart: {error}"))?;
            sidebar
                .eval("location.reload();")
                .map_err(|error| error.to_string())?;
            snapshot(&received, |value| value["state"] == serde_json::Value::Null)
                .map_err(|error| format!("Local preview survived reload: {error}"))?;
            text_rendered(&desktop, ".desktop-resident", "", false)?;
            text_rendered(&sidebar, ".local-preview", "", false)?;
            if startup.0.is_enabled().map_err(|error| error.to_string())? {
                return Err("Local preview enabled login startup".into());
            }
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
            println!("CHECK: hidden background connection and reconnect");
            let session = serde_json::json!({ "server": server, "token": "a".repeat(43) });
            sidebar.eval(format!("localStorage.setItem('wappy.session.v1', JSON.stringify({session})); location.reload();"))
                .map_err(|error| error.to_string())?;
            for connected in [true, false, true] {
                let update = snapshot(&received, |value| {
                    value["state"]["self"]["id"] == "presence-check"
                        && value["connected"] == connected
                })?;
                if update["state"]["friends"][0]["wave"]["id"] != "native-wave" {
                    return Err("The native connection dropped an incoming greeting".into());
                }
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
            }
            handle
                .emit_to("main", "wappy:tray-control", "toggle-visible")
                .map_err(|error| error.to_string())?;
            let shown = snapshot(&received, |value| value["visible"] == true)?;
            text_rendered(&desktop, ".resident-wave", "안녕!", true)?;
            if shown["paused"] != true {
                click_button(&sidebar, "캐릭터 움직임 멈추기")?;
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
            click_button(&sidebar, "캐릭터 움직임 다시 시작")?;
            text_rendered(&desktop, ".desktop-characters.is-paused", "", false)?;
            thread::sleep(Duration::from_millis(500));
            if animation_frames(&desktop)? <= idle_frames {
                return Err("Characters did not resume animation after unpausing".into());
            }
            click_button(&sidebar, "캐릭터 움직임 멈추기")?;
            text_rendered(&desktop, ".desktop-characters.is-paused", "", true)?;
            text_rendered(
                &sidebar,
                ".presence-controls [role='status']",
                "친구에게 오프라인으로 보여요.",
                true,
            )?;
            if sidebar.is_visible().unwrap_or(true) {
                return Err("An incoming greeting unexpectedly opened the sidebar".into());
            }
            if client_lib::open_sidebar(desktop.clone()).is_ok() {
                return Err("The character window bypassed sidebar navigation validation".into());
            }
            println!("CHECK: greeting shortcuts restore and focus the sidebar");
            for target in [
                serde_json::Value::Null,
                serde_json::json!({ "profileKey": "previous-profile", "friendId": "greeting-friend" }),
                serde_json::json!({ "profileKey": shown["profileKey"], "friendId": "removed-friend" }),
            ] {
                handle
                    .emit_to("main", "wappy:open-greeting", target)
                    .map_err(|error| error.to_string())?;
            }
            thread::sleep(Duration::from_millis(200));
            if sidebar.is_visible().unwrap_or(true) {
                return Err("An invalid or stale greeting shortcut opened the sidebar".into());
            }
            click_button(&sidebar, "새 인사 1")?;
            sidebar.eval(r#"(() => {
                const input = document.querySelector('.friend-search input');
                Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, 'no-matching-friend');
                input.dispatchEvent(new Event('input', { bubbles: true }));
            })()"#).map_err(|error| error.to_string())?;
            text_rendered(
                &sidebar,
                ".friend-filter-empty",
                "조건에 맞는 친구가 없어요.",
                true,
            )?;
            click_button(&sidebar, "접기 ⇥")?;
            text_rendered(&sidebar, ".compact-sidebar", "", true)?;
            click_button(&desktop, "Friend 님의 인사 보기")?;
            until(|| sidebar.is_visible().unwrap_or(false))?;
            text_rendered(&sidebar, ".sidebar:not(.compact-sidebar)", "", true)?;
            println!("CHECK: friend card focus after restoring the compact hidden sidebar");
            text_rendered(&sidebar, ".friend-card:focus", "Friend", true)?;
            text_rendered(
                &sidebar,
                ".friend-views [aria-pressed='true']",
                "전체",
                true,
            )?;
            text_rendered(&sidebar, ".received-wave", "인사를 보냈어요", true)?;
            text_rendered(&desktop, ".resident-wave", "안녕!", true)?;
            sidebar.minimize().map_err(|error| error.to_string())?;
            until(|| sidebar.is_minimized().unwrap_or(false))?;
            click_button(&desktop, "Friend 님의 인사 보기")?;
            until(|| {
                sidebar.is_visible().unwrap_or(false) && !sidebar.is_minimized().unwrap_or(true)
            })?;
            println!("CHECK: friend card focus after restoring the minimized sidebar");
            text_rendered(&sidebar, ".friend-card:focus", "Friend", true)?;
            sidebar.close().map_err(|error| error.to_string())?;
            until(|| sidebar.is_visible().is_ok_and(|visible| !visible))?;
            sidebar
                .eval("document.querySelector('.resident-selection').open = true;")
                .map_err(|error| error.to_string())?;
            click_button(&sidebar, "내 캐릭터만")?;
            let selected = snapshot(&received, |value| {
                value["hiddenIds"] == serde_json::json!(["greeting-friend"])
            })?;
            if selected["state"]["friends"][0]["wave"]["id"] != "native-wave" {
                return Err("Character selection removed a friend or its greeting".into());
            }
            text_rendered(&desktop, ".resident-wave", "", false)?;
            text_rendered(&desktop, ".resident-name", "Presence (나)", true)?;
            text_rendered(&sidebar, ".received-wave", "인사를 보냈어요", true)?;
            click_button(&sidebar, "Presence (나)")?;
            text_rendered(&desktop, ".desktop-characters", "", false)?;
            click_button(&sidebar, "모두 선택")?;
            text_rendered(&desktop, ".resident-wave", "안녕!", true)?;
            click_button(&sidebar, "내 캐릭터만")?;
            text_rendered(&desktop, ".resident-wave", "", false)?;
            // Exercise the real UI handlers without relying on WebView timers.
            println!("CHECK: profile switching and session cleanup");
            click_button(&sidebar, "내 모습")?;
            click_button(&sidebar, "프로필 보관하고 서버 바꾸기")?;
            snapshot(&received, |value| value["state"].is_null())?;
            text_rendered(&desktop, ".resident-wave", "", false)?;
            // Requests made before the profile switch are not evidence of continued polling.
            while requests.try_recv().is_ok() {}
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
            text_rendered(&desktop, ".resident-name", "Presence (나)", true)?;
            text_rendered(&desktop, ".resident-wave", "", false)?;
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
            Ok(()) => println!("PASS: local preview without accounts/network, appearance changes, exit/reload cleanup, login startup opt-in/readback/removal, launch visibility, duplicate login stays hidden, native tray, paused animation idle/resume, hidden presence and greeting bubbles with WebView timers disabled, scoped greeting shortcut restores compact sidebar without consuming the wave, reconnect, saved profiles, session cleanup, normal relaunch and minimized restore; requesting full exit"),
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
