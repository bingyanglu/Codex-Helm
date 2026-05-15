use crate::models::{MonitorLogsResponse, MonitorQuota, MonitorSummary, MonitorTrendPoint};
use crate::monitor::MonitorService;
use crate::paths::AppPaths;

#[tauri::command]
pub async fn get_monitor_summary(range_days: i64) -> Result<MonitorSummary, String> {
    MonitorService::new(AppPaths::detect())
        .get_summary(range_days)
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn get_monitor_trend(range_days: i64) -> Result<Vec<MonitorTrendPoint>, String> {
    MonitorService::new(AppPaths::detect())
        .get_trend(range_days)
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn get_monitor_logs(
    range_days: i64,
    page: i64,
    page_size: i64,
) -> Result<MonitorLogsResponse, String> {
    MonitorService::new(AppPaths::detect())
        .get_logs(range_days, page, page_size)
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn get_monitor_quota() -> Result<MonitorQuota, String> {
    MonitorService::new(AppPaths::detect())
        .get_quota()
        .await
        .map_err(|error| error.to_string())
}
