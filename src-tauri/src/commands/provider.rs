use crate::models::{ProviderConnectivityResult, ProviderRecord, ProviderValidationResult};
use crate::paths::AppPaths;
use crate::provider::ProviderService;

#[tauri::command]
pub fn list_providers() -> Result<Vec<ProviderRecord>, String> {
    ProviderService::new(AppPaths::detect())
        .list_providers()
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn save_provider(provider: ProviderRecord) -> Result<Vec<ProviderRecord>, String> {
    ProviderService::new(AppPaths::detect())
        .save_provider(provider)
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn delete_provider(local_id: i64) -> Result<Vec<ProviderRecord>, String> {
    ProviderService::new(AppPaths::detect())
        .delete_provider(local_id)
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn activate_provider(local_id: i64) -> Result<Vec<ProviderRecord>, String> {
    let executable_path = std::env::current_exe().map_err(|error| error.to_string())?;
    ProviderService::new(AppPaths::detect())
        .activate_provider(local_id, executable_path.display().to_string())
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn restore_official_provider_defaults() -> Result<Vec<ProviderRecord>, String> {
    ProviderService::new(AppPaths::detect())
        .restore_official_provider_defaults()
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn validate_provider(provider: ProviderRecord) -> Result<ProviderValidationResult, String> {
    ProviderService::new(AppPaths::detect())
        .validate_provider(&provider)
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn test_provider_connectivity(
    provider: ProviderRecord,
) -> Result<ProviderConnectivityResult, String> {
    ProviderService::new(AppPaths::detect())
        .test_connectivity(provider)
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn validate_provider_key(
    provider: ProviderRecord,
) -> Result<ProviderConnectivityResult, String> {
    ProviderService::new(AppPaths::detect())
        .validate_key(provider)
        .await
        .map_err(|error| error.to_string())
}
