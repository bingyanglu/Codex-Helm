use crate::error::AppResult;
use crate::models::{ProviderKind, ProviderRecord, SettingsFile};
use crate::paths::AppPaths;
use std::collections::BTreeMap;

pub struct SettingsStore {
    paths: AppPaths,
}

impl SettingsStore {
    pub fn new(paths: AppPaths) -> Self {
        Self { paths }
    }

    pub fn load_or_create(&self) -> AppResult<SettingsFile> {
        std::fs::create_dir_all(self.paths.manager_dir())?;

        let (settings, needs_save) = if self.paths.settings_file().exists() {
            let content = std::fs::read_to_string(self.paths.settings_file())?;
            let parsed: SettingsFile = serde_json::from_str(&content)?;
            self.inject_builtins(parsed)
        } else {
            (
                SettingsFile {
                    version: 1,
                    providers: builtin_providers(),
                },
                true,
            )
        };

        if needs_save {
            self.save(&settings)?;
        }
        Ok(settings)
    }

    pub fn save(&self, settings: &SettingsFile) -> AppResult<()> {
        std::fs::create_dir_all(self.paths.manager_dir())?;
        let json = serde_json::to_string_pretty(settings)?;
        std::fs::write(self.paths.settings_file(), json)?;
        enforce_private_permissions(&self.paths.settings_file())?;
        Ok(())
    }

    fn inject_builtins(&self, mut settings: SettingsFile) -> (SettingsFile, bool) {
        let mut changed = false;

        for builtin in builtin_providers() {
            if !settings
                .providers
                .iter()
                .any(|provider| provider.id == builtin.id)
            {
                settings.providers.push(builtin);
                changed = true;
            }
        }

        (settings, changed)
    }
}

fn builtin_providers() -> Vec<ProviderRecord> {
    vec![
        ProviderRecord {
            id: "openai".into(),
            name: "OpenAI".into(),
            kind: ProviderKind::Builtin,
            base_url: "https://api.openai.com/v1".into(),
            model: String::new(),
            api_key: String::new(),
            env_key: "OPENAI_API_KEY".into(),
            http_headers: BTreeMap::new(),
            query_params: BTreeMap::new(),
            supports_websockets: false,
            active: true,
            enabled: true,
            last_validated_at: None,
            last_validation_status: "unknown".into(),
        },
        ProviderRecord {
            id: "ollama".into(),
            name: "Ollama".into(),
            kind: ProviderKind::Builtin,
            base_url: "http://127.0.0.1:11434/v1".into(),
            model: String::new(),
            api_key: String::new(),
            env_key: String::new(),
            http_headers: BTreeMap::new(),
            query_params: BTreeMap::new(),
            supports_websockets: false,
            active: false,
            enabled: true,
            last_validated_at: None,
            last_validation_status: "unknown".into(),
        },
        ProviderRecord {
            id: "lmstudio".into(),
            name: "LM Studio".into(),
            kind: ProviderKind::Builtin,
            base_url: "http://127.0.0.1:1234/v1".into(),
            model: String::new(),
            api_key: String::new(),
            env_key: String::new(),
            http_headers: BTreeMap::new(),
            query_params: BTreeMap::new(),
            supports_websockets: false,
            active: false,
            enabled: true,
            last_validated_at: None,
            last_validation_status: "unknown".into(),
        },
    ]
}

#[cfg(unix)]
fn enforce_private_permissions(path: &std::path::Path) -> AppResult<()> {
    use std::os::unix::fs::PermissionsExt;

    let mut permissions = std::fs::metadata(path)?.permissions();
    permissions.set_mode(0o600);
    std::fs::set_permissions(path, permissions)?;
    Ok(())
}

#[cfg(not(unix))]
fn enforce_private_permissions(_path: &std::path::Path) -> AppResult<()> {
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::paths::AppPaths;
    use tempfile::tempdir;

    #[test]
    fn load_or_create_seeds_builtins_and_writes_mode_600() {
        let temp = tempdir().unwrap();
        let paths = AppPaths::from_home(temp.path().to_path_buf());
        let store = SettingsStore::new(paths.clone());

        let settings = store.load_or_create().unwrap();

        assert_eq!(settings.providers.len(), 3);
        assert!(settings
            .providers
            .iter()
            .any(|provider| provider.id == "openai"));

        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let mode = std::fs::metadata(paths.settings_file())
                .unwrap()
                .permissions()
                .mode()
                & 0o777;
            assert_eq!(mode, 0o600);
        }
    }

    #[cfg(unix)]
    #[test]
    fn load_or_create_does_not_rewrite_existing_complete_settings() {
        use std::os::unix::fs::PermissionsExt;

        let temp = tempdir().unwrap();
        let paths = AppPaths::from_home(temp.path().to_path_buf());
        let store = SettingsStore::new(paths.clone());
        std::fs::create_dir_all(paths.manager_dir()).unwrap();

        let existing = SettingsFile {
            version: 1,
            providers: builtin_providers(),
        };
        std::fs::write(
            paths.settings_file(),
            serde_json::to_string_pretty(&existing).unwrap(),
        )
        .unwrap();

        let mut permissions = std::fs::metadata(paths.settings_file())
            .unwrap()
            .permissions();
        permissions.set_mode(0o400);
        std::fs::set_permissions(paths.settings_file(), permissions).unwrap();

        let loaded = store.load_or_create().unwrap();

        assert_eq!(loaded.providers.len(), existing.providers.len());
        assert!(loaded.providers.iter().any(|provider| provider.id == "openai"));
    }
}
