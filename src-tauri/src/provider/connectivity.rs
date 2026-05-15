use crate::error::AppResult;
use crate::models::{ProviderConnectivityResult, ProviderRecord};
use std::time::Instant;

pub async fn test_provider_connectivity(
    provider: ProviderRecord,
) -> AppResult<ProviderConnectivityResult> {
    let client = reqwest::Client::new();
    let started_at = Instant::now();
    let response = client.get(&provider.base_url).send().await;
    let latency_ms = started_at.elapsed().as_millis();

    match response {
        Ok(response) => {
            let status = response.status();
            let reachable = status.is_success() || matches!(status.as_u16(), 401 | 403 | 404);
            Ok(ProviderConnectivityResult {
                reachable,
                authenticated: status.is_success(),
                latency_ms,
                detail: format!("status {status}"),
            })
        }
        Err(error) => Ok(ProviderConnectivityResult {
            reachable: false,
            authenticated: false,
            latency_ms,
            detail: error.to_string(),
        }),
    }
}

pub async fn validate_provider_key(
    provider: ProviderRecord,
) -> AppResult<ProviderConnectivityResult> {
    let endpoint = if provider.id == "ollama" {
        format!("{}/api/tags", provider.base_url.trim_end_matches("/v1"))
    } else {
        format!("{}/models", provider.base_url.trim_end_matches('/'))
    };

    let client = reqwest::Client::new();
    let mut request = client.get(endpoint);
    let started_at = Instant::now();

    if !provider.api_key.is_empty() {
        request = request.bearer_auth(provider.api_key.clone());
    }

    match request.send().await {
        Ok(response) => Ok(ProviderConnectivityResult {
            reachable: true,
            authenticated: response.status().is_success(),
            latency_ms: started_at.elapsed().as_millis(),
            detail: format!("status {}", response.status()),
        }),
        Err(error) => Ok(ProviderConnectivityResult {
            reachable: false,
            authenticated: false,
            latency_ms: started_at.elapsed().as_millis(),
            detail: error.to_string(),
        }),
    }
}
