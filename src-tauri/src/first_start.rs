use crate::error::{AppError, AppResult};
use crate::models::{
    AuthMode, FirstStartCandidate, FirstStartImportInput, FirstStartImportResult,
    FirstStartScanResult, FirstStartScanState, ProviderKind, ProviderRecord,
};
use crate::paths::AppPaths;
use crate::provider::ProviderService;
use crate::settings::SettingsStore;
use toml::Value;

pub struct FirstStartService {
    paths: AppPaths,
}

impl FirstStartService {
    pub fn new(paths: AppPaths) -> Self {
        Self { paths }
    }

    pub fn scan(&self) -> AppResult<FirstStartScanResult> {
        let settings = SettingsStore::new(self.paths.clone()).load_or_create()?;
        let config_exists = self.paths.config_file().exists();
        let auth_exists = self.paths.auth_file().exists();
        let auth_mode = read_auth_mode(&self.paths)?;
        let env_keys = read_known_env_keys();
        let candidates = scan_candidates(&self.paths, &env_keys)?;
        let state = if !candidates.is_empty() {
            FirstStartScanState::Detected
        } else if config_exists || auth_exists || !env_keys.is_empty() {
            FirstStartScanState::Partial
        } else {
            FirstStartScanState::Fresh
        };

        Ok(FirstStartScanResult {
            state,
            handled: settings.first_start_import_handled,
            candidates,
            config_exists,
            auth_exists,
            config_path: config_exists.then(|| self.paths.config_file().display().to_string()),
            auth_mode,
            env_keys,
            last_active_custom_provider_id: settings.last_active_custom_provider_id,
        })
    }

    pub fn import_candidate(
        &self,
        input: FirstStartImportInput,
    ) -> AppResult<FirstStartImportResult> {
        if input.candidates.is_empty() {
            return Err(AppError::Message("no provider candidates selected".into()));
        }

        let executable_path = std::env::current_exe()
            .map(|path| path.display().to_string())
            .unwrap_or_else(|_| "codex-helm".into());
        let provider_service = ProviderService::new(self.paths.clone());
        let mut imported_provider_id = String::new();

        for candidate in input.candidates {
            if !candidate.complete {
                return Err(AppError::Message(
                    "cannot import incomplete provider candidate".into(),
                ));
            }

            let provider = ProviderRecord {
                local_id: 0,
                provider_id: normalize_provider_id(&candidate.id),
                name: candidate.name,
                kind: ProviderKind::Custom,
                base_url: candidate.base_url,
                model: candidate.model,
                api_key: candidate.api_key,
                env_key: String::new(),
                http_headers: Default::default(),
                query_params: Default::default(),
                supports_websockets: false,
                active: false,
                enabled: true,
                last_validated_at: None,
                last_validation_status: "unknown".into(),
            };
            imported_provider_id = provider.provider_id.clone();
            provider_service.save_provider(provider)?;
        }

        let imported_local_id = provider_service
            .list_providers()?
            .into_iter()
            .filter(|provider| {
                provider.kind == ProviderKind::Custom
                    && provider.provider_id == imported_provider_id
            })
            .map(|provider| provider.local_id)
            .max()
            .ok_or_else(|| AppError::Message("imported provider not found".into()))?;
        let providers = provider_service.activate_provider(imported_local_id, executable_path)?;

        let store = SettingsStore::new(self.paths.clone());
        let mut settings = store.load_or_create()?;
        settings.first_start_import_handled = true;
        settings.last_active_custom_provider_id = Some(imported_local_id);
        store.save(&settings)?;

        Ok(FirstStartImportResult {
            providers,
            imported_provider_id,
        })
    }

    pub fn mark_handled(&self) -> AppResult<()> {
        let store = SettingsStore::new(self.paths.clone());
        let mut settings = store.load_or_create()?;
        settings.first_start_import_handled = true;
        store.save(&settings)
    }
}

fn scan_candidates(paths: &AppPaths, env_keys: &[String]) -> AppResult<Vec<FirstStartCandidate>> {
    let mut candidates = Vec::new();

    if paths.config_file().exists() {
        let content = std::fs::read_to_string(paths.config_file())?;
        let parsed: Value = content.parse().unwrap_or(Value::Table(Default::default()));
        let default_model = parsed
            .get("model")
            .and_then(Value::as_str)
            .unwrap_or_default()
            .to_string();

        if let Some(provider_tables) = parsed.get("model_providers").and_then(Value::as_table) {
            for (provider_id, provider_value) in provider_tables {
                if provider_id == "openai" {
                    continue;
                }

                let Some(provider_table) = provider_value.as_table() else {
                    continue;
                };
                let env_key = provider_table
                    .get("env_key")
                    .and_then(Value::as_str)
                    .unwrap_or_default()
                    .to_string();
                let api_key = if env_key.is_empty() {
                    String::new()
                } else {
                    std::env::var(&env_key).unwrap_or_default()
                };
                let base_url = provider_table
                    .get("base_url")
                    .and_then(Value::as_str)
                    .unwrap_or_default()
                    .to_string();
                let model = provider_table
                    .get("model")
                    .and_then(Value::as_str)
                    .unwrap_or(default_model.as_str())
                    .to_string();

                candidates.push(FirstStartCandidate {
                    id: normalize_provider_id(provider_id),
                    name: provider_table
                        .get("name")
                        .and_then(Value::as_str)
                        .unwrap_or(provider_id)
                        .to_string(),
                    base_url: base_url.clone(),
                    model,
                    api_key: api_key.clone(),
                    source: paths.config_file().display().to_string(),
                    complete: !base_url.trim().is_empty() && !api_key.trim().is_empty(),
                });
            }
        }
    }

    if candidates.is_empty() {
        for env_key in env_keys {
            let api_key = std::env::var(env_key).unwrap_or_default();
            if api_key.trim().is_empty() {
                continue;
            }
            candidates.push(FirstStartCandidate {
                id: "env".into(),
                name: "OpenAI (环境变量)".into(),
                base_url: "https://api.openai.com/v1".into(),
                model: "gpt-5".into(),
                api_key,
                source: env_key.clone(),
                complete: true,
            });
        }
    }

    Ok(candidates)
}

fn read_known_env_keys() -> Vec<String> {
    ["OPENAI_API_KEY"]
        .into_iter()
        .filter(|key| {
            std::env::var(key)
                .map(|value| !value.trim().is_empty())
                .unwrap_or(false)
        })
        .map(ToOwned::to_owned)
        .collect()
}

fn read_auth_mode(paths: &AppPaths) -> AppResult<Option<AuthMode>> {
    if !paths.auth_file().exists() {
        return Ok(None);
    }

    let raw = std::fs::read_to_string(paths.auth_file())?;
    if raw.trim().is_empty() {
        return Ok(Some(AuthMode::LoggedOut));
    }

    let parsed: serde_json::Value =
        serde_json::from_str(&raw).unwrap_or_else(|_| serde_json::json!({}));
    Ok(
        match parsed.get("auth_mode").and_then(serde_json::Value::as_str) {
            Some("chatgpt") => Some(AuthMode::Chatgpt),
            Some("apikey") => Some(AuthMode::Apikey),
            Some("logged_out") => Some(AuthMode::LoggedOut),
            _ => None,
        },
    )
}

fn normalize_provider_id(value: &str) -> String {
    let normalized: String = value
        .trim()
        .to_lowercase()
        .chars()
        .map(|ch| {
            if ch.is_ascii_alphanumeric() || ch == '-' || ch == '_' {
                ch
            } else {
                '-'
            }
        })
        .collect();

    normalized.trim_matches('-').to_string()
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn scan_reads_active_env_backed_provider_candidate() {
        let temp = tempdir().unwrap();
        let paths = AppPaths::from_home(temp.path().to_path_buf());
        std::fs::create_dir_all(paths.codex_dir()).unwrap();
        std::fs::write(
            paths.config_file(),
            r#"model = "gpt-5.5"
model_provider = "jobmd"

[model_providers.jobmd]
name = "jobmd"
base_url = "https://example.com/v1"
env_key = "CODEX_HELM_TEST_KEY"
"#,
        )
        .unwrap();
        std::env::set_var("CODEX_HELM_TEST_KEY", "sk-test-123456");

        let result = FirstStartService::new(paths).scan().unwrap();

        assert!(!result.handled);
        assert_eq!(result.candidates.len(), 1);
        assert!(result.candidates[0].complete);
        assert_eq!(result.candidates[0].id, "jobmd");
        assert_eq!(result.candidates[0].api_key, "sk-test-123456");
        std::env::remove_var("CODEX_HELM_TEST_KEY");
    }

    #[test]
    fn mark_handled_persists_camel_case_setting() {
        let temp = tempdir().unwrap();
        let paths = AppPaths::from_home(temp.path().to_path_buf());

        FirstStartService::new(paths.clone())
            .mark_handled()
            .unwrap();

        let settings = SettingsStore::new(paths).load_or_create().unwrap();
        assert!(settings.first_start_import_handled);
    }
}
