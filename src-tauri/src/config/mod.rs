use crate::error::{AppError, AppResult};
use crate::models::{ConfigBackupRecord, GlobalConfigInput, GlobalConfigView};
use crate::paths::AppPaths;
use toml::Value;

pub struct ConfigStore {
    paths: AppPaths,
}

impl ConfigStore {
    pub fn new(paths: AppPaths) -> Self {
        Self { paths }
    }

    pub fn get_global_config(&self) -> AppResult<GlobalConfigView> {
        let raw_toml = std::fs::read_to_string(self.paths.config_file()).unwrap_or_default();
        let parsed = parse_toml_or_empty(&raw_toml)?;
        Ok(build_view(parsed, raw_toml, String::new()))
    }

    pub fn save_global_config(&self, input: GlobalConfigInput) -> AppResult<GlobalConfigView> {
        std::fs::create_dir_all(self.paths.codex_dir())?;

        let existing = std::fs::read_to_string(self.paths.config_file()).unwrap_or_default();
        let backup_path = self.create_backup(&existing)?;
        let mut parsed = parse_toml_or_empty(&existing)?;

        set_string(&mut parsed, &["model"], input.model.clone());
        set_string(
            &mut parsed,
            &["model_provider"],
            input.model_provider.clone(),
        );
        set_string(
            &mut parsed,
            &["approval_policy"],
            input.approval_policy.clone(),
        );
        set_string(&mut parsed, &["sandbox_mode"], input.sandbox_mode.clone());
        set_string(&mut parsed, &["web_search"], input.web_search.clone());
        set_bool(
            &mut parsed,
            &["tools", "view_image"],
            input.tools_view_image,
        );
        set_string(
            &mut parsed,
            &["history", "persistence"],
            input.history_persistence.clone(),
        );
        set_integer(
            &mut parsed,
            &["history", "max_bytes"],
            input.history_max_bytes,
        );

        let raw_toml = toml::to_string_pretty(&parsed)?;
        std::fs::write(self.paths.config_file(), &raw_toml)?;

        Ok(build_view(parsed, raw_toml, backup_path))
    }

    pub fn get_raw_config(&self) -> AppResult<String> {
        Ok(std::fs::read_to_string(self.paths.config_file()).unwrap_or_default())
    }

    pub fn list_backups(&self) -> AppResult<Vec<ConfigBackupRecord>> {
        let backup_dir = self.paths.config_backup_dir();
        std::fs::create_dir_all(&backup_dir)?;

        let mut backups = Vec::new();
        for entry in std::fs::read_dir(backup_dir)? {
            let entry = entry?;
            backups.push(ConfigBackupRecord {
                backup_path: entry.path().display().to_string(),
            });
        }

        backups.sort_by(|left, right| right.backup_path.cmp(&left.backup_path));
        Ok(backups)
    }

    pub fn create_backup_from_current(&self, existing: &str) -> AppResult<String> {
        self.create_backup(existing)
    }

    fn create_backup(&self, existing: &str) -> AppResult<String> {
        std::fs::create_dir_all(self.paths.config_backup_dir())?;
        let timestamp = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map_err(|_| AppError::Message("system clock is before UNIX_EPOCH".into()))?
            .as_secs();
        let backup_path = self
            .paths
            .config_backup_dir()
            .join(format!("config-{timestamp}.toml"));
        std::fs::write(&backup_path, existing)?;
        Ok(backup_path.display().to_string())
    }
}

fn parse_toml_or_empty(raw_toml: &str) -> AppResult<Value> {
    if raw_toml.trim().is_empty() {
        return Ok(Value::Table(Default::default()));
    }

    raw_toml
        .parse::<Value>()
        .map_err(|error| AppError::Message(error.to_string()))
}

fn build_view(value: Value, raw_toml: String, backup_path: String) -> GlobalConfigView {
    GlobalConfigView {
        model: read_string(&value, &["model"]),
        model_provider: read_string(&value, &["model_provider"]),
        approval_policy: read_string(&value, &["approval_policy"]),
        sandbox_mode: read_string(&value, &["sandbox_mode"]),
        web_search: read_string(&value, &["web_search"]),
        tools_view_image: read_bool(&value, &["tools", "view_image"]),
        history_persistence: read_string(&value, &["history", "persistence"]),
        history_max_bytes: read_integer(&value, &["history", "max_bytes"]),
        raw_toml,
        backup_path,
    }
}

fn read_string(value: &Value, path: &[&str]) -> String {
    get_nested(value, path)
        .and_then(Value::as_str)
        .unwrap_or_default()
        .to_string()
}

fn read_bool(value: &Value, path: &[&str]) -> bool {
    get_nested(value, path)
        .and_then(Value::as_bool)
        .unwrap_or(false)
}

fn read_integer(value: &Value, path: &[&str]) -> i64 {
    get_nested(value, path)
        .and_then(Value::as_integer)
        .unwrap_or_default()
}

fn get_nested<'a>(value: &'a Value, path: &[&str]) -> Option<&'a Value> {
    let mut current = value;
    for segment in path {
        current = current.get(*segment)?;
    }
    Some(current)
}

fn set_string(root: &mut Value, path: &[&str], value: String) {
    set_value(root, path, Value::String(value));
}

fn set_bool(root: &mut Value, path: &[&str], value: bool) {
    set_value(root, path, Value::Boolean(value));
}

fn set_integer(root: &mut Value, path: &[&str], value: i64) {
    set_value(root, path, Value::Integer(value));
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
    use crate::models::GlobalConfigInput;
    use tempfile::tempdir;

    #[test]
    fn save_global_config_creates_backup_and_preserves_unknown_keys() {
        let temp = tempdir().unwrap();
        let paths = AppPaths::from_home(temp.path().to_path_buf());
        std::fs::create_dir_all(paths.codex_dir()).unwrap();
        std::fs::write(
            paths.config_file(),
            r#"
model = "old-model"
custom_flag = true

[tools]
view_image = false
"#,
        )
        .unwrap();

        let store = ConfigStore::new(paths.clone());
        let saved = store
            .save_global_config(GlobalConfigInput {
                model: "gpt-5.5".into(),
                model_provider: "openai".into(),
                approval_policy: "on-request".into(),
                sandbox_mode: "workspace-write".into(),
                web_search: "live".into(),
                tools_view_image: true,
                history_persistence: "save-all".into(),
                history_max_bytes: 1_048_576,
            })
            .unwrap();

        let content = std::fs::read_to_string(paths.config_file()).unwrap();
        assert!(content.contains("custom_flag = true"));
        assert!(saved.backup_path.contains(".codex-manager/backups/config/"));
    }
}
