use reqwest::{redirect::Policy, Client, StatusCode, Url};
use serde::Serialize;
use serde_json::Value;
use std::{sync::Mutex, time::Duration};
use tauri::{async_runtime::JoinHandle, ipc::Channel, Manager, WebviewWindow};

const POLL_INTERVAL: Duration = Duration::from_secs(5);
const MAX_STATE_BYTES: usize = 1024 * 1024;

#[derive(Serialize)]
#[serde(tag = "connection", rename_all = "lowercase")]
pub enum StateUpdate {
    Online { state: Value },
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
        .timeout(Duration::from_secs(10))
        .build()
        .map_err(|_| "Could not initialize the background connection".into())
}

async fn fetch_state(client: &Client, url: &Url, token: &str) -> Result<StateUpdate, ()> {
    let mut response = client
        .get(url.clone())
        .bearer_auth(token)
        .send()
        .await
        .map_err(|_| ())?;
    if response.status() == StatusCode::UNAUTHORIZED {
        return Ok(StateUpdate::Unauthorized);
    }
    if !response.status().is_success()
        || response
            .content_length()
            .is_some_and(|length| length > MAX_STATE_BYTES as u64)
    {
        return Err(());
    }
    let mut body = Vec::new();
    while let Some(chunk) = response.chunk().await.map_err(|_| ())? {
        if body.len() + chunk.len() > MAX_STATE_BYTES {
            return Err(());
        }
        body.extend_from_slice(&chunk);
    }
    let state = serde_json::from_slice(&body).map_err(|_| ())?;
    Ok(StateUpdate::Online { state })
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
            loop {
                let update = fetch_state(&client, &url, &token)
                    .await
                    .unwrap_or(StateUpdate::Offline);
                let unauthorized = matches!(update, StateUpdate::Unauthorized);
                if updates.send(update).is_err() || unauthorized {
                    break;
                }
                // Native time keeps presence alive while the WebView is hidden or throttled.
                tokio::time::sleep(POLL_INTERVAL).await;
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
            assert!(matches!(
                fetch_state(&client, &url, &token).await,
                Ok(StateUpdate::Online { .. })
            ));
            assert!(matches!(
                fetch_state(&client, &url, &token).await,
                Ok(StateUpdate::Unauthorized)
            ));
            for _ in 0..4 {
                assert!(fetch_state(&client, &url, &token).await.is_err());
            }
        });
        let request = requests.recv_timeout(Duration::from_secs(1)).unwrap();
        assert!(request.starts_with("GET /state HTTP/1.1"));
        assert!(request.contains(&format!("Bearer {token}")));
        assert!(redirected.try_recv().is_err());
    }

    #[test]
    fn replacing_and_stopping_sessions_cancels_native_work_without_stopping_the_replacement() {
        let poller = StatePolling::default();
        let (first, _) = server(vec![response(200, "{}")]);
        let (updates, old) = channel();
        let old_id = poller.start(&first, "a".repeat(43), updates).unwrap();
        assert_eq!(
            old.recv_timeout(Duration::from_secs(2)).unwrap()["connection"],
            "online"
        );

        let (second, requests) = server(vec![
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

        let (third, _) = server(vec![response(200, "{}")]);
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
