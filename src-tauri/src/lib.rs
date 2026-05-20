pub mod auth;
pub mod commands;
pub mod config;
pub mod error;
pub mod first_start;
pub mod models;
pub mod monitor;
pub mod overview;
pub mod paths;
pub mod provider;
pub mod settings;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            commands::auth::get_auth_status,
            commands::overview::get_overview_status,
            commands::config::get_global_config,
            commands::config::save_global_config,
            commands::config::get_raw_global_config,
            commands::config::list_config_backups,
            commands::provider::list_providers,
            commands::provider::save_provider,
            commands::provider::delete_provider,
            commands::provider::activate_provider,
            commands::provider::restore_official_provider_defaults,
            commands::provider::switch_run_mode,
            commands::provider::validate_provider,
            commands::provider::test_provider_connectivity,
            commands::provider::validate_provider_key,
            commands::first_start::scan_first_start_import,
            commands::first_start::import_first_start_provider,
            commands::first_start::mark_first_start_import_handled,
            commands::monitor::get_monitor_summary,
            commands::monitor::get_monitor_trend,
            commands::monitor::get_monitor_logs,
            commands::monitor::get_monitor_quota
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
