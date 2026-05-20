use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum AuthMode {
    Chatgpt,
    Apikey,
    LoggedOut,
}

impl AuthMode {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Chatgpt => "chatgpt",
            Self::Apikey => "apikey",
            Self::LoggedOut => "logged_out",
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AuthStatus {
    pub mode: AuthMode,
    pub masked_token: Option<String>,
    pub source_path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InstallStatus {
    pub installed: bool,
    pub version: Option<String>,
    pub path: Option<String>,
    pub detail: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OverviewStatus {
    pub cli: InstallStatus,
    pub app: InstallStatus,
    pub auth_mode: AuthMode,
    pub active_provider: Option<String>,
    pub active_provider_base_url: Option<String>,
    pub monitor_available: bool,
    pub model: Option<String>,
    pub sandbox_mode: Option<String>,
    pub approval_policy: Option<String>,
    pub config_path: String,
    pub config_exists: bool,
    pub config_last_modified: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum ProviderKind {
    Builtin,
    Custom,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProviderRecord {
    #[serde(default)]
    pub local_id: i64,
    pub provider_id: String,
    pub name: String,
    pub kind: ProviderKind,
    pub base_url: String,
    #[serde(default)]
    pub model: String,
    pub api_key: String,
    pub env_key: String,
    pub http_headers: BTreeMap<String, String>,
    pub query_params: BTreeMap<String, String>,
    pub supports_websockets: bool,
    pub active: bool,
    pub enabled: bool,
    pub last_validated_at: Option<String>,
    pub last_validation_status: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SettingsFile {
    pub version: u32,
    pub providers: Vec<ProviderRecord>,
    #[serde(default)]
    pub first_start_import_handled: bool,
    #[serde(default)]
    pub last_active_custom_provider_id: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FirstStartCandidate {
    pub id: String,
    pub name: String,
    pub base_url: String,
    pub model: String,
    pub api_key: String,
    pub source: String,
    pub complete: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum FirstStartScanState {
    Detected,
    Partial,
    Fresh,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FirstStartScanResult {
    pub state: FirstStartScanState,
    pub handled: bool,
    pub candidates: Vec<FirstStartCandidate>,
    pub config_exists: bool,
    pub auth_exists: bool,
    pub config_path: Option<String>,
    pub auth_mode: Option<AuthMode>,
    pub env_keys: Vec<String>,
    pub last_active_custom_provider_id: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FirstStartImportInput {
    pub candidates: Vec<FirstStartCandidate>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FirstStartImportResult {
    pub providers: Vec<ProviderRecord>,
    pub imported_provider_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GlobalConfigInput {
    pub model: String,
    pub model_provider: String,
    pub approval_policy: String,
    pub sandbox_mode: String,
    pub web_search: String,
    pub tools_view_image: bool,
    pub history_persistence: String,
    pub history_max_bytes: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConfigBackupRecord {
    pub backup_path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GlobalConfigView {
    pub model: String,
    pub model_provider: String,
    pub approval_policy: String,
    pub sandbox_mode: String,
    pub web_search: String,
    pub tools_view_image: bool,
    pub history_persistence: String,
    pub history_max_bytes: i64,
    pub raw_toml: String,
    pub backup_path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProviderValidationResult {
    pub ok: bool,
    pub detail: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProviderConnectivityResult {
    pub reachable: bool,
    pub authenticated: bool,
    pub latency_ms: u128,
    pub detail: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MonitorSummary {
    pub total_requests: i64,
    pub success_requests: i64,
    pub failed_requests: i64,
    pub success_rate: f64,
    pub total_tokens: i64,
    pub input_tokens: i64,
    pub output_tokens: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MonitorTrendPoint {
    pub key: String,
    pub label: String,
    pub title: String,
    pub input: i64,
    pub output: i64,
    pub total: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MonitorLogEntry {
    pub id: String,
    pub timestamp: String,
    pub model: String,
    pub failed: bool,
    pub input: i64,
    pub output: i64,
    pub total_tokens: i64,
    pub total_duration_ms: i64,
    pub first_token_latency_ms: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MonitorLogsResponse {
    pub items: Vec<MonitorLogEntry>,
    pub total: i64,
    pub total_pages: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MonitorQuotaWindow {
    pub id: String,
    pub label: String,
    pub remaining_percent: Option<i64>,
    pub reset_label: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MonitorQuota {
    pub plan_type: Option<String>,
    pub windows: Vec<MonitorQuotaWindow>,
}
