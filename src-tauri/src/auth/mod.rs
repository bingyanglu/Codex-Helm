use crate::error::AppResult;
use crate::models::{AuthMode, AuthStatus};
use crate::paths::AppPaths;
use serde::Deserialize;

#[derive(Debug, Deserialize)]
struct RawAuthFile {
    auth_mode: Option<String>,
    #[serde(rename = "OPENAI_API_KEY")]
    openai_api_key: Option<String>,
}

pub fn read_auth_status(paths: &AppPaths) -> AppResult<AuthStatus> {
    if !paths.auth_file().exists() {
        return Ok(AuthStatus {
            mode: AuthMode::LoggedOut,
            masked_token: None,
            source_path: paths.auth_file().display().to_string(),
        });
    }

    let content = std::fs::read_to_string(paths.auth_file())?;
    let raw: RawAuthFile = serde_json::from_str(&content)?;
    let mode = match raw.auth_mode.as_deref() {
        Some("apikey") => AuthMode::Apikey,
        Some("chatgpt") => AuthMode::Chatgpt,
        _ => AuthMode::LoggedOut,
    };

    Ok(AuthStatus {
        mode,
        masked_token: raw.openai_api_key.as_deref().map(mask_key),
        source_path: paths.auth_file().display().to_string(),
    })
}

fn mask_key(value: &str) -> String {
    if value.len() <= 8 {
        return "••••".into();
    }

    format!("{}••••{}", &value[..8], &value[value.len() - 4..])
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::paths::AppPaths;
    use tempfile::tempdir;

    #[test]
    fn read_auth_status_reports_api_key_mode() {
        let temp = tempdir().unwrap();
        let paths = AppPaths::from_home(temp.path().to_path_buf());
        std::fs::create_dir_all(paths.codex_dir()).unwrap();
        std::fs::write(
            paths.auth_file(),
            r#"{"auth_mode":"apikey","OPENAI_API_KEY":"sk-test-123456"}"#,
        )
        .unwrap();

        let status = read_auth_status(&paths).unwrap();

        assert_eq!(status.mode.as_str(), "apikey");
        assert_eq!(status.masked_token.as_deref(), Some("sk-test-••••3456"));
    }
}
