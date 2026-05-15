use crate::error::{AppError, AppResult};
use crate::models::{
    MonitorLogEntry, MonitorLogsResponse, MonitorQuota, MonitorQuotaWindow, MonitorSummary,
    MonitorTrendPoint,
};
use crate::paths::AppPaths;
use crate::settings::SettingsStore;
use chrono::{DateTime, Duration, Local};
use reqwest::header::{HeaderMap, HeaderValue, AUTHORIZATION};
use serde_json::Value as JsonValue;
use toml::Value as TomlValue;

const SUPPORTED_MONITOR_BASE_URLS: [&str; 3] = [
    "http://cpa.host.dxy",
    "http://cpa.host.dxy/v1",
    "http://8.222.84.224:5667/v1",
];
const MONITOR_MANAGEMENT_PREFIX: &str = "/v0/management/public/custom/monitor";
const FIVE_HOUR_WINDOW_SECONDS: i64 = 18_000;
const WEEKLY_WINDOW_SECONDS: i64 = 604_800;

pub fn is_supported_monitor_base_url(base_url: &str) -> bool {
    SUPPORTED_MONITOR_BASE_URLS.contains(&base_url)
}

pub struct MonitorService {
    paths: AppPaths,
}

struct MonitorContext {
    root_url: String,
    api_key: String,
}

impl MonitorService {
    pub fn new(paths: AppPaths) -> Self {
        Self { paths }
    }

    pub async fn get_summary(&self, range_days: i64) -> AppResult<MonitorSummary> {
        let context = self.context()?;
        let (start_time, end_time) = build_range(range_days)?;
        let value = self
                .get_json(
                    &context,
                    "/kpi",
                    &[
                        ("start_time", start_time.as_str()),
                        ("end_time", end_time.as_str()),
                    ],
                )
            .await?;

        Ok(MonitorSummary {
            total_requests: read_i64(&value, "total_requests"),
            success_requests: read_i64(&value, "success_requests"),
            failed_requests: read_i64(&value, "failed_requests"),
            success_rate: read_f64(&value, "success_rate"),
            total_tokens: read_i64(&value, "total_tokens"),
            input_tokens: read_i64(&value, "input_tokens"),
            output_tokens: read_i64(&value, "output_tokens"),
        })
    }

    pub async fn get_trend(&self, range_days: i64) -> AppResult<Vec<MonitorTrendPoint>> {
        let context = self.context()?;
        let (start_time, end_time) = build_range(range_days)?;

        if range_days == 1 {
            let value = self
                .get_json(
                    &context,
                    "/hourly-tokens",
                    &[
                        ("start_time", start_time.as_str()),
                        ("end_time", end_time.as_str()),
                        ("hours", "24"),
                    ],
                )
                .await?;

            let hours = value
                .get("hours")
                .and_then(JsonValue::as_array)
                .map(|items| items.to_vec())
                .unwrap_or_default();
            let input_tokens = value
                .get("input_tokens")
                .and_then(JsonValue::as_array)
                .map(|items| items.to_vec())
                .unwrap_or_default();
            let output_tokens = value
                .get("output_tokens")
                .and_then(JsonValue::as_array)
                .map(|items| items.to_vec())
                .unwrap_or_default();

            return Ok(hours
                .iter()
                .enumerate()
                .map(|(index, hour)| {
                    let title = hour.as_str().unwrap_or_default().to_string();
                    let label = title
                        .split('T')
                        .nth(1)
                        .and_then(|segment| segment.get(0..5))
                        .unwrap_or(title.as_str())
                        .to_string();
                    let input = input_tokens.get(index).and_then(value_to_i64).unwrap_or(0);
                    let output = output_tokens.get(index).and_then(value_to_i64).unwrap_or(0);
                    MonitorTrendPoint {
                        key: title.clone(),
                        label,
                        title,
                        input,
                        output,
                        total: input + output,
                    }
                })
                .collect());
        }

        let value = self
            .get_json(
                &context,
                "/daily-trend",
                &[
                    ("start_time", start_time.as_str()),
                    ("end_time", end_time.as_str()),
                ],
            )
            .await?;
        let items = value
            .get("items")
            .and_then(JsonValue::as_array)
            .map(|items| items.to_vec())
            .unwrap_or_default();

        Ok(items
            .iter()
            .map(|item| {
                let title = read_string(item, "date");
                let label = title.get(5..10).unwrap_or(title.as_str()).to_string();
                let input = read_i64(item, "input_tokens");
                let output = read_i64(item, "output_tokens");
                MonitorTrendPoint {
                    key: title.clone(),
                    label,
                    title,
                    input,
                    output,
                    total: input + output,
                }
            })
            .collect())
    }

    pub async fn get_logs(
        &self,
        range_days: i64,
        page: i64,
        page_size: i64,
    ) -> AppResult<MonitorLogsResponse> {
        let context = self.context()?;
        let (start_time, end_time) = build_range(range_days)?;
        let page_string = page.max(1).to_string();
        let page_size_string = page_size.max(1).to_string();
        let value = self
            .get_json(
                &context,
                "/request-logs",
                &[
                    ("start_time", start_time.as_str()),
                    ("end_time", end_time.as_str()),
                    ("page", page_string.as_str()),
                    ("page_size", page_size_string.as_str()),
                ],
            )
            .await?;

        let items = value
            .get("items")
            .and_then(JsonValue::as_array)
            .map(|items| items.to_vec())
            .unwrap_or_default()
            .iter()
            .map(|item| {
                let timestamp = read_string(item, "timestamp");
                let model = read_string(item, "model");
                let input = read_i64(item, "input_tokens");
                let output = read_i64(item, "output_tokens");
                let failed = item
                    .get("failed")
                    .and_then(JsonValue::as_bool)
                    .unwrap_or(false);
                let total_duration_ms = read_i64(item, "total_duration_ms");
                let first_token_latency_ms = read_i64(item, "first_token_latency_ms");

                MonitorLogEntry {
                    id: format!("{timestamp}-{model}-{page}"),
                    timestamp: normalize_timestamp(&timestamp),
                    model,
                    failed,
                    input,
                    output,
                    total_tokens: input + output,
                    total_duration_ms,
                    first_token_latency_ms,
                }
            })
            .collect();

        Ok(MonitorLogsResponse {
            items,
            total: read_i64(&value, "total"),
            total_pages: read_i64(&value, "total_pages"),
        })
    }

    pub async fn get_quota(&self) -> AppResult<MonitorQuota> {
        let context = self.context()?;
        let value = self.get_json(&context, "/quota", &[]).await?;
        Ok(parse_monitor_quota(&value))
    }

    fn context(&self) -> AppResult<MonitorContext> {
        let raw_config = std::fs::read_to_string(self.paths.config_file()).unwrap_or_default();
        let parsed: TomlValue = if raw_config.trim().is_empty() {
            TomlValue::Table(Default::default())
        } else {
            raw_config
                .parse::<TomlValue>()
                .map_err(|error| AppError::Message(error.to_string()))?
        };

        let provider_id = parsed
            .get("model_provider")
            .and_then(TomlValue::as_str)
            .ok_or_else(|| AppError::Message("当前没有激活的模型服务".into()))?;
        let base_url = parsed
            .get("model_providers")
            .and_then(|table| table.get(provider_id))
            .and_then(|provider| provider.get("base_url"))
            .and_then(TomlValue::as_str)
            .unwrap_or_default()
            .to_string();

        if !is_supported_monitor_base_url(&base_url) {
            return Err(AppError::Message("当前模型服务不支持监控页面".into()));
        }

        let api_key = SettingsStore::new(self.paths.clone())
            .load_or_create()?
            .providers
            .into_iter()
            .find(|provider| provider.id == provider_id)
            .map(|provider| provider.api_key)
            .filter(|api_key| !api_key.trim().is_empty())
            .ok_or_else(|| AppError::Message("当前模型服务未保存 API Key".into()))?;

        Ok(MonitorContext {
            root_url: monitor_root_url(&base_url),
            api_key,
        })
    }

    async fn get_json(
        &self,
        context: &MonitorContext,
        path: &str,
        query: &[(&str, &str)],
    ) -> AppResult<JsonValue> {
        let client = reqwest::Client::new();
        let mut headers = HeaderMap::new();
        let mut query_params = vec![("api_key", context.api_key.as_str())];
        query_params.extend_from_slice(query);
        headers.insert(
            "x-api-key",
            HeaderValue::from_str(&context.api_key)
                .map_err(|_| AppError::Message("API Key header 无效".into()))?,
        );
        headers.insert(
            AUTHORIZATION,
            HeaderValue::from_str(&format!("Bearer {}", context.api_key))
                .map_err(|_| AppError::Message("Authorization header 无效".into()))?,
        );

        let response = client
            .get(format!(
                "{}{}{}",
                context.root_url, MONITOR_MANAGEMENT_PREFIX, path
            ))
            .headers(headers)
            .query(&query_params)
            .send()
            .await
            .map_err(|error| AppError::Message(format!("监控接口请求失败: {error}")))?;

        let status = response.status();
        if !status.is_success() {
            let body = response.text().await.unwrap_or_default();
            return Err(AppError::Message(format!(
                "监控接口返回异常状态: {}{}",
                status,
                format_response_body(&body)
            )));
        }

        response
            .json::<JsonValue>()
            .await
            .map_err(|error| AppError::Message(format!("监控接口响应解析失败: {error}")))
    }
}

fn monitor_root_url(base_url: &str) -> String {
    base_url.strip_suffix("/v1").unwrap_or(base_url).to_string()
}

fn build_range(range_days: i64) -> AppResult<(String, String)> {
    let now = Local::now();
    let start = if range_days <= 1 {
        now.date_naive()
            .and_hms_opt(0, 0, 0)
            .ok_or_else(|| AppError::Message("无法构造开始时间".into()))?
            .and_local_timezone(Local)
            .single()
            .ok_or_else(|| AppError::Message("无法构造开始时间".into()))?
    } else {
        let date = now.date_naive() - Duration::days(range_days - 1);
        date.and_hms_opt(0, 0, 0)
            .ok_or_else(|| AppError::Message("无法构造开始时间".into()))?
            .and_local_timezone(Local)
            .single()
            .ok_or_else(|| AppError::Message("无法构造开始时间".into()))?
    };

    Ok((start.to_rfc3339(), now.to_rfc3339()))
}

fn read_i64(value: &JsonValue, key: &str) -> i64 {
    value.get(key).and_then(value_to_i64).unwrap_or(0)
}

fn read_f64(value: &JsonValue, key: &str) -> f64 {
    value
        .get(key)
        .and_then(JsonValue::as_f64)
        .or_else(|| value.get(key).and_then(JsonValue::as_i64).map(|item| item as f64))
        .unwrap_or(0.0)
}

fn read_string(value: &JsonValue, key: &str) -> String {
    value
        .get(key)
        .and_then(JsonValue::as_str)
        .unwrap_or_default()
        .to_string()
}

fn value_to_i64(value: &JsonValue) -> Option<i64> {
    value
        .as_i64()
        .or_else(|| value.as_u64().map(|item| item as i64))
        .or_else(|| value.as_f64().map(|item| item.round() as i64))
}

fn normalize_timestamp(raw: &str) -> String {
    DateTime::parse_from_rfc3339(raw)
        .map(|timestamp| {
            timestamp
                .with_timezone(&Local)
                .format("%Y-%m-%d %H:%M:%S")
                .to_string()
        })
        .unwrap_or_else(|_| raw.to_string())
}

fn format_response_body(body: &str) -> String {
    let trimmed = body.trim();
    if trimmed.is_empty() {
        String::new()
    } else {
        format!(" - {}", trimmed.chars().take(240).collect::<String>())
    }
}

fn parse_monitor_quota(value: &JsonValue) -> MonitorQuota {
    let rate_limit = value
        .get("rate_limit")
        .or_else(|| value.get("rateLimit"))
        .unwrap_or(&JsonValue::Null);
    let primary_window = rate_limit
        .get("primary_window")
        .or_else(|| rate_limit.get("primaryWindow"));
    let secondary_window = rate_limit
        .get("secondary_window")
        .or_else(|| rate_limit.get("secondaryWindow"));

    let five_hour_window = select_quota_window(primary_window, secondary_window, FIVE_HOUR_WINDOW_SECONDS);
    let weekly_window = select_quota_window(primary_window, secondary_window, WEEKLY_WINDOW_SECONDS);
    let limit_reached = rate_limit
        .get("limit_reached")
        .or_else(|| rate_limit.get("limitReached"))
        .and_then(JsonValue::as_bool)
        .unwrap_or(false)
        || matches!(rate_limit.get("allowed").and_then(JsonValue::as_bool), Some(false));

    let mut windows = Vec::new();
    if let Some(window) = window_to_view("five-hour", "5 小时限额", five_hour_window, limit_reached) {
        windows.push(window);
    }
    if let Some(window) = window_to_view("weekly", "周限额", weekly_window, limit_reached) {
        windows.push(window);
    }

    MonitorQuota {
        plan_type: read_optional_string(value, &["plan_type", "planType"]),
        windows,
    }
}

fn select_quota_window<'a>(
    primary_window: Option<&'a JsonValue>,
    secondary_window: Option<&'a JsonValue>,
    expected_window_seconds: i64,
) -> Option<&'a JsonValue> {
    for candidate in [primary_window, secondary_window].into_iter().flatten() {
        if read_optional_i64(candidate, &["limit_window_seconds", "limitWindowSeconds"])
            == Some(expected_window_seconds)
        {
            return Some(candidate);
        }
    }

    match expected_window_seconds {
        FIVE_HOUR_WINDOW_SECONDS => primary_window.or(secondary_window),
        WEEKLY_WINDOW_SECONDS => secondary_window.or(primary_window),
        _ => None,
    }
}

fn window_to_view(
    id: &str,
    label: &str,
    window: Option<&JsonValue>,
    limit_reached: bool,
) -> Option<MonitorQuotaWindow> {
    let window = window?;
    let reset_label = quota_reset_label(window);
    let used_percent = read_optional_number(window, &["used_percent", "usedPercent"]);
    let remaining_percent = used_percent
        .map(|value| (100.0 - value).clamp(0.0, 100.0).round() as i64)
        .or_else(|| {
            if limit_reached && reset_label != "-" {
                Some(0)
            } else {
                None
            }
        });

    Some(MonitorQuotaWindow {
        id: id.into(),
        label: label.into(),
        remaining_percent,
        reset_label,
    })
}

fn quota_reset_label(window: &JsonValue) -> String {
    let reset_at = read_optional_i64(window, &["reset_at", "resetAt"])
        .filter(|value| *value > 0)
        .map(|value| value * 1000)
        .or_else(|| {
            read_optional_i64(window, &["reset_after_seconds", "resetAfterSeconds"])
                .filter(|value| *value > 0)
                .map(|value| chrono::Utc::now().timestamp_millis() + value * 1000)
        });

    reset_at
        .and_then(|value| chrono::DateTime::from_timestamp_millis(value))
        .map(|timestamp| timestamp.with_timezone(&Local).format("%m/%d %H:%M").to_string())
        .unwrap_or_else(|| "-".into())
}

fn read_optional_string(value: &JsonValue, keys: &[&str]) -> Option<String> {
    keys.iter()
        .find_map(|key| value.get(*key).and_then(JsonValue::as_str))
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
}

fn read_optional_i64(value: &JsonValue, keys: &[&str]) -> Option<i64> {
    keys.iter().find_map(|key| value.get(*key).and_then(value_to_i64))
}

fn read_optional_number(value: &JsonValue, keys: &[&str]) -> Option<f64> {
    keys.iter().find_map(|key| {
        value.get(*key).and_then(JsonValue::as_f64).or_else(|| {
            value
                .get(*key)
                .and_then(JsonValue::as_i64)
                .map(|item| item as f64)
        })
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::{TimeZone, Timelike};
    use std::collections::BTreeMap;

    #[test]
    fn supported_base_url_detection_matches_expected_values() {
        assert!(is_supported_monitor_base_url("http://cpa.host.dxy"));
        assert!(is_supported_monitor_base_url("http://cpa.host.dxy/v1"));
        assert!(is_supported_monitor_base_url("http://8.222.84.224:5667/v1"));
        assert!(!is_supported_monitor_base_url("https://api.openai.com/v1"));
    }

    #[test]
    fn monitor_root_url_strips_v1_suffix_only_when_present() {
        assert_eq!(monitor_root_url("http://8.222.84.224:5667/v1"), "http://8.222.84.224:5667");
        assert_eq!(monitor_root_url("http://cpa.host.dxy/v1"), "http://cpa.host.dxy");
        assert_eq!(monitor_root_url("http://cpa.host.dxy"), "http://cpa.host.dxy");
    }

    #[test]
    fn monitor_request_url_uses_management_prefix() {
        let url = format!(
            "{}{}{}",
            monitor_root_url("http://cpa.host.dxy/v1"),
            MONITOR_MANAGEMENT_PREFIX,
            "/kpi"
        );
        assert_eq!(url, "http://cpa.host.dxy/v0/management/public/custom/monitor/kpi");
    }

    #[test]
    fn intraday_window_centers_on_current_hour_and_keeps_future_slots() {
        let now = Local
            .with_ymd_and_hms(2026, 5, 14, 14, 30, 0)
            .single()
            .expect("valid time");

        let points = build_intraday_hour_slots(now, 8, 2);

        assert_eq!(points.first().map(|value| value.format("%H:%M").to_string()), Some("06:00".into()));
        assert_eq!(points.last().map(|value| value.format("%H:%M").to_string()), Some("16:00".into()));
        assert_eq!(points.len(), 11);
    }

    #[test]
    fn intraday_series_fills_missing_hours_with_zero_values() {
        let now = Local
            .with_ymd_and_hms(2026, 5, 14, 14, 30, 0)
            .single()
            .expect("valid time");
        let hours = vec![
            JsonValue::String("2026-05-14T10:00:00+08:00".into()),
            JsonValue::String("2026-05-14T12:00:00+08:00".into()),
            JsonValue::String("2026-05-14T14:00:00+08:00".into()),
        ];
        let input = vec![JsonValue::from(10), JsonValue::from(20), JsonValue::from(30)];
        let output = vec![JsonValue::from(1), JsonValue::from(2), JsonValue::from(3)];

        let points = build_intraday_trend_points(&hours, &input, &output, now, 8, 2);

        assert_eq!(points.len(), 11);
        assert_eq!(points[0].label, "06:00");
        assert_eq!(points[4].label, "10:00");
        assert_eq!(points[4].total, 11);
        assert_eq!(points[5].label, "11:00");
        assert_eq!(points[5].total, 0);
        assert_eq!(points[8].label, "14:00");
        assert_eq!(points[8].total, 33);
        assert_eq!(points[10].label, "16:00");
        assert_eq!(points[10].total, 0);
    }

    #[test]
    fn parse_monitor_quota_extracts_remaining_percent_and_reset_labels() {
        let quota = parse_monitor_quota(&serde_json::json!({
            "plan_type": "pro",
            "rate_limit": {
                "primary_window": {
                    "limit_window_seconds": 18000,
                    "used_percent": 24,
                    "reset_after_seconds": 3600
                },
                "secondary_window": {
                    "limit_window_seconds": 604800,
                    "used_percent": 77,
                    "reset_after_seconds": 7200
                }
            }
        }));

        assert_eq!(quota.plan_type.as_deref(), Some("pro"));
        assert_eq!(quota.windows.len(), 2);
        assert_eq!(quota.windows[0].id, "five-hour");
        assert_eq!(quota.windows[0].remaining_percent, Some(76));
        assert_ne!(quota.windows[0].reset_label, "-");
        assert_eq!(quota.windows[1].id, "weekly");
        assert_eq!(quota.windows[1].remaining_percent, Some(23));
        assert_ne!(quota.windows[1].reset_label, "-");
    }

    fn build_intraday_hour_slots(
        now: DateTime<Local>,
        past_hours: i64,
        future_hours: i64,
    ) -> Vec<DateTime<Local>> {
        let current_hour = now
            .date_naive()
            .and_hms_opt(now.hour(), 0, 0)
            .expect("valid current hour")
            .and_local_timezone(Local)
            .single()
            .expect("valid local hour");
        (-past_hours..=future_hours)
            .map(|offset| current_hour + Duration::hours(offset))
            .collect()
    }

    fn build_intraday_trend_points(
        hours: &[JsonValue],
        input_tokens: &[JsonValue],
        output_tokens: &[JsonValue],
        now: DateTime<Local>,
        past_hours: i64,
        future_hours: i64,
    ) -> Vec<MonitorTrendPoint> {
        let mut values_by_hour = BTreeMap::new();
        for (index, hour) in hours.iter().enumerate() {
            let Some(hour_text) = hour.as_str() else {
                continue;
            };
            let Ok(timestamp) = DateTime::parse_from_rfc3339(hour_text) else {
                continue;
            };
            let local = timestamp.with_timezone(&Local);
            let key = local.format("%Y-%m-%dT%H:00").to_string();
            let input = input_tokens.get(index).and_then(value_to_i64).unwrap_or(0);
            let output = output_tokens.get(index).and_then(value_to_i64).unwrap_or(0);
            values_by_hour.insert((key, hour_text.to_string()), (input, output));
        }

        build_intraday_hour_slots(now, past_hours, future_hours)
            .into_iter()
            .map(|slot| {
                let key = slot.format("%Y-%m-%dT%H:00").to_string();
                let found = values_by_hour
                    .iter()
                    .find(|((candidate_key, _), _)| candidate_key == &key);
                let title = found
                    .map(|((_, original), _)| original.clone())
                    .unwrap_or_else(|| slot.to_rfc3339());
                let (input, output) = found.map(|(_, values)| *values).unwrap_or((0, 0));
                MonitorTrendPoint {
                    key: title.clone(),
                    label: slot.format("%H:%M").to_string(),
                    title,
                    input,
                    output,
                    total: input + output,
                }
            })
            .collect()
    }
}
