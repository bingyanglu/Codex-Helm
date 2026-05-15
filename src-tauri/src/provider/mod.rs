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
        let mut settings = store.load_or_create()?;

        if let Some(existing) = settings
            .providers
            .iter_mut()
            .find(|existing| existing.id == provider.id)
        {
            *existing = provider;
        } else {
            settings.providers.push(provider);
        }

        store.save(&settings)?;
        Ok(settings.providers)
    }

    pub fn delete_provider(&self, provider_id: &str) -> AppResult<Vec<ProviderRecord>> {
        if is_reserved_provider_id(provider_id) {
            return Err(AppError::Message(
                "built-in providers cannot be deleted".into(),
            ));
        }

        let store = SettingsStore::new(self.paths.clone());
        let mut settings = store.load_or_create()?;
        settings
            .providers
            .retain(|provider| provider.id != provider_id);
        store.save(&settings)?;
        Ok(settings.providers)
    }

    pub fn activate_provider(
        &self,
        provider_id: String,
        executable_path: String,
    ) -> AppResult<Vec<ProviderRecord>> {
        let store = SettingsStore::new(self.paths.clone());
        let mut settings = store.load_or_create()?;
        let provider = settings
            .providers
            .iter()
            .find(|item| item.id == provider_id)
            .cloned()
            .ok_or_else(|| AppError::Message("provider not found".into()))?;

        let config_store = ConfigStore::new(self.paths.clone());
        let current = config_store.get_raw_config().unwrap_or_default();
        let mut parsed = parse_toml_or_empty(&current)?;
        cleanup_inactive_provider_tables(&mut parsed, &provider.id);

        set_value(
            &mut parsed,
            &["model_provider"],
            Value::String(provider.id.clone()),
        );
        if !provider.model.trim().is_empty() {
            set_value(
                &mut parsed,
                &["model"],
                Value::String(provider.model.clone()),
            );
        }

        if provider.kind == ProviderKind::Builtin && provider.id == "openai" {
            remove_provider_table(&mut parsed, "openai");
        } else {
            let provider_table = provider_table(&mut parsed, &provider.id);
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
                                    Value::String("--provider-token".into()),
                                    Value::String(provider.id.clone()),
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
            existing.active = existing.id == provider.id;
        }
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
            existing.active = existing.id == "openai";
        }
        store.save(&settings)?;

        Ok(settings.providers)
    }

    pub fn token_for_provider(&self, provider_id: &str) -> AppResult<String> {
        let settings = SettingsStore::new(self.paths.clone()).load_or_create()?;
        settings
            .providers
            .into_iter()
            .find(|provider| provider.id == provider_id)
            .map(|provider| provider.api_key)
            .filter(|api_key| !api_key.is_empty())
            .ok_or_else(|| AppError::Message("provider token not found".into()))
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
    if provider.id.trim().is_empty() {
        return Err(AppError::Message("provider id is required".into()));
    }

    if provider.name.trim().is_empty() {
        return Err(AppError::Message("provider name is required".into()));
    }

    if provider.kind == ProviderKind::Custom && is_reserved_provider_id(&provider.id) {
        return Err(AppError::Message("custom provider id is reserved".into()));
    }

    if !provider
        .id
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

    #[test]
    fn save_provider_rejects_reserved_id_for_custom_provider() {
        let temp = tempdir().unwrap();
        let paths = AppPaths::from_home(temp.path().to_path_buf());
        let service = ProviderService::new(paths);

        let error = service
            .save_provider(ProviderRecord {
                id: "openai".into(),
                name: "Bad Custom".into(),
                kind: ProviderKind::Custom,
                base_url: "https://example.com/v1".into(),
                model: "gpt-5.5".into(),
                api_key: String::new(),
                env_key: String::new(),
                http_headers: Default::default(),
                query_params: Default::default(),
                supports_websockets: false,
                active: false,
                enabled: true,
                last_validated_at: None,
                last_validation_status: "unknown".into(),
            })
            .unwrap_err();

        assert!(error.to_string().contains("reserved"));
    }

    #[test]
    fn activate_custom_provider_writes_auth_command_and_model_provider() {
        let temp = tempdir().unwrap();
        let paths = AppPaths::from_home(temp.path().to_path_buf());
        let service = ProviderService::new(paths.clone());

        service
            .save_provider(ProviderRecord {
                id: "acme".into(),
                name: "Acme".into(),
                kind: ProviderKind::Custom,
                base_url: "https://example.com/v1".into(),
                model: "gpt-5.5".into(),
                api_key: "sk-acme-123456".into(),
                env_key: String::new(),
                http_headers: BTreeMap::new(),
                query_params: BTreeMap::new(),
                supports_websockets: false,
                active: false,
                enabled: true,
                last_validated_at: None,
                last_validation_status: "unknown".into(),
            })
            .unwrap();

        service
            .activate_provider(
                "acme".into(),
                "/Applications/Codex Helm.app/Contents/MacOS/Codex Helm".into(),
            )
            .unwrap();
        let config = std::fs::read_to_string(paths.config_file()).unwrap();

        assert!(config.contains("model_provider = \"acme\""));
        assert!(config.contains("model = \"gpt-5.5\""));
        assert!(
            config.contains("command = \"/Applications/Codex Helm.app/Contents/MacOS/Codex Helm\"")
        );
        assert!(config.contains("\"--provider-token\""));
    }

    #[test]
    fn activate_openai_clears_custom_auth_bridge() {
        let temp = tempdir().unwrap();
        let paths = AppPaths::from_home(temp.path().to_path_buf());
        let service = ProviderService::new(paths.clone());

        service
            .save_provider(ProviderRecord {
                id: "acme".into(),
                name: "Acme".into(),
                kind: ProviderKind::Custom,
                base_url: "https://example.com/v1".into(),
                model: "gpt-5.5".into(),
                api_key: "sk-acme-123456".into(),
                env_key: String::new(),
                http_headers: BTreeMap::new(),
                query_params: BTreeMap::new(),
                supports_websockets: false,
                active: false,
                enabled: true,
                last_validated_at: None,
                last_validation_status: "unknown".into(),
            })
            .unwrap();

        service
            .activate_provider("acme".into(), "/tmp/codex-helm".into())
            .unwrap();
        service
            .activate_provider("openai".into(), "/tmp/codex-helm".into())
            .unwrap();

        let config = std::fs::read_to_string(paths.config_file()).unwrap();
        assert!(config.contains("model_provider = \"openai\""));
        assert!(!config.contains("--provider-token"));
        assert!(!config.contains("command = \"/tmp/codex-helm\""));
        assert!(!config.contains("[model_providers.openai]"));
        assert!(!config.contains("requires_openai_auth = true"));
    }

    #[test]
    fn restore_official_defaults_clears_api_overrides_and_marks_openai_active() {
        let temp = tempdir().unwrap();
        let paths = AppPaths::from_home(temp.path().to_path_buf());
        let service = ProviderService::new(paths.clone());

        service
            .save_provider(ProviderRecord {
                id: "acme".into(),
                name: "Acme".into(),
                kind: ProviderKind::Custom,
                base_url: "https://example.com/v1".into(),
                model: "gpt-5.5".into(),
                api_key: "sk-acme-123456".into(),
                env_key: String::new(),
                http_headers: BTreeMap::new(),
                query_params: BTreeMap::new(),
                supports_websockets: false,
                active: false,
                enabled: true,
                last_validated_at: None,
                last_validation_status: "unknown".into(),
            })
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
args = ["--provider-token", "acme"]

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
        assert!(!config.contains("--provider-token"));
        assert!(providers
            .iter()
            .any(|provider| provider.id == "openai" && provider.active));
    }
}
