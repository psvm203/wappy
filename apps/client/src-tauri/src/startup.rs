use std::{io, path::PathBuf};
use tauri::{AppHandle, Manager, WebviewWindow};

pub const AUTOSTART_ARGUMENT: &str = "--autostart";

#[cfg(any(windows, test))]
fn windows_command(executable: &str) -> io::Result<String> {
    // Windows executable names cannot contain quotes; quote the whole path, not the args.
    let command = format!("\"{executable}\" {AUTOSTART_ARGUMENT}");
    if command.encode_utf16().count() > 260 {
        return Err(io::Error::other("The startup command exceeds Windows' 260-character limit; use a shorter installation path"));
    }
    Ok(command)
}

#[cfg(any(windows, test))]
fn startup_approved(bytes: &[u8]) -> io::Result<bool> {
    if bytes.len() == 12 {
        match bytes[0] {
            2 | 6 => return Ok(true),
            3 | 7 => return Ok(false),
            _ => {}
        }
    }
    Err(io::Error::other(
        "Unrecognized Windows startup approval state",
    ))
}

pub struct Startup {
    name: String,
    executable: PathBuf,
    #[cfg(target_os = "macos")]
    file: PathBuf,
}

impl Startup {
    pub fn new(app: &AppHandle) -> Result<Self, String> {
        // The identifier also isolates smoke checks from the installed application's entry.
        let name = app.config().identifier.clone();
        Ok(Self {
            #[cfg(target_os = "macos")]
            file: app
                .path()
                .home_dir()
                .map_err(|error| error.to_string())?
                .join("Library/LaunchAgents")
                .join(format!("{name}.plist")),
            name,
            executable: std::env::current_exe().map_err(|error| error.to_string())?,
        })
    }

    #[cfg(target_os = "macos")]
    fn plist(&self) -> plist::Dictionary {
        plist::Dictionary::from_iter([
            ("Label", self.name.clone().into()),
            (
                "ProgramArguments",
                plist::Value::Array(vec![
                    self.executable.to_string_lossy().into_owned().into(),
                    AUTOSTART_ARGUMENT.into(),
                ]),
            ),
            ("RunAtLoad", true.into()),
            (
                "AssociatedBundleIdentifiers",
                plist::Value::Array(vec![self.name.clone().into()]),
            ),
        ])
    }

    pub fn is_enabled(&self) -> io::Result<bool> {
        #[cfg(target_os = "macos")]
        {
            match std::fs::metadata(&self.file) {
                Ok(metadata) => Ok(metadata.is_file()),
                Err(error) if error.kind() == io::ErrorKind::NotFound => Ok(false),
                Err(error) => Err(error),
            }
        }
        #[cfg(windows)]
        {
            use windows_registry::CURRENT_USER;
            let registered = match CURRENT_USER
                .open(RUN_KEY)
                .and_then(|key| key.get_string(&self.name))
            {
                Ok(_) => true,
                Err(error) if error.code().0 as u32 == 0x80070002 => false,
                Err(error) => return Err(error.into()),
            };
            if !registered {
                return Ok(false);
            }
            match CURRENT_USER
                .open(APPROVAL_KEY)
                .and_then(|key| key.get_value(&self.name))
            {
                Ok(value) => startup_approved(&value),
                Err(error) if error.code().0 as u32 == 0x80070002 => Ok(true),
                Err(error) => Err(error.into()),
            }
        }
        #[cfg(not(any(target_os = "macos", windows)))]
        Err(io::Error::other(
            "Autostart is available on macOS and Windows",
        ))
    }

    pub fn set_enabled(&self, enabled: bool) -> io::Result<()> {
        #[cfg(target_os = "macos")]
        {
            if !enabled {
                return match std::fs::remove_file(&self.file) {
                    Err(error) if error.kind() == io::ErrorKind::NotFound => Ok(()),
                    result => result,
                };
            }
            let directory = self
                .file
                .parent()
                .ok_or_else(|| io::Error::other("Missing launch directory"))?;
            std::fs::create_dir_all(directory)?;
            // Serialize rather than interpolating XML: installed paths can contain '&' or '<'.
            let temporary = self.file.with_extension("plist.tmp");
            plist::to_file_xml(&temporary, &self.plist()).map_err(io::Error::other)?;
            std::fs::rename(temporary, &self.file)
        }
        #[cfg(windows)]
        {
            use windows_registry::CURRENT_USER;
            if enabled {
                CURRENT_USER.create(RUN_KEY)?.set_string(
                    &self.name,
                    windows_command(&self.executable.to_string_lossy())?,
                )?;
                // An explicit opt-in resets this app's Task Manager override for this user only.
                let mut approval = [0; 12];
                approval[0] = 2;
                CURRENT_USER.create(APPROVAL_KEY)?.set_bytes(
                    &self.name,
                    windows_registry::Type::Bytes,
                    &approval,
                )?;
                return Ok(());
            }
            for path in [RUN_KEY, APPROVAL_KEY] {
                match CURRENT_USER
                    .options()
                    .write()
                    .open(path)
                    .and_then(|key| key.remove_value(&self.name))
                {
                    Ok(()) => {}
                    Err(error) if error.code().0 as u32 == 0x80070002 => {}
                    Err(error) => return Err(error.into()),
                }
            }
            Ok(())
        }
        #[cfg(not(any(target_os = "macos", windows)))]
        Err(io::Error::other(
            "Autostart is available on macOS and Windows",
        ))
    }
}

#[cfg(windows)]
const RUN_KEY: &str = r"SOFTWARE\Microsoft\Windows\CurrentVersion\Run";
#[cfg(windows)]
const APPROVAL_KEY: &str =
    r"SOFTWARE\Microsoft\Windows\CurrentVersion\Explorer\StartupApproved\Run";

fn for_sidebar(window: &WebviewWindow) -> Result<Startup, String> {
    if window.label() != "main" {
        return Err("Only the sidebar can manage startup settings".into());
    }
    Startup::new(window.app_handle())
}

#[tauri::command]
pub fn startup_status(window: WebviewWindow) -> Result<bool, String> {
    for_sidebar(&window)?
        .is_enabled()
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn set_startup_enabled(window: WebviewWindow, enabled: bool) -> Result<(), String> {
    for_sidebar(&window)?
        .set_enabled(enabled)
        .map_err(|error| error.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn windows_paths_and_startup_overrides_remain_unambiguous() {
        assert_eq!(
            windows_command(r"C:\Program Files\Wappy 친구\Wappy.exe").unwrap(),
            "\"C:\\Program Files\\Wappy 친구\\Wappy.exe\" --autostart"
        );
        assert!(windows_command(&"x".repeat(260)).is_err());
        for (state, enabled) in [(2, true), (3, false), (6, true), (7, false)] {
            let mut bytes = [0; 12];
            bytes[0] = state;
            assert_eq!(startup_approved(&bytes).unwrap(), enabled);
        }
        assert!(startup_approved(&[]).is_err());
        assert!(startup_approved(&[99; 12]).is_err());
    }

    #[cfg(target_os = "macos")]
    #[test]
    fn launch_agent_round_trips_special_characters_and_can_be_removed() {
        let directory = std::env::temp_dir().join(format!("wappy-startup-{}", std::process::id()));
        let entry = Startup {
            name: "com.wappy.startup-test".into(),
            executable: "/Applications/Wappy & Friends <친구>.app/Contents/MacOS/Wappy".into(),
            file: directory.join("test.plist"),
        };
        let check = || -> io::Result<()> {
            entry.set_enabled(true)?;
            assert!(entry.is_enabled()?);
            let content: plist::Dictionary =
                plist::from_file(&entry.file).map_err(io::Error::other)?;
            assert_eq!(content, entry.plist());
            assert_eq!(
                content["ProgramArguments"].as_array().unwrap()[0].as_string(),
                entry.executable.to_str()
            );
            assert_eq!(content["RunAtLoad"].as_boolean(), Some(true));
            assert!(!content.contains_key("KeepAlive"));
            entry.set_enabled(false)?;
            entry.set_enabled(false)?;
            assert!(!entry.is_enabled()?);
            Ok(())
        };
        let result = check();
        let _ = std::fs::remove_dir_all(&directory);
        result.unwrap();
    }
}
