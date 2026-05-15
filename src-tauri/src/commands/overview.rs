use crate::overview::read_overview_status;
use crate::paths::AppPaths;

#[tauri::command]
pub fn get_overview_status() -> Result<crate::models::OverviewStatus, String> {
    let paths = AppPaths::detect();
    read_overview_status(&paths).map_err(|error| error.to_string())
}
