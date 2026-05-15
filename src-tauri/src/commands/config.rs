use crate::config::ConfigStore;
use crate::models::{ConfigBackupRecord, GlobalConfigInput, GlobalConfigView};
use crate::paths::AppPaths;

#[tauri::command]
pub fn get_global_config() -> Result<GlobalConfigView, String> {
    ConfigStore::new(AppPaths::detect())
        .get_global_config()
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn save_global_config(input: GlobalConfigInput) -> Result<GlobalConfigView, String> {
    ConfigStore::new(AppPaths::detect())
        .save_global_config(input)
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn get_raw_global_config() -> Result<String, String> {
    ConfigStore::new(AppPaths::detect())
        .get_raw_config()
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn list_config_backups() -> Result<Vec<ConfigBackupRecord>, String> {
    ConfigStore::new(AppPaths::detect())
        .list_backups()
        .map_err(|error| error.to_string())
}
