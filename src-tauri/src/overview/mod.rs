use crate::auth::read_auth_status;
use crate::error::AppResult;
use crate::models::{AuthMode, InstallStatus, OverviewStatus};
use crate::monitor::is_supported_monitor_base_url;
use crate::paths::AppPaths;
use plist::Value as PlistValue;
use std::path::PathBuf;
use std::process::Command;
use std::time::UNIX_EPOCH;

pub fn read_overview_status(paths: &AppPaths) -> AppResult<OverviewStatus> {
    let auth = read_auth_status(paths)?;
    let cli = detect_cli_installation();
    let app = detect_app_installation(paths)?;
    let config_status = read_config_status(paths)?;
    let auth_mode = resolve_effective_auth_mode(&auth.mode, &config_status);
    let monitor_available = config_status
        .active_provider_base_url
        .as_deref()
        .is_some_and(is_supported_monitor_base_url);

    Ok(OverviewStatus {
        cli,
        app,
        auth_mode,
        active_provider: config_status.active_provider,
        active_provider_base_url: config_status.active_provider_base_url,
        monitor_available,
        model: config_status.model,
        sandbox_mode: config_status.sandbox_mode,
        approval_policy: config_status.approval_policy,
        config_path: paths.config_file().display().to_string(),
        config_exists: config_status.exists,
        config_last_modified: config_status.last_modified,
    })
}

#[derive(Default)]
struct ConfigStatus {
    active_provider: Option<String>,
    active_provider_base_url: Option<String>,
    model: Option<String>,
    sandbox_mode: Option<String>,
    approval_policy: Option<String>,
    exists: bool,
    last_modified: Option<String>,
}

fn resolve_effective_auth_mode(auth_mode: &AuthMode, config_status: &ConfigStatus) -> AuthMode {
    if config_status
        .active_provider
        .as_deref()
        .is_some_and(|provider_id| provider_id != "openai")
    {
        return AuthMode::Apikey;
    }

    auth_mode.clone()
}

fn detect_cli_installation() -> InstallStatus {
    let Some(path) = find_in_path("codex") else {
        return InstallStatus {
            installed: false,
            version: None,
            path: None,
            detail: None,
        };
    };

    let version = Command::new(&path)
        .arg("--version")
        .output()
        .ok()
        .filter(|output| output.status.success())
        .map(|output| String::from_utf8_lossy(&output.stdout).trim().to_string())
        .filter(|output| !output.is_empty())
        .map(normalize_version_output);

    InstallStatus {
        installed: true,
        version,
        path: Some(path.display().to_string()),
        detail: Some("PATH".into()),
    }
}

fn detect_app_installation(paths: &AppPaths) -> AppResult<InstallStatus> {
    let Some(bundle_path) = find_app_bundle(paths) else {
        return Ok(InstallStatus {
            installed: false,
            version: None,
            path: None,
            detail: None,
        });
    };

    let plist_path = bundle_path.join("Contents").join("Info.plist");
    let version = if plist_path.exists() {
        let plist = PlistValue::from_file(&plist_path)?;
        plist
            .as_dictionary()
            .and_then(|dict| dict.get("CFBundleShortVersionString"))
            .and_then(PlistValue::as_string)
            .map(ToOwned::to_owned)
    } else {
        None
    };

    Ok(InstallStatus {
        installed: true,
        version,
        path: Some(bundle_path.display().to_string()),
        detail: Some("bundle".into()),
    })
}

fn read_config_status(paths: &AppPaths) -> AppResult<ConfigStatus> {
    if !paths.config_file().exists() {
        return Ok(ConfigStatus::default());
    }

    let content = std::fs::read_to_string(paths.config_file())?;
    let parsed: toml::Value = toml::from_str(&content)?;
    let metadata = std::fs::metadata(paths.config_file())?;
    let modified = metadata
        .modified()
        .ok()
        .and_then(|time| time.duration_since(UNIX_EPOCH).ok())
        .map(|duration| duration.as_millis().to_string());

    Ok(ConfigStatus {
        active_provider: read_toml_string(&parsed, "model_provider"),
        active_provider_base_url: read_active_provider_base_url(&parsed),
        model: read_toml_string(&parsed, "model"),
        sandbox_mode: read_toml_string(&parsed, "sandbox_mode"),
        approval_policy: read_toml_string(&parsed, "approval_policy"),
        exists: true,
        last_modified: modified,
    })
}

fn read_toml_string(value: &toml::Value, key: &str) -> Option<String> {
    value.get(key)?.as_str().map(ToOwned::to_owned)
}

fn read_active_provider_base_url(value: &toml::Value) -> Option<String> {
    let provider_id = value.get("model_provider")?.as_str()?;
    value
        .get("model_providers")?
        .get(provider_id)?
        .get("base_url")?
        .as_str()
        .map(ToOwned::to_owned)
}

fn find_in_path(binary_name: &str) -> Option<PathBuf> {
    let search_path = std::env::var_os("PATH")?;

    for directory in std::env::split_paths(&search_path) {
        let candidate = directory.join(binary_name);
        if candidate.is_file() {
            return Some(candidate);
        }
    }

    None
}

fn normalize_version_output(output: String) -> String {
    output
        .split_whitespace()
        .last()
        .unwrap_or(output.as_str())
        .trim()
        .to_string()
}

fn find_app_bundle(paths: &AppPaths) -> Option<PathBuf> {
    let candidates = [
        paths.home_dir().join("Applications").join("Codex.app"),
        PathBuf::from("/Applications/Codex.app"),
    ];

    candidates.into_iter().find(|path| path.exists())
}

impl From<plist::Error> for crate::error::AppError {
    fn from(value: plist::Error) -> Self {
        crate::error::AppError::Message(format!("failed to parse plist: {value}"))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::path::Path;
    use tempfile::tempdir;

    struct PathGuard(Option<std::ffi::OsString>);

    impl PathGuard {
        fn set(value: &Path) -> Self {
            let original = std::env::var_os("PATH");
            std::env::set_var("PATH", value);
            Self(original)
        }
    }

    impl Drop for PathGuard {
        fn drop(&mut self) {
            match self.0.take() {
                Some(value) => std::env::set_var("PATH", value),
                None => std::env::remove_var("PATH"),
            }
        }
    }

    #[test]
    fn read_overview_status_collects_install_and_config_state() {
        let temp = tempdir().unwrap();
        let home = temp.path().join("home");
        let bin_dir = temp.path().join("bin");
        let app_dir = home.join("Applications").join("Codex.app").join("Contents");
        let paths = AppPaths::from_home(home.clone());

        fs::create_dir_all(paths.codex_dir()).unwrap();
        fs::create_dir_all(&bin_dir).unwrap();
        fs::create_dir_all(&app_dir).unwrap();

        fs::write(paths.auth_file(), r#"{"auth_mode":"chatgpt"}"#).unwrap();
        fs::write(
            paths.config_file(),
            r#"
model = "gpt-5"
model_provider = "openai"
approval_policy = "on-request"
sandbox_mode = "workspace-write"
"#,
        )
        .unwrap();
        fs::write(bin_dir.join("codex"), "#!/bin/sh\necho 'codex 0.99.0'\n").unwrap();

        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let mut permissions = fs::metadata(bin_dir.join("codex")).unwrap().permissions();
            permissions.set_mode(0o755);
            fs::set_permissions(bin_dir.join("codex"), permissions).unwrap();
        }

        fs::write(
            app_dir.join("Info.plist"),
            r#"<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleShortVersionString</key>
  <string>1.2.3</string>
</dict>
</plist>
"#,
        )
        .unwrap();

        let _guard = PathGuard::set(&bin_dir);

        let status = read_overview_status(&paths).unwrap();

        assert!(status.cli.installed);
        assert_eq!(status.cli.version.as_deref(), Some("0.99.0"));
        assert_eq!(status.auth_mode.as_str(), "chatgpt");
        assert_eq!(status.active_provider.as_deref(), Some("openai"));
        assert_eq!(status.active_provider_base_url.as_deref(), None);
        assert_eq!(status.model.as_deref(), Some("gpt-5"));
        assert_eq!(status.sandbox_mode.as_deref(), Some("workspace-write"));
        assert_eq!(status.approval_policy.as_deref(), Some("on-request"));
        assert!(status.app.installed);
        assert_eq!(status.app.version.as_deref(), Some("1.2.3"));
        assert!(status.config_exists);
        assert_eq!(
            status.config_path,
            paths.config_file().display().to_string()
        );
        assert!(status.config_last_modified.is_some());
    }

    #[test]
    fn read_overview_status_extracts_active_provider_base_url() {
        let temp = tempdir().unwrap();
        let home = temp.path().join("home");
        let paths = AppPaths::from_home(home.clone());

        fs::create_dir_all(paths.codex_dir()).unwrap();
        fs::write(paths.auth_file(), r#"{"auth_mode":"apikey"}"#).unwrap();
        fs::write(
            paths.config_file(),
            r#"
model = "gpt-5.5"
model_provider = "jobmd"

[model_providers.jobmd]
base_url = "http://8.222.84.224:5667/v1"
"#,
        )
        .unwrap();

        let status = read_overview_status(&paths).unwrap();

        assert_eq!(status.auth_mode.as_str(), "apikey");
        assert_eq!(status.active_provider.as_deref(), Some("jobmd"));
        assert_eq!(
            status.active_provider_base_url.as_deref(),
            Some("http://8.222.84.224:5667/v1")
        );
    }

    #[test]
    fn read_overview_status_infers_api_mode_when_custom_provider_is_active_and_auth_file_is_missing(
    ) {
        let temp = tempdir().unwrap();
        let home = temp.path().join("home");
        let paths = AppPaths::from_home(home.clone());

        fs::create_dir_all(paths.codex_dir()).unwrap();
        fs::write(
            paths.config_file(),
            r#"
model = "gpt-5.5"
model_provider = "jobmd"

[model_providers.jobmd]
base_url = "http://cpa.host.dxy/v1"

[model_providers.jobmd.auth]
command = "/tmp/codex-helm"
args = ["--provider-token", "jobmd"]
"#,
        )
        .unwrap();

        let status = read_overview_status(&paths).unwrap();

        assert_eq!(status.auth_mode.as_str(), "apikey");
        assert_eq!(status.active_provider.as_deref(), Some("jobmd"));
        assert_eq!(
            status.active_provider_base_url.as_deref(),
            Some("http://cpa.host.dxy/v1")
        );
    }

    #[test]
    fn read_overview_status_prefers_active_custom_provider_over_chatgpt_auth_file() {
        let temp = tempdir().unwrap();
        let home = temp.path().join("home");
        let paths = AppPaths::from_home(home.clone());

        fs::create_dir_all(paths.codex_dir()).unwrap();
        fs::write(paths.auth_file(), r#"{"auth_mode":"chatgpt"}"#).unwrap();
        fs::write(
            paths.config_file(),
            r#"
model = "gpt-5.5"
model_provider = "jobmd"

[model_providers.jobmd]
base_url = "http://cpa.host.dxy/v1"
"#,
        )
        .unwrap();

        let status = read_overview_status(&paths).unwrap();

        assert_eq!(status.auth_mode.as_str(), "apikey");
        assert_eq!(status.active_provider.as_deref(), Some("jobmd"));
    }
}
