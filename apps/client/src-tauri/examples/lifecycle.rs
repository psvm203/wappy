//! Run on a desktop after building the frontend:
//! cargo run --example lifecycle --features tauri/custom-protocol
//! Uses private browsing so the check cannot read or change a real profile.
use std::{
    process::Command,
    sync::{
        atomic::{AtomicBool, Ordering},
        mpsc::{self, Receiver},
        Arc,
    },
    thread,
    time::{Duration, Instant},
};
use tauri::{Emitter, Listener, Manager};

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

fn main() -> Result<(), String> {
    let mut context = tauri::generate_context!();
    context.config_mut().identifier = "com.wappy.lifecycle-check".into();
    for window in &mut context.config_mut().app.windows {
        window.incognito = true;
    }
    let app = client_lib::app_builder()
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

            let mut second =
                Command::new(std::env::current_exe().map_err(|error| error.to_string())?)
                    .arg("--secondary")
                    .spawn()
                    .map_err(|error| error.to_string())?;
            let mut status = None;
            if let Err(error) = until(|| {
                status = second.try_wait().ok().flatten();
                status.is_some()
            }) {
                let _ = second.kill();
                let _ = second.wait();
                return Err(format!("Second instance did not exit: {error}"));
            }
            if !status.is_some_and(|status| status.success()) {
                return Err("Second instance failed to hand over to the first".into());
            }
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
            Ok(()) => println!("PASS: native tray, close-to-hide, controls while hidden, single-instance reopen and minimized restore; requesting full exit"),
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
