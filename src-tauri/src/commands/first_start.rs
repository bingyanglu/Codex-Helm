use crate::first_start::FirstStartService;
use crate::models::{FirstStartImportInput, FirstStartImportResult, FirstStartScanResult};
use crate::paths::AppPaths;

#[tauri::command]
pub fn scan_first_start_import() -> Result<FirstStartScanResult, String> {
    FirstStartService::new(AppPaths::detect())
        .scan()
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn import_first_start_provider(
    input: FirstStartImportInput,
) -> Result<FirstStartImportResult, String> {
    FirstStartService::new(AppPaths::detect())
        .import_candidate(input)
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn mark_first_start_import_handled() -> Result<(), String> {
    FirstStartService::new(AppPaths::detect())
        .mark_handled()
        .map_err(|error| error.to_string())
}
