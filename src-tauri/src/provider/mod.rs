use crate::config::ConfigStore;
use crate::error::{AppError, AppResult};
use crate::models::{
    ProviderConnectivityResult, ProviderKind, ProviderRecord, ProviderValidationResult,
};
use crate::paths::AppPaths;
use crate::settings::SettingsStore;
use toml::Value;

pub mod connectivity;

pub struct ProviderService {
    paths: AppPaths,
}

impl ProviderService {
    pub fn new(paths: AppPaths) -> Self {
        Self { paths }
    }

    pub fn list_providers(&self) -> AppResult<Vec<ProviderRecord>> {
        Ok(SettingsStore::new(self.paths.clone())
            .load_or_create()?
            .providers)
    }

    pub fn save_provider(&self, provider: ProviderRecord) -> AppResult<Vec<ProviderRecord>> {
        validate_provider(&provider)?;

        let store = SettingsStore::new(self.paths.clone());
        store.save_provider(&provider)?;
        Ok(store.load_or_create()?.providers)
    }

    pub fn delete_provider(&self, local_id: i64) -> AppResult<Vec<ProviderRecord>> {
        let store = SettingsStore::new(self.paths.clone());
        let mut settings = store.load_or_create()?;
        let provider = settings
            .providers
            .iter()
            .find(|provider| provider.local_id == local_id)
            .cloned()
            .ok_or_else(|| AppError::Message("provider not found".into()))?;

        if provider.kind == ProviderKind::Builtin {
            return Err(AppError::Message(
                "built-in providers cannot be deleted".into(),
            ));
        }

        if provider.active {
            return Err(AppError::Message(
                "active provider cannot be deleted".into(),
            ));
        }
        settings
            .providers
            .retain(|provider| provider.local_id != local_id);
        store.save(&settings)?;
        Ok(settings.providers)
    }

    pub fn activate_provider(
        &self,
        local_id: i64,
        executable_path: String,
    ) -> AppResult<Vec<ProviderRecord>> {
        let store = SettingsStore::new(self.paths.clone());
        let mut settings = store.load_or_create()?;
        let provider = settings
            .providers
            .iter()
            .find(|item| item.local_id == local_id)
            .cloned()
            .ok_or_else(|| AppError::Message("provider not found".into()))?;

        let config_store = ConfigStore::new(self.paths.clone());
        let current = config_store.get_raw_config().unwrap_or_default();
        let mut parsed = parse_toml_or_empty(&current)?;
        cleanup_inactive_provider_tables(&mut parsed, &provider.provider_id);

        set_value(
            &mut parsed,
            &["model_provider"],
            Value::String(provider.provider_id.clone()),
        );
        if !provider.model.trim().is_empty() {
            set_value(
                &mut parsed,
                &["model"],
                Value::String(provider.model.clone()),
            );
        }

        if provider.kind == ProviderKind::Builtin && provider.provider_id == "openai" {
            remove_provider_table(&mut parsed, "openai");
        } else {
            let provider_table = provider_table(&mut parsed, &provider.provider_id);
            provider_table.insert("name".into(), Value::String(provider.name.clone()));
            provider_table.insert("base_url".into(), Value::String(provider.base_url.clone()));
            insert_string_map(provider_table, "http_headers", &provider.http_headers);
            insert_string_map(provider_table, "query_params", &provider.query_params);
            provider_table.insert(
                "supports_websockets".into(),
                Value::Boolean(provider.supports_websockets),
            );

            if !provider.api_key.is_empty() {
                provider_table.remove("requires_openai_auth");
                provider_table.remove("env_key");
                provider_table.insert(
                    "auth".into(),
                    Value::Table(
                        [
                            ("command".into(), Value::String(executable_path)),
                            (
                                "args".into(),
                                Value::Array(vec![
                                    Value::String("--provider-token-id".into()),
                                    Value::String(provider.local_id.to_string()),
                                ]),
                            ),
                        ]
                        .into_iter()
                        .collect(),
                    ),
                );
            } else if !provider.env_key.is_empty() {
                provider_table.remove("requires_openai_auth");
                provider_table.remove("auth");
                provider_table.insert("env_key".into(), Value::String(provider.env_key.clone()));
            } else {
                provider_table.remove("requires_openai_auth");
                provider_table.remove("auth");
                provider_table.remove("env_key");
            }
        }

        let raw_toml = toml::to_string_pretty(&parsed)?;
        config_store.create_backup_from_current(&current)?;
        std::fs::create_dir_all(self.paths.codex_dir())?;
        std::fs::write(self.paths.config_file(), raw_toml)?;

        for existing in &mut settings.providers {
            existing.active = existing.local_id == provider.local_id;
        }
        settings.last_active_custom_provider_id = if provider.kind == ProviderKind::Custom {
            Some(provider.local_id)
        } else {
            None
        };
        store.save(&settings)?;

        Ok(settings.providers)
    }

    pub fn restore_official_provider_defaults(&self) -> AppResult<Vec<ProviderRecord>> {
        let store = SettingsStore::new(self.paths.clone());
        let mut settings = store.load_or_create()?;
        let config_store = ConfigStore::new(self.paths.clone());
        let current = config_store.get_raw_config().unwrap_or_default();
        let mut parsed = parse_toml_or_empty(&current)?;

        cleanup_inactive_provider_tables(&mut parsed, "openai");
        set_value(
            &mut parsed,
            &["model_provider"],
            Value::String("openai".into()),
        );
        remove_provider_table(&mut parsed, "openai");

        if let Some(root_table) = parsed.as_table_mut() {
            root_table.remove("model");
            root_table.remove("preferred_auth_method");
            root_table.remove("experimental_bearer_token");
        }

        let raw_toml = toml::to_string_pretty(&parsed)?;
        config_store.create_backup_from_current(&current)?;
        std::fs::create_dir_all(self.paths.codex_dir())?;
        std::fs::write(self.paths.config_file(), raw_toml)?;

        for existing in &mut settings.providers {
            existing.active = existing.provider_id == "openai";
        }
        settings.last_active_custom_provider_id = None;
        store.save(&settings)?;

        Ok(settings.providers)
    }

    pub fn token_for_provider(&self, provider_id: &str) -> AppResult<String> {
        let settings = SettingsStore::new(self.paths.clone()).load_or_create()?;
        settings
            .providers
            .into_iter()
            .find(|provider| provider.provider_id == provider_id && provider.active)
            .map(|provider| provider.api_key)
            .filter(|api_key| !api_key.is_empty())
            .ok_or_else(|| AppError::Message("provider token not found".into()))
    }

    pub fn token_for_provider_local_id(&self, local_id: i64) -> AppResult<String> {
        let api_key = SettingsStore::new(self.paths.clone())
            .provider_by_local_id(local_id)
            .map(|provider| provider.api_key)?;
        if api_key.is_empty() {
            Err(AppError::Message("provider token not found".into()))
        } else {
            Ok(api_key)
        }
    }

    pub fn validate_provider(
        &self,
        provider: &ProviderRecord,
    ) -> AppResult<ProviderValidationResult> {
        validate_provider(provider)?;
        Ok(ProviderValidationResult {
            ok: true,
            detail: "provider is valid".into(),
        })
    }

    pub async fn test_connectivity(
        &self,
        provider: ProviderRecord,
    ) -> AppResult<ProviderConnectivityResult> {
        crate::provider::connectivity::test_provider_connectivity(provider).await
    }

    pub async fn validate_key(
        &self,
        provider: ProviderRecord,
    ) -> AppResult<ProviderConnectivityResult> {
        crate::provider::connectivity::validate_provider_key(provider).await
    }
}

fn validate_provider(provider: &ProviderRecord) -> AppResult<()> {
    if provider.provider_id.trim().is_empty() {
        return Err(AppError::Message("provider id is required".into()));
    }

    if provider.name.trim().is_empty() {
        return Err(AppError::Message("provider name is required".into()));
    }

    if provider.kind == ProviderKind::Custom && is_reserved_provider_id(&provider.provider_id) {
        return Err(AppError::Message("custom provider id is reserved".into()));
    }

    if !provider
        .provider_id
        .chars()
        .all(|ch| ch.is_ascii_lowercase() || ch.is_ascii_digit() || ch == '-' || ch == '_')
    {
        return Err(AppError::Message(
            "provider id must contain only lowercase letters, digits, '-' or '_'".into(),
        ));
    }

    reqwest::Url::parse(&provider.base_url)
        .map_err(|_| AppError::Message("base_url must be a valid URL".into()))?;
    Ok(())
}

fn is_reserved_provider_id(provider_id: &str) -> bool {
    matches!(provider_id, "openai" | "ollama" | "lmstudio")
}

fn parse_toml_or_empty(raw_toml: &str) -> AppResult<Value> {
    if raw_toml.trim().is_empty() {
        return Ok(Value::Table(Default::default()));
    }

    raw_toml
        .parse::<Value>()
        .map_err(|error| AppError::Message(error.to_string()))
}

fn provider_table<'a>(
    root: &'a mut Value,
    provider_id: &str,
) -> &'a mut toml::map::Map<String, Value> {
    let model_providers = root
        .as_table_mut()
        .expect("root table")
        .entry("model_providers")
        .or_insert_with(|| Value::Table(Default::default()));
    let table = model_providers
        .as_table_mut()
        .expect("model_providers table")
        .entry(provider_id)
        .or_insert_with(|| Value::Table(Default::default()));
    table.as_table_mut().expect("provider table")
}

fn insert_string_map(
    table: &mut toml::map::Map<String, Value>,
    key: &str,
    value: &std::collections::BTreeMap<String, String>,
) {
    if value.is_empty() {
        table.remove(key);
        return;
    }

    table.insert(
        key.into(),
        Value::Table(
            value
                .iter()
                .map(|(item_key, item_value)| (item_key.clone(), Value::String(item_value.clone())))
                .collect(),
        ),
    );
}

fn cleanup_inactive_provider_tables(root: &mut Value, active_provider_id: &str) {
    let Some(model_providers) = root
        .as_table_mut()
        .and_then(|root| root.get_mut("model_providers"))
        .and_then(Value::as_table_mut)
    else {
        return;
    };

    for (provider_id, provider_value) in model_providers.iter_mut() {
        if provider_id == active_provider_id {
            continue;
        }

        if let Some(provider_table) = provider_value.as_table_mut() {
            provider_table.remove("auth");
            provider_table.remove("env_key");
            provider_table.remove("requires_openai_auth");
        }
    }
}

fn remove_provider_table(root: &mut Value, provider_id: &str) {
    let Some(root_table) = root.as_table_mut() else {
        return;
    };
    let Some(model_providers) = root_table
        .get_mut("model_providers")
        .and_then(Value::as_table_mut)
    else {
        return;
    };

    model_providers.remove(provider_id);
    if model_providers.is_empty() {
        root_table.remove("model_providers");
    }
}

fn set_value(root: &mut Value, path: &[&str], value: Value) {
    let mut current = root;
    for segment in &path[..path.len() - 1] {
        let table = current.as_table_mut().expect("root must be a table");
        current = table
            .entry((*segment).to_string())
            .or_insert_with(|| Value::Table(Default::default()));
    }
    current
        .as_table_mut()
        .expect("leaf parent must be a table")
        .insert(path[path.len() - 1].to_string(), value);
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::BTreeMap;
    use tempfile::tempdir;

    fn custom_provider(provider_id: &str, name: &str, api_key: &str) -> ProviderRecord {
        ProviderRecord {
            local_id: 0,
            provider_id: provider_id.into(),
            name: name.into(),
            kind: ProviderKind::Custom,
            base_url: "https://example.com/v1".into(),
            model: "gpt-5.5".into(),
            api_key: api_key.into(),
            env_key: String::new(),
            http_headers: BTreeMap::new(),
            query_params: BTreeMap::new(),
            supports_websockets: false,
            active: false,
            enabled: true,
            last_validated_at: None,
            last_validation_status: "unknown".into(),
        }
    }

    #[test]
    fn save_provider_rejects_reserved_id_for_custom_provider() {
        let temp = tempdir().unwrap();
        let service = ProviderService::new(AppPaths::from_home(temp.path().to_path_buf()));

        let error = service
            .save_provider(custom_provider("openai", "Bad Custom", ""))
            .unwrap_err();

        assert!(error.to_string().contains("reserved"));
    }

    #[test]
    fn supports_multiple_custom_records_with_same_provider_id() {
        let temp = tempdir().unwrap();
        let service = ProviderService::new(AppPaths::from_home(temp.path().to_path_buf()));

        service
            .save_provider(custom_provider("jobmd", "JobMD A", "sk-a"))
            .unwrap();
        let providers = service
            .save_provider(custom_provider("jobmd", "JobMD B", "sk-b"))
            .unwrap();
        let jobmd: Vec<_> = providers
            .iter()
            .filter(|provider| provider.provider_id == "jobmd")
            .collect();

        assert_eq!(jobmd.len(), 2);
        assert_ne!(jobmd[0].local_id, jobmd[1].local_id);
    }

    #[test]
    fn activate_custom_provider_writes_auth_command_with_local_id() {
        let temp = tempdir().unwrap();
        let paths = AppPaths::from_home(temp.path().to_path_buf());
        let service = ProviderService::new(paths.clone());

        let providers = service
            .save_provider(custom_provider("jobmd", "JobMD A", "sk-a"))
            .unwrap();
        let local_id = providers
            .into_iter()
            .find(|provider| provider.provider_id == "jobmd")
            .unwrap()
            .local_id;

        service
            .activate_provider(
                local_id,
                "/Applications/Codex Helm.app/Contents/MacOS/Codex Helm".into(),
            )
            .unwrap();
        let config = std::fs::read_to_string(paths.config_file()).unwrap();

        assert!(config.contains("model_provider = \"jobmd\""));
        assert!(config.contains("[model_providers.jobmd]"));
        assert!(config.contains("\"--provider-token-id\""));
        assert!(config.contains(&format!("\"{local_id}\"")));
        assert_eq!(
            service.token_for_provider_local_id(local_id).unwrap(),
            "sk-a"
        );
    }

    #[test]
    fn activating_second_duplicate_provider_uses_second_key() {
        let temp = tempdir().unwrap();
        let paths = AppPaths::from_home(temp.path().to_path_buf());
        let service = ProviderService::new(paths.clone());

        service
            .save_provider(custom_provider("jobmd", "JobMD A", "sk-a"))
            .unwrap();
        let providers = service
            .save_provider(custom_provider("jobmd", "JobMD B", "sk-b"))
            .unwrap();
        let second_local_id = providers
            .into_iter()
            .filter(|provider| provider.provider_id == "jobmd")
            .map(|provider| provider.local_id)
            .max()
            .unwrap();

        let providers = service
            .activate_provider(second_local_id, "/tmp/codex-helm".into())
            .unwrap();
        let config = std::fs::read_to_string(paths.config_file()).unwrap();

        assert!(config.contains("model_provider = \"jobmd\""));
        assert!(config.contains(&format!("\"{second_local_id}\"")));
        assert_eq!(
            service
                .token_for_provider_local_id(second_local_id)
                .unwrap(),
            "sk-b"
        );
        assert!(providers
            .iter()
            .any(|provider| provider.local_id == second_local_id && provider.active));
    }

    #[test]
    fn delete_active_provider_is_rejected() {
        let temp = tempdir().unwrap();
        let service = ProviderService::new(AppPaths::from_home(temp.path().to_path_buf()));

        let providers = service
            .save_provider(custom_provider("acme", "Acme", "sk-acme"))
            .unwrap();
        let local_id = providers
            .into_iter()
            .find(|provider| provider.provider_id == "acme")
            .unwrap()
            .local_id;
        service
            .activate_provider(local_id, "/tmp/codex-helm".into())
            .unwrap();

        let error = service.delete_provider(local_id).unwrap_err();

        assert!(error.to_string().contains("active provider"));
    }

    #[test]
    fn delete_inactive_provider_removes_sqlite_record() {
        let temp = tempdir().unwrap();
        let service = ProviderService::new(AppPaths::from_home(temp.path().to_path_buf()));

        let providers = service
            .save_provider(custom_provider("acme", "Acme", "sk-acme"))
            .unwrap();
        let local_id = providers
            .into_iter()
            .find(|provider| provider.provider_id == "acme")
            .unwrap()
            .local_id;

        let providers = service.delete_provider(local_id).unwrap();

        assert!(!providers
            .iter()
            .any(|provider| provider.local_id == local_id));
        assert!(!service
            .list_providers()
            .unwrap()
            .iter()
            .any(|provider| provider.local_id == local_id));
    }

    #[test]
    fn restore_official_defaults_clears_api_overrides_and_marks_openai_active() {
        let temp = tempdir().unwrap();
        let paths = AppPaths::from_home(temp.path().to_path_buf());
        let service = ProviderService::new(paths.clone());

        service
            .save_provider(custom_provider("acme", "Acme", "sk-acme"))
            .unwrap();

        std::fs::create_dir_all(paths.codex_dir()).unwrap();
        std::fs::write(
            paths.config_file(),
            r#"
model_provider = "acme"
model = "gpt-5.5"
preferred_auth_method = "apikey"
experimental_bearer_token = "sk-old"

[model_providers.acme]
name = "Acme"
base_url = "https://example.com/v1"

[model_providers.acme.auth]
command = "/tmp/codex-helm"
args = ["--provider-token-id", "4"]

[model_providers.openai]
name = "OpenAI"
base_url = "https://api.openai.com/v1"
requires_openai_auth = true
"#,
        )
        .unwrap();

        let providers = service.restore_official_provider_defaults().unwrap();
        let config = std::fs::read_to_string(paths.config_file()).unwrap();

        assert!(config.contains("model_provider = \"openai\""));
        assert!(!config.contains("model = "));
        assert!(!config.contains("[model_providers.openai]"));
        assert!(!config.contains("requires_openai_auth = true"));
        assert!(!config.contains("preferred_auth_method"));
        assert!(!config.contains("experimental_bearer_token"));
        assert!(!config.contains("--provider-token-id"));
        assert!(providers
            .iter()
            .any(|provider| provider.provider_id == "openai" && provider.active));
    }
}
