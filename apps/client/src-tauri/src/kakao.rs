use reqwest::Url;
use std::process::Command;
use tauri::WebviewWindow;

fn login_url(value: &str) -> Result<Url, String> {
    let url = Url::parse(value).map_err(|_| "Invalid login URL")?;
    let local = matches!(url.host_str(), Some("localhost" | "[::1]"));
    let query: Vec<_> = url.query_pairs().collect();
    if !(url.scheme() == "https" || (url.scheme() == "http" && local))
        || url.host_str().is_none()
        || !url.username().is_empty()
        || url.password().is_some()
        || url.fragment().is_some()
        || url.path() != "/auth/kakao/authorize"
        || query.len() != 1
        || query[0].0 != "state"
        || query[0].1.len() != 64
        || !query[0]
            .1
            .bytes()
            .all(|byte| byte.is_ascii_digit() || (b'a'..=b'f').contains(&byte))
    {
        return Err("Expected a Wappy Kakao authorization URL".into());
    }
    Ok(url)
}

#[tauri::command]
pub async fn open_kakao_login(window: WebviewWindow, url: String) -> Result<(), String> {
    if window.label() != "main" {
        return Err("Only the sidebar can open account login".into());
    }
    let url = login_url(&url)?;
    #[cfg(target_os = "macos")]
    let mut command = Command::new("open");
    #[cfg(windows)]
    let mut command = {
        use std::os::windows::process::CommandExt;
        let mut command = Command::new("rundll32.exe");
        command
            .arg("url.dll,FileProtocolHandler")
            .creation_flags(0x08000000);
        command
    };
    #[cfg(not(any(target_os = "macos", windows)))]
    let mut command = Command::new("xdg-open");
    // Pass a validated URL as one argument; never invoke a command shell.
    let status = command
        .arg(url.as_str())
        .status()
        .map_err(|_| "Could not open the login browser")?;
    if !status.success() {
        return Err("Could not open the login browser".into());
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn browser_login_only_opens_bounded_authorization_urls() {
        let state = "a".repeat(64);
        for origin in [
            "https://example.test",
            "http://localhost:3001",
            "http://[::1]:3001",
        ] {
            assert!(login_url(&format!("{origin}/auth/kakao/authorize?state={state}")).is_ok());
        }
        for url in [
            "file:///auth/kakao/authorize",
            "javascript:alert(1)",
            "http://public.example/auth/kakao/authorize",
            "https://user:secret@example.com/auth/kakao/authorize",
            "https://example.com/other",
            "https://example.com/auth/kakao/authorize?state=bad",
        ] {
            assert!(login_url(url).is_err());
        }
        for suffix in ["#fragment", "&extra=1", "&state=another"] {
            assert!(login_url(&format!(
                "https://example.com/auth/kakao/authorize?state={state}{suffix}"
            ))
            .is_err());
        }
    }
}
