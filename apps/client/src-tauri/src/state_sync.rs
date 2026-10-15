use reqwest::{header, redirect::Policy, Client, StatusCode, Url};
use serde::Serialize;
use serde_json::Value;
use std::{sync::Mutex, time::Duration};
use tauri::{async_runtime::JoinHandle, ipc::Channel, Manager, WebviewWindow};

const POLL_INTERVAL: Duration = Duration::from_secs(5);
const MAX_STATE_BYTES: usize = 1024 * 1024;
const HEARTBEAT_INTERVAL: Duration = Duration::from_secs(10);
const STREAM_IDLE_TIMEOUT: Duration = Duration::from_secs(30);

#[derive(Serialize)]
#[serde(tag = "connection", rename_all = "lowercase")]
pub enum StateUpdate {
    Online {
        #[serde(skip_serializing_if = "Option::is_none")]
        state: Option<Value>,
    },
    Offline,
    Unauthorized,
}

#[derive(Default)]
struct PollTask {
    id: u64,
    task: Option<JoinHandle<()>>,
}

impl Drop for PollTask {
    fn drop(&mut self) {
        if let Some(task) = self.task.take() {
            task.abort();
        }
    }
}

#[derive(Default)]
pub struct StatePolling(Mutex<PollTask>);

fn state_url(server: &str, token: &str) -> Result<Url, String> {
    let mut url = Url::parse(server).map_err(|_| "Invalid server URL")?;
    if !matches!(url.scheme(), "http" | "https")
        || url.host_str().is_none()
        || !url.username().is_empty()
        || url.password().is_some()
        || url.path() != "/"
        || url.query().is_some()
        || url.fragment().is_some()
    {
        return Err("Expected an HTTP(S) server origin without credentials".into());
    }
    if token.len() != 43
        || !token
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || byte == b'_' || byte == b'-')
    {
        return Err("Invalid session token".into());
    }
    url.set_path("/state");
    Ok(url)
}

fn http_client() -> Result<Client, String> {
    Client::builder()
        .tls_backend_native()
        // A redirect must never send the session credential to another destination.
        .redirect(Policy::none())
        .connect_timeout(Duration::from_secs(10))
        .read_timeout(STREAM_IDLE_TIMEOUT)
        .build()
        .map_err(|_| "Could not initialize the background connection".into())
}

async fn fetch_state(
    client: &Client,
    url: &Url,
    token: &str,
    etag: &mut Option<String>,
) -> Result<StateUpdate, ()> {
    let mut request = client
        .get(url.clone())
        .bearer_auth(token)
        .timeout(Duration::from_secs(10));
    if let Some(tag) = etag.as_ref() {
        request = request.header(header::IF_NONE_MATCH, tag);
    }
    let mut response = request.send().await.map_err(|_| ())?;
    if response.status() == StatusCode::UNAUTHORIZED {
        return Ok(StateUpdate::Unauthorized);
    }
    if response.status() == StatusCode::NOT_MODIFIED {
        return etag
            .as_ref()
            .map(|_| StateUpdate::Online { state: None })
            .ok_or(());
    }
    if !response.status().is_success()
        || response
            .content_length()
            .is_some_and(|length| length > MAX_STATE_BYTES as u64)
    {
        return Err(());
    }
    let next_etag = response
        .headers()
        .get(header::ETAG)
        .and_then(|tag| tag.to_str().ok())
        .map(str::to_owned);
    let mut body = Vec::with_capacity(response.content_length().unwrap_or(0) as usize);
    while let Some(chunk) = response.chunk().await.map_err(|_| ())? {
        if body.len() + chunk.len() > MAX_STATE_BYTES {
            return Err(());
        }
        body.extend_from_slice(&chunk);
    }
    let state = serde_json::from_slice(&body).map_err(|_| ())?;
    *etag = next_etag;
    Ok(StateUpdate::Online { state: Some(state) })
}

// Parse incrementally; a frame can contain many chunks, CRLF lines and split UTF-8.
#[derive(Default)]
struct StateEvents {
    line: Vec<u8>,
    data: Vec<u8>,
    event: String,
    size: usize,
    skip_lf: bool,
    started: bool,
}

impl StateEvents {
    fn push(
        &mut self,
        chunk: &[u8],
        mut receive: impl FnMut(&str, &[u8]) -> Result<(), ()>,
    ) -> Result<(), ()> {
        for &byte in chunk {
            if self.skip_lf && byte == b'\n' {
                self.skip_lf = false;
                continue;
            }
            self.skip_lf = byte == b'\r';
            self.size += 1;
            if self.size > MAX_STATE_BYTES {
                return Err(());
            }
            if byte != b'\n' && byte != b'\r' {
                self.line.push(byte);
                continue;
            }
            let mut line = self.line.as_slice();
            if !self.started {
                line = line.strip_prefix(&[0xef, 0xbb, 0xbf]).unwrap_or(line);
                self.started = true;
            }
            if line.is_empty() {
                if !self.data.is_empty() {
                    self.data.pop(); // The final data-line newline is not part of the event.
                    receive(&self.event, &self.data)?;
                }
                self.event.clear();
                self.data.clear();
                self.size = 0;
            } else {
                let colon = line.iter().position(|&byte| byte == b':');
                let (field, value) = colon.map_or((line, &[][..]), |index| {
                    (&line[..index], &line[index + 1..])
                });
                let value = value.strip_prefix(b" ").unwrap_or(value);
                if field == b"event" {
                    self.event = String::from_utf8(value.to_vec()).map_err(|_| ())?;
                }
                if field == b"data" {
                    self.data.extend_from_slice(value);
                    self.data.push(b'\n');
                }
            }
            self.line.clear();
        }
        Ok(())
    }
}

enum StreamEnd {
    Unsupported,
    Unauthorized,
    ReceiverClosed,
}

async fn stream_state(
    client: &Client,
    state_url: &Url,
    token: &str,
    updates: &Channel<StateUpdate>,
    failures: &mut u32,
) -> Result<StreamEnd, ()> {
    let mut url = state_url.clone();
    url.set_path("/events");
    // Limit opening the stream without imposing a deadline on its entire body.
    let mut response = tokio::time::timeout(
        Duration::from_secs(10),
        client
            .get(url.clone())
            .bearer_auth(token)
            .header(header::ACCEPT, "text/event-stream")
            .send(),
    )
    .await
    .map_err(|_| ())?
    .map_err(|_| ())?;
    match response.status() {
        StatusCode::UNAUTHORIZED => return Ok(StreamEnd::Unauthorized),
        StatusCode::NOT_FOUND | StatusCode::METHOD_NOT_ALLOWED | StatusCode::NOT_IMPLEMENTED => {
            return Ok(StreamEnd::Unsupported)
        }
        StatusCode::OK => {}
        _ => return Err(()),
    }
    if response
        .headers()
        .get(header::CONTENT_TYPE)
        .and_then(|value| value.to_str().ok())
        .and_then(|value| value.split(';').next())
        .map(str::trim)
        != Some("text/event-stream")
    {
        return Err(());
    }
    url.set_path("/heartbeat");
    let mut events = StateEvents::default();
    let mut heartbeat_at = tokio::time::Instant::now() + HEARTBEAT_INTERVAL;
    let mut idle_at = tokio::time::Instant::now() + STREAM_IDLE_TIMEOUT;
    loop {
        if tokio::time::Instant::now() >= idle_at {
            return Err(());
        }
        // Check the deadline even when incoming frames are continuously ready.
        if tokio::time::Instant::now() >= heartbeat_at {
            let heartbeat = client
                .post(url.clone())
                .bearer_auth(token)
                .header(header::CONTENT_TYPE, "application/json")
                .body("{}")
                .timeout(Duration::from_secs(10))
                .send()
                .await
                .map_err(|_| ())?;
            if heartbeat.status() == StatusCode::UNAUTHORIZED {
                return Ok(StreamEnd::Unauthorized);
            }
            if heartbeat.status() != StatusCode::NO_CONTENT {
                return Err(());
            }
            heartbeat_at = tokio::time::Instant::now() + HEARTBEAT_INTERVAL;
            continue;
        }
        match tokio::time::timeout_at(heartbeat_at.min(idle_at), response.chunk()).await {
            Ok(Ok(Some(chunk))) => {
                if !chunk.is_empty() {
                    idle_at = tokio::time::Instant::now() + STREAM_IDLE_TIMEOUT;
                }
                let mut unauthorized = false;
                let mut closed = false;
                events.push(&chunk, |event, data| {
                    if unauthorized || closed {
                        return Ok(());
                    }
                    if event == "unauthorized" {
                        unauthorized = true;
                    } else if event == "state" {
                        let state = serde_json::from_slice(data).map_err(|_| ())?;
                        closed = updates
                            .send(StateUpdate::Online { state: Some(state) })
                            .is_err();
                        *failures = 0;
                    }
                    Ok(())
                })?;
                if unauthorized {
                    return Ok(StreamEnd::Unauthorized);
                }
                if closed {
                    return Ok(StreamEnd::ReceiverClosed);
                }
            }
            Ok(_) => return Err(()), // EOF is a disconnect; every reconnect receives a complete snapshot.
            Err(_) => continue,
        }
    }
}

fn retry_delay(failures: u32) -> Duration {
    (POLL_INTERVAL * 2_u32.pow(failures.saturating_sub(1).min(4))).min(Duration::from_secs(60))
}

impl StatePolling {
    fn start(
        &self,
        server: &str,
        token: String,
        updates: Channel<StateUpdate>,
    ) -> Result<u64, String> {
        let url = state_url(server, &token)?;
        let client = http_client()?;
        let mut current = self
            .0
            .lock()
            .map_err(|_| "Could not update the background connection")?;
        if let Some(previous) = current.task.take() {
            previous.abort();
        }
        current.id += 1;
        current.task = Some(tauri::async_runtime::spawn(async move {
            let mut etag = None;
            let mut failures: u32 = 0;
            let mut polling = false;
            loop {
                if !polling {
                    match stream_state(&client, &url, &token, &updates, &mut failures).await {
                        Ok(StreamEnd::Unsupported) => {
                            polling = true;
                            continue;
                        }
                        Ok(StreamEnd::Unauthorized) => {
                            let _ = updates.send(StateUpdate::Unauthorized);
                            break;
                        }
                        Ok(StreamEnd::ReceiverClosed) => break,
                        Err(()) => {
                            if updates.send(StateUpdate::Offline).is_err() {
                                break;
                            }
                            let delay = Duration::from_secs(2_u64.pow(failures.min(5)).min(30));
                            failures = failures.saturating_add(1);
                            let jitter = std::time::SystemTime::now()
                                .duration_since(std::time::UNIX_EPOCH)
                                .unwrap_or_default()
                                .subsec_nanos()
                                % 250_000_000;
                            tokio::time::sleep(delay + Duration::from_nanos(u64::from(jitter)))
                                .await;
                            continue;
                        }
                    }
                }
                let update = fetch_state(&client, &url, &token, &mut etag)
                    .await
                    .unwrap_or(StateUpdate::Offline);
                failures = if matches!(update, StateUpdate::Offline) {
                    failures.saturating_add(1)
                } else {
                    0
                };
                let unauthorized = matches!(update, StateUpdate::Unauthorized);
                if updates.send(update).is_err() || unauthorized {
                    break;
                }
                // Native time keeps presence alive while the WebView is hidden or throttled.
                tokio::time::sleep(retry_delay(failures)).await;
            }
        }));
        Ok(current.id)
    }

    pub fn stop(&self, id: Option<u64>) -> Result<(), String> {
        let mut current = self
            .0
            .lock()
            .map_err(|_| "Could not stop the background connection")?;
        // A late cleanup from an old page/session must not cancel its replacement.
        if id.is_none_or(|id| id == current.id) {
            if let Some(task) = current.task.take() {
                task.abort();
            }
        }
        Ok(())
    }
}

#[tauri::command]
pub fn start_state_polling(
    window: WebviewWindow,
    server: String,
    token: String,
    updates: Channel<StateUpdate>,
) -> Result<u64, String> {
    if window.label() != "main" {
        return Err("Only the sidebar can start a session connection".into());
    }
    window
        .state::<StatePolling>()
        .start(&server, token, updates)
}

#[tauri::command]
pub fn stop_state_polling(window: WebviewWindow, id: u64) -> Result<(), String> {
    if window.label() != "main" {
        return Err("Only the sidebar can stop a session connection".into());
    }
    window.state::<StatePolling>().stop(Some(id))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::{
        io::{BufRead, BufReader, Write},
        net::TcpListener,
        sync::mpsc,
        thread,
    };

    fn response(status: u16, body: &str) -> String {
        format!(
            "HTTP/1.1 {status} Test\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}",
            body.len()
        )
    }

    fn server(responses: Vec<String>) -> (String, mpsc::Receiver<String>) {
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let address = format!("http://{}", listener.local_addr().unwrap());
        let (sent, requests) = mpsc::channel();
        thread::spawn(move || {
            for response in responses {
                let (mut socket, _) = listener.accept().unwrap();
                socket
                    .set_read_timeout(Some(Duration::from_secs(5)))
                    .unwrap();
                let mut reader = BufReader::new(socket.try_clone().unwrap());
                let mut request = String::new();
                loop {
                    let mut line = String::new();
                    if reader.read_line(&mut line).unwrap() == 0 || line == "\r\n" {
                        break;
                    }
                    request.push_str(&line);
                }
                let _ = sent.send(request);
                let _ = socket.write_all(response.as_bytes());
            }
        });
        (address, requests)
    }

    fn channel() -> (Channel<StateUpdate>, mpsc::Receiver<Value>) {
        let (sender, receiver) = mpsc::channel();
        (
            Channel::new(move |body| {
                let _ = sender.send(body.deserialize::<Value>().unwrap());
                Ok(())
            }),
            receiver,
        )
    }

    #[test]
    fn event_frames_handle_fragmented_unicode_crlf_and_bounded_memory() {
        let mut parser = StateEvents::default();
        let mut received = Vec::new();
        let input = "\u{feff}: keepalive\r\nevent: state\r\ndata: {\r\ndata: \"name\":\"친구\"}\r\n\r\nevent: unauthorized\rdata: {}\r\r";
        for byte in input.as_bytes() {
            parser
                .push(&[*byte], |event, data| {
                    received.push((
                        event.to_string(),
                        serde_json::from_slice::<Value>(data).unwrap(),
                    ));
                    Ok(())
                })
                .unwrap();
        }
        assert_eq!(
            received,
            vec![
                ("state".into(), serde_json::json!({"name":"친구"})),
                ("unauthorized".into(), serde_json::json!({})),
            ]
        );
        for _ in 0..1100 {
            parser
                .push(format!(": {}\n\n", "x".repeat(1000)).as_bytes(), |_, _| {
                    panic!("comment dispatched")
                })
                .unwrap();
        }
        assert!(parser
            .push(&vec![b'x'; MAX_STATE_BYTES + 1], |_, _| Ok(()))
            .is_err());
    }

    #[test]
    fn native_stream_checks_protocol_recovers_and_stops_after_revocation() {
        let sse = |body: &str| {
            response(200, body).replacen(
                "Connection:",
                "Content-Type: text/event-stream; charset=utf-8\r\nConnection:",
                1,
            )
        };
        let (base, requests) = server(vec![
            response(503, "{}"),
            sse("event: state\ndata: {\"version\":1}\n\n"),
            sse("event: state\ndata: {\"version\":2}\n\nevent: unauthorized\ndata: {}\n\n"),
        ]);
        let poller = StatePolling::default();
        let (updates, received) = channel();
        poller.start(&base, "a".repeat(43), updates).unwrap();
        let mut versions = Vec::new();
        loop {
            let update = received.recv_timeout(Duration::from_secs(4)).unwrap();
            if update["connection"] == "unauthorized" {
                break;
            }
            if let Some(version) = update["state"]["version"].as_u64() {
                versions.push(version);
            }
        }
        assert_eq!(versions, vec![1, 2]);
        assert!(matches!(
            received.recv_timeout(Duration::from_secs(1)),
            Err(mpsc::RecvTimeoutError::Disconnected)
        ));
        for _ in 0..3 {
            let request = requests.recv_timeout(Duration::from_secs(1)).unwrap();
            assert!(request.starts_with("GET /events "));
            assert!(request.contains("accept: text/event-stream"));
            assert!(request.contains(&format!("Bearer {}", "a".repeat(43))));
        }

        let (base, _) = server(vec![
            response(200, "{}"),
            sse("event: state\ndata: {\n\n"),
            response(401, "{}"),
        ]);
        let client = http_client().unwrap();
        let url = state_url(&base, &"a".repeat(43)).unwrap();
        let (updates, _) = channel();
        tauri::async_runtime::block_on(async {
            let mut failures = 0;
            for _ in 0..2 {
                assert!(
                    stream_state(&client, &url, &"a".repeat(43), &updates, &mut failures)
                        .await
                        .is_err()
                );
            }
            assert!(matches!(
                stream_state(&client, &url, &"a".repeat(43), &updates, &mut failures).await,
                Ok(StreamEnd::Unauthorized)
            ));
        });
    }

    #[test]
    fn native_stream_outlives_request_timeout_and_heartbeats_without_webview_timers() {
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let base = format!("http://{}", listener.local_addr().unwrap());
        let (sent, requests) = mpsc::channel();
        let worker = thread::spawn(move || {
            fn read_request(socket: &std::net::TcpStream) -> String {
                socket
                    .set_read_timeout(Some(Duration::from_secs(15)))
                    .unwrap();
                let mut reader = BufReader::new(socket.try_clone().unwrap());
                let mut request = String::new();
                loop {
                    let mut line = String::new();
                    if reader.read_line(&mut line).unwrap() == 0 || line == "\r\n" {
                        break;
                    }
                    request.push_str(&line);
                }
                request
            }
            let (mut stream, _) = listener.accept().unwrap();
            sent.send(read_request(&stream)).unwrap();
            stream.write_all(b"HTTP/1.1 200 OK\r\nContent-Type: text/event-stream\r\nConnection: close\r\n\r\nevent: state\ndata: {\"version\":1}\n\n").unwrap();
            let (mut heartbeat, _) = listener.accept().unwrap();
            sent.send(read_request(&heartbeat)).unwrap();
            heartbeat.write_all(response(204, "").as_bytes()).unwrap();
            stream
                .write_all(
                    b"event: state\ndata: {\"version\":2}\n\nevent: unauthorized\ndata: {}\n\n",
                )
                .unwrap();
        });
        let poller = StatePolling::default();
        let (updates, received) = channel();
        poller.start(&base, "a".repeat(43), updates).unwrap();
        assert_eq!(
            received.recv_timeout(Duration::from_secs(2)).unwrap()["state"]["version"],
            1
        );
        assert_eq!(
            received
                .recv_timeout(HEARTBEAT_INTERVAL + Duration::from_secs(3))
                .unwrap()["state"]["version"],
            2
        );
        assert_eq!(
            received.recv_timeout(Duration::from_secs(2)).unwrap()["connection"],
            "unauthorized"
        );
        assert!(requests.recv().unwrap().starts_with("GET /events "));
        let heartbeat = requests.recv().unwrap();
        assert!(heartbeat.starts_with("POST /heartbeat "));
        assert!(heartbeat.contains(&format!("Bearer {}", "a".repeat(43))));
        worker.join().unwrap();
    }

    #[test]
    fn native_connection_validates_destinations_and_bounds_untrusted_responses() {
        let token = "a".repeat(43);
        for invalid in [
            "file:///private",
            "ftp://localhost",
            "https://user:pass@localhost",
            "https://localhost/path",
            "https://localhost?token=x",
            "https://localhost#x",
        ] {
            assert!(state_url(invalid, &token).is_err());
        }
        assert!(state_url("https://localhost", "bad\r\nheader").is_err());
        assert_eq!(
            state_url("https://example.test", &token).unwrap().as_str(),
            "https://example.test/state"
        );
        let (redirect_target, redirected) = server(vec![response(200, "{}")]);
        let oversized = format!("{{\"padding\":\"{}\"}}", "x".repeat(MAX_STATE_BYTES));
        let (base, requests) = server(vec![
            response(200, "{\"self\":{\"id\":\"test\"},\"friends\":[]}"),
            response(401, "{}"),
            format!("HTTP/1.1 302 Found\r\nLocation: {redirect_target}/stolen\r\nContent-Length: 0\r\nConnection: close\r\n\r\n"),
            response(200, "{"),
            response(200, &oversized),
            format!("HTTP/1.1 200 OK\r\nTransfer-Encoding: chunked\r\nConnection: close\r\n\r\n{:x}\r\n{oversized}\r\n0\r\n\r\n", oversized.len()),
        ]);
        let url = state_url(&base, &token).unwrap();
        let client = http_client().unwrap();
        tauri::async_runtime::block_on(async {
            let mut etag = None;
            assert!(matches!(
                fetch_state(&client, &url, &token, &mut etag).await,
                Ok(StateUpdate::Online { .. })
            ));
            assert!(matches!(
                fetch_state(&client, &url, &token, &mut etag).await,
                Ok(StateUpdate::Unauthorized)
            ));
            for _ in 0..4 {
                assert!(fetch_state(&client, &url, &token, &mut etag).await.is_err());
            }
        });
        let request = requests.recv_timeout(Duration::from_secs(1)).unwrap();
        assert!(request.starts_with("GET /state HTTP/1.1"));
        assert!(request.contains(&format!("Bearer {token}")));
        assert!(redirected.try_recv().is_err());
    }

    #[test]
    fn conditional_polls_skip_bodies_recover_and_never_cache_invalid_json() {
        let token = "a".repeat(43);
        let tagged = |body: &str, tag: &str| {
            response(200, body).replacen("Connection:", &format!("ETag: {tag}\r\nConnection:"), 1)
        };
        let (base, requests) = server(vec![
            response(304, ""),
            tagged("{}", "\"v1\""),
            response(304, ""),
            response(503, "{}"),
            response(304, ""),
            tagged("{", "\"invalid\""),
            tagged("{\"changed\":true}", "\"v2\""),
            response(200, "{}"),
        ]);
        let client = http_client().unwrap();
        let url = state_url(&base, &token).unwrap();
        tauri::async_runtime::block_on(async {
            let mut etag = None;
            assert!(fetch_state(&client, &url, &token, &mut etag).await.is_err());
            assert!(matches!(
                fetch_state(&client, &url, &token, &mut etag).await,
                Ok(StateUpdate::Online { state: Some(_) })
            ));
            assert_eq!(etag.as_deref(), Some("\"v1\""));
            assert!(matches!(
                fetch_state(&client, &url, &token, &mut etag).await,
                Ok(StateUpdate::Online { state: None })
            ));
            assert!(fetch_state(&client, &url, &token, &mut etag).await.is_err());
            let recovered = fetch_state(&client, &url, &token, &mut etag).await.unwrap();
            assert_eq!(
                serde_json::to_value(recovered).unwrap(),
                serde_json::json!({"connection":"online"})
            );
            assert!(fetch_state(&client, &url, &token, &mut etag).await.is_err());
            assert_eq!(etag.as_deref(), Some("\"v1\""));
            assert!(matches!(
                fetch_state(&client, &url, &token, &mut etag).await,
                Ok(StateUpdate::Online { state: Some(_) })
            ));
            assert_eq!(etag.as_deref(), Some("\"v2\""));
            assert!(fetch_state(&client, &url, &token, &mut etag).await.is_ok());
            assert_eq!(etag, None, "legacy responses clear the validator");
        });
        for expected in [
            None,
            None,
            Some("\"v1\""),
            Some("\"v1\""),
            Some("\"v1\""),
            Some("\"v1\""),
            Some("\"v1\""),
            Some("\"v2\""),
        ] {
            let request = requests
                .recv_timeout(Duration::from_secs(1))
                .unwrap()
                .to_lowercase();
            if let Some(tag) = expected {
                assert!(request.contains(&format!("if-none-match: {tag}")));
            } else {
                assert!(!request.contains("if-none-match"));
            }
        }
        for (failures, seconds) in [
            (0, 5),
            (1, 5),
            (2, 10),
            (3, 20),
            (4, 40),
            (5, 60),
            (u32::MAX, 60),
        ] {
            assert_eq!(retry_delay(failures), Duration::from_secs(seconds));
        }
    }

    #[test]
    fn replacing_and_stopping_sessions_cancels_native_work_without_stopping_the_replacement() {
        let poller = StatePolling::default();
        let (first, _) = server(vec![response(404, "{}"), response(200, "{}")]);
        let (updates, old) = channel();
        let old_id = poller.start(&first, "a".repeat(43), updates).unwrap();
        assert_eq!(
            old.recv_timeout(Duration::from_secs(2)).unwrap()["connection"],
            "online"
        );

        let (second, requests) = server(vec![
            response(404, "{}"),
            response(503, "{}"),
            response(200, "{}"),
            response(401, "{}"),
        ]);
        let (updates, current) = channel();
        let id = poller.start(&second, "b".repeat(43), updates).unwrap();
        poller.stop(Some(old_id)).unwrap();
        assert!(matches!(
            old.recv_timeout(Duration::from_secs(1)),
            Err(mpsc::RecvTimeoutError::Disconnected)
        ));
        assert_eq!(
            current.recv_timeout(Duration::from_secs(2)).unwrap()["connection"],
            "offline"
        );
        assert_eq!(
            current
                .recv_timeout(POLL_INTERVAL + Duration::from_secs(2))
                .unwrap()["connection"],
            "online"
        );
        assert_eq!(
            current
                .recv_timeout(POLL_INTERVAL + Duration::from_secs(2))
                .unwrap()["connection"],
            "unauthorized"
        );
        assert!(matches!(
            current.recv_timeout(Duration::from_secs(1)),
            Err(mpsc::RecvTimeoutError::Disconnected)
        ));
        assert!(requests
            .recv_timeout(Duration::from_secs(1))
            .unwrap()
            .contains(&"b".repeat(43)));
        poller.stop(Some(id)).unwrap();

        let (third, _) = server(vec![response(404, "{}"), response(200, "{}")]);
        let (updates, stopped) = channel();
        poller.start(&third, "c".repeat(43), updates).unwrap();
        stopped.recv_timeout(Duration::from_secs(2)).unwrap();
        poller.stop(None).unwrap();
        assert!(matches!(
            stopped.recv_timeout(Duration::from_secs(1)),
            Err(mpsc::RecvTimeoutError::Disconnected)
        ));
    }
}
