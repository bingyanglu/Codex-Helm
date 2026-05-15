use crate::auth::read_auth_status;
use crate::paths::AppPaths;

#[tauri::command]
pub fn get_auth_status() -> Result<crate::models::AuthStatus, String> {
    let paths = AppPaths::detect();
    read_auth_status(&paths).map_err(|error| error.to_string())
}
