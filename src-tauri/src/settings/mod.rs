use crate::error::AppResult;
use crate::models::{ProviderKind, ProviderRecord, SettingsFile};
use crate::paths::AppPaths;
use rusqlite::{params, Connection, OptionalExtension};
use serde::Deserialize;
use std::collections::BTreeMap;

pub struct SettingsStore {
    paths: AppPaths,
}

impl SettingsStore {
    pub fn new(paths: AppPaths) -> Self {
        Self { paths }
    }

    pub fn load_or_create(&self) -> AppResult<SettingsFile> {
        let connection = self.open()?;
        self.ensure_schema(&connection)?;
        self.migrate_legacy_json_if_needed(&connection)?;
        self.seed_builtins(&connection)?;
        self.load_from_db(&connection)
    }

    pub fn save(&self, settings: &SettingsFile) -> AppResult<()> {
        let mut connection = self.open()?;
        self.ensure_schema(&connection)?;
        let transaction = connection.transaction()?;

        transaction.execute(
            "INSERT INTO app_state (key, value) VALUES ('version', ?1)
             ON CONFLICT(key) DO UPDATE SET value = excluded.value",
            [settings.version.to_string()],
        )?;
        transaction.execute(
            "INSERT INTO app_state (key, value) VALUES ('first_start_import_handled', ?1)
             ON CONFLICT(key) DO UPDATE SET value = excluded.value",
            [if settings.first_start_import_handled {
                "1"
            } else {
                "0"
            }],
        )?;
        if let Some(local_id) = settings.last_active_custom_provider_id {
            transaction.execute(
                "INSERT INTO app_state (key, value) VALUES ('last_active_custom_provider_id', ?1)
                 ON CONFLICT(key) DO UPDATE SET value = excluded.value",
                [local_id.to_string()],
            )?;
        } else {
            transaction.execute(
                "DELETE FROM app_state WHERE key = 'last_active_custom_provider_id'",
                [],
            )?;
        }

        if settings.providers.iter().any(|provider| provider.active) {
            transaction.execute("UPDATE providers SET active = 0", [])?;
        }
        let retained_local_ids: Vec<i64> = settings
            .providers
            .iter()
            .filter_map(|provider| (provider.local_id > 0).then_some(provider.local_id))
            .collect();
        let mut existing_ids_statement = transaction.prepare("SELECT local_id FROM providers")?;
        let existing_ids = existing_ids_statement
            .query_map([], |row| row.get::<_, i64>(0))?
            .collect::<Result<Vec<_>, _>>()?;
        drop(existing_ids_statement);
        for existing_id in existing_ids {
            if !retained_local_ids.contains(&existing_id) {
                transaction.execute("DELETE FROM providers WHERE local_id = ?1", [existing_id])?;
            }
        }
        for provider in &settings.providers {
            upsert_provider(&transaction, provider)?;
        }

        transaction.commit()?;
        enforce_private_permissions(&self.paths.settings_db_file())?;
        Ok(())
    }

    pub fn save_provider(&self, provider: &ProviderRecord) -> AppResult<ProviderRecord> {
        let mut connection = self.open()?;
        self.ensure_schema(&connection)?;
        let transaction = connection.transaction()?;
        let local_id = upsert_provider(&transaction, provider)?;
        transaction.commit()?;
        enforce_private_permissions(&self.paths.settings_db_file())?;
        self.provider_by_local_id(local_id)
    }

    pub fn provider_by_local_id(&self, local_id: i64) -> AppResult<ProviderRecord> {
        let connection = self.open()?;
        self.ensure_schema(&connection)?;
        select_provider_by_local_id(&connection, local_id)
    }

    fn open(&self) -> AppResult<Connection> {
        std::fs::create_dir_all(self.paths.manager_dir())?;
        Ok(Connection::open(self.paths.settings_db_file())?)
    }

    fn ensure_schema(&self, connection: &Connection) -> AppResult<()> {
        connection.execute_batch(
            r#"
            PRAGMA foreign_keys = ON;

            CREATE TABLE IF NOT EXISTS app_state (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS providers (
                local_id INTEGER PRIMARY KEY AUTOINCREMENT,
                provider_id TEXT NOT NULL,
                name TEXT NOT NULL,
                kind TEXT NOT NULL,
                base_url TEXT NOT NULL,
                model TEXT NOT NULL DEFAULT '',
                api_key TEXT NOT NULL DEFAULT '',
                env_key TEXT NOT NULL DEFAULT '',
                http_headers_json TEXT NOT NULL DEFAULT '{}',
                query_params_json TEXT NOT NULL DEFAULT '{}',
                supports_websockets INTEGER NOT NULL DEFAULT 0,
                active INTEGER NOT NULL DEFAULT 0,
                enabled INTEGER NOT NULL DEFAULT 1,
                last_validated_at TEXT,
                last_validation_status TEXT NOT NULL DEFAULT 'unknown',
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );

            CREATE UNIQUE INDEX IF NOT EXISTS uniq_builtin_provider_id
                ON providers(provider_id)
                WHERE kind = 'builtin';

            CREATE UNIQUE INDEX IF NOT EXISTS one_active_provider
                ON providers(active)
                WHERE active = 1;
            "#,
        )?;
        enforce_private_permissions(&self.paths.settings_db_file())?;
        Ok(())
    }

    fn load_from_db(&self, connection: &Connection) -> AppResult<SettingsFile> {
        let version = read_state(connection, "version")?
            .and_then(|value| value.parse::<u32>().ok())
            .unwrap_or(1);
        let first_start_import_handled = read_state(connection, "first_start_import_handled")?
            .is_some_and(|value| value == "1" || value.eq_ignore_ascii_case("true"));
        let last_active_custom_provider_id =
            read_state(connection, "last_active_custom_provider_id")?
                .and_then(|value| value.parse::<i64>().ok());

        let mut statement = connection.prepare(
            "SELECT local_id, provider_id, name, kind, base_url, model, api_key, env_key,
                    http_headers_json, query_params_json, supports_websockets, active, enabled,
                    last_validated_at, last_validation_status
             FROM providers
             ORDER BY kind = 'builtin' DESC, active DESC, name COLLATE NOCASE, local_id",
        )?;
        let providers = statement
            .query_map([], provider_from_row)?
            .collect::<Result<Vec<_>, _>>()?;

        Ok(SettingsFile {
            version,
            providers,
            first_start_import_handled,
            last_active_custom_provider_id,
        })
    }

    fn seed_builtins(&self, connection: &Connection) -> AppResult<()> {
        let has_active_provider: bool = connection.query_row(
            "SELECT EXISTS(SELECT 1 FROM providers WHERE active = 1)",
            [],
            |row| row.get::<_, i64>(0),
        )? != 0;
        for builtin in builtin_providers() {
            let active = builtin.active && !has_active_provider;
            connection.execute(
                "INSERT INTO providers (
                    provider_id, name, kind, base_url, model, api_key, env_key,
                    http_headers_json, query_params_json, supports_websockets, active, enabled,
                    last_validated_at, last_validation_status
                 ) VALUES (?1, ?2, 'builtin', ?3, ?4, ?5, ?6, '{}', '{}', ?7, ?8, ?9, ?10, ?11)
                 ON CONFLICT(provider_id) WHERE kind = 'builtin' DO NOTHING",
                params![
                    builtin.provider_id,
                    builtin.name,
                    builtin.base_url,
                    builtin.model,
                    builtin.api_key,
                    builtin.env_key,
                    bool_to_i64(builtin.supports_websockets),
                    bool_to_i64(active),
                    bool_to_i64(builtin.enabled),
                    builtin.last_validated_at,
                    builtin.last_validation_status,
                ],
            )?;
        }
        Ok(())
    }

    fn migrate_legacy_json_if_needed(&self, connection: &Connection) -> AppResult<()> {
        if !self.paths.settings_file().exists()
            || read_state(connection, "legacy_json_imported")?.is_some()
        {
            return Ok(());
        }

        let provider_count: i64 =
            connection.query_row("SELECT COUNT(*) FROM providers", [], |row| row.get(0))?;
        if provider_count > 0 {
            connection.execute(
                "INSERT INTO app_state (key, value) VALUES ('legacy_json_imported', '1')
                 ON CONFLICT(key) DO UPDATE SET value = excluded.value",
                [],
            )?;
            return Ok(());
        }

        let content = std::fs::read_to_string(self.paths.settings_file())?;
        let legacy: LegacySettingsFile = serde_json::from_str(&content)?;
        connection.execute(
            "INSERT INTO app_state (key, value) VALUES ('version', ?1)
             ON CONFLICT(key) DO UPDATE SET value = excluded.value",
            [legacy.version.to_string()],
        )?;
        connection.execute(
            "INSERT INTO app_state (key, value) VALUES ('first_start_import_handled', ?1)
             ON CONFLICT(key) DO UPDATE SET value = excluded.value",
            [if legacy.first_start_import_handled {
                "1"
            } else {
                "0"
            }],
        )?;

        let mut last_active_custom_local_id = None;
        for legacy_provider in legacy.providers {
            let provider = legacy_provider.into_provider_record();
            let local_id = upsert_provider(connection, &provider)?;
            if provider.kind == ProviderKind::Custom && provider.active {
                last_active_custom_local_id = Some(local_id);
            }
        }
        if let Some(local_id) = last_active_custom_local_id {
            connection.execute(
                "INSERT INTO app_state (key, value) VALUES ('last_active_custom_provider_id', ?1)
                 ON CONFLICT(key) DO UPDATE SET value = excluded.value",
                [local_id.to_string()],
            )?;
        }
        connection.execute(
            "INSERT INTO app_state (key, value) VALUES ('legacy_json_imported', '1')
             ON CONFLICT(key) DO UPDATE SET value = excluded.value",
            [],
        )?;
        Ok(())
    }
}

fn builtin_providers() -> Vec<ProviderRecord> {
    vec![
        ProviderRecord {
            local_id: 0,
            provider_id: "openai".into(),
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
            local_id: 0,
            provider_id: "ollama".into(),
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
            local_id: 0,
            provider_id: "lmstudio".into(),
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

fn upsert_provider(connection: &Connection, provider: &ProviderRecord) -> AppResult<i64> {
    let http_headers_json = serde_json::to_string(&provider.http_headers)?;
    let query_params_json = serde_json::to_string(&provider.query_params)?;

    if provider.local_id > 0 {
        connection.execute(
            "UPDATE providers
             SET provider_id = ?1, name = ?2, kind = ?3, base_url = ?4, model = ?5,
                 api_key = ?6, env_key = ?7, http_headers_json = ?8, query_params_json = ?9,
                 supports_websockets = ?10, active = ?11, enabled = ?12,
                 last_validated_at = ?13, last_validation_status = ?14,
                 updated_at = CURRENT_TIMESTAMP
             WHERE local_id = ?15",
            params![
                provider.provider_id,
                provider.name,
                provider.kind.as_str(),
                provider.base_url,
                provider.model,
                provider.api_key,
                provider.env_key,
                http_headers_json,
                query_params_json,
                bool_to_i64(provider.supports_websockets),
                bool_to_i64(provider.active),
                bool_to_i64(provider.enabled),
                provider.last_validated_at,
                provider.last_validation_status,
                provider.local_id,
            ],
        )?;
        return Ok(provider.local_id);
    }

    connection.execute(
        "INSERT INTO providers (
            provider_id, name, kind, base_url, model, api_key, env_key,
            http_headers_json, query_params_json, supports_websockets, active, enabled,
            last_validated_at, last_validation_status
         ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14)",
        params![
            provider.provider_id,
            provider.name,
            provider.kind.as_str(),
            provider.base_url,
            provider.model,
            provider.api_key,
            provider.env_key,
            http_headers_json,
            query_params_json,
            bool_to_i64(provider.supports_websockets),
            bool_to_i64(provider.active),
            bool_to_i64(provider.enabled),
            provider.last_validated_at,
            provider.last_validation_status,
        ],
    )?;
    Ok(connection.last_insert_rowid())
}

fn select_provider_by_local_id(
    connection: &Connection,
    local_id: i64,
) -> AppResult<ProviderRecord> {
    Ok(connection.query_row(
        "SELECT local_id, provider_id, name, kind, base_url, model, api_key, env_key,
                http_headers_json, query_params_json, supports_websockets, active, enabled,
                last_validated_at, last_validation_status
         FROM providers
         WHERE local_id = ?1",
        [local_id],
        provider_from_row,
    )?)
}

fn provider_from_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<ProviderRecord> {
    let kind_raw: String = row.get(3)?;
    let http_headers_json: String = row.get(8)?;
    let query_params_json: String = row.get(9)?;
    Ok(ProviderRecord {
        local_id: row.get(0)?,
        provider_id: row.get(1)?,
        name: row.get(2)?,
        kind: if kind_raw == "builtin" {
            ProviderKind::Builtin
        } else {
            ProviderKind::Custom
        },
        base_url: row.get(4)?,
        model: row.get(5)?,
        api_key: row.get(6)?,
        env_key: row.get(7)?,
        http_headers: serde_json::from_str(&http_headers_json).unwrap_or_default(),
        query_params: serde_json::from_str(&query_params_json).unwrap_or_default(),
        supports_websockets: row.get::<_, i64>(10)? != 0,
        active: row.get::<_, i64>(11)? != 0,
        enabled: row.get::<_, i64>(12)? != 0,
        last_validated_at: row.get(13)?,
        last_validation_status: row.get(14)?,
    })
}

fn read_state(connection: &Connection, key: &str) -> AppResult<Option<String>> {
    Ok(connection
        .query_row("SELECT value FROM app_state WHERE key = ?1", [key], |row| {
            row.get(0)
        })
        .optional()?)
}

fn bool_to_i64(value: bool) -> i64 {
    if value {
        1
    } else {
        0
    }
}

impl ProviderKind {
    fn as_str(&self) -> &'static str {
        match self {
            Self::Builtin => "builtin",
            Self::Custom => "custom",
        }
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct LegacySettingsFile {
    version: u32,
    providers: Vec<LegacyProviderRecord>,
    #[serde(default)]
    first_start_import_handled: bool,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct LegacyProviderRecord {
    id: String,
    name: String,
    kind: ProviderKind,
    base_url: String,
    #[serde(default)]
    model: String,
    api_key: String,
    env_key: String,
    #[serde(default)]
    http_headers: BTreeMap<String, String>,
    #[serde(default)]
    query_params: BTreeMap<String, String>,
    supports_websockets: bool,
    active: bool,
    enabled: bool,
    last_validated_at: Option<String>,
    last_validation_status: String,
}

impl LegacyProviderRecord {
    fn into_provider_record(self) -> ProviderRecord {
        ProviderRecord {
            local_id: 0,
            provider_id: self.id,
            name: self.name,
            kind: self.kind,
            base_url: self.base_url,
            model: self.model,
            api_key: self.api_key,
            env_key: self.env_key,
            http_headers: self.http_headers,
            query_params: self.query_params,
            supports_websockets: self.supports_websockets,
            active: self.active,
            enabled: self.enabled,
            last_validated_at: self.last_validated_at,
            last_validation_status: self.last_validation_status,
        }
    }
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
            .any(|provider| provider.provider_id == "openai" && provider.local_id > 0));

        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let mode = std::fs::metadata(paths.settings_db_file())
                .unwrap()
                .permissions()
                .mode()
                & 0o777;
            assert_eq!(mode, 0o600);
        }
    }

    #[test]
    fn load_or_create_migrates_legacy_json_without_deleting_it() {
        let temp = tempdir().unwrap();
        let paths = AppPaths::from_home(temp.path().to_path_buf());
        std::fs::create_dir_all(paths.manager_dir()).unwrap();
        std::fs::write(
            paths.settings_file(),
            r#"{
              "version": 1,
              "providers": [{
                "id": "jobmd",
                "name": "jobmd",
                "kind": "custom",
                "baseUrl": "https://example.com/v1",
                "model": "gpt-5.5",
                "apiKey": "sk-old",
                "envKey": "",
                "httpHeaders": {},
                "queryParams": {},
                "supportsWebsockets": false,
                "active": true,
                "enabled": true,
                "lastValidatedAt": null,
                "lastValidationStatus": "unknown"
              }],
              "firstStartImportHandled": true,
              "lastActiveCustomProviderId": "jobmd"
            }"#,
        )
        .unwrap();

        let settings = SettingsStore::new(paths.clone()).load_or_create().unwrap();

        assert!(paths.settings_file().exists());
        assert!(settings.first_start_import_handled);
        assert!(settings
            .providers
            .iter()
            .any(|provider| provider.provider_id == "jobmd" && provider.api_key == "sk-old"));
    }
}
