use crate::error::AppResult;
use crate::models::{ProviderConnectivityResult, ProviderRecord};
use serde_json::json;
use std::time::Instant;

pub async fn test_provider_connectivity(
    provider: ProviderRecord,
) -> AppResult<ProviderConnectivityResult> {
    let client = reqwest::Client::new();
    let started_at = Instant::now();

    let models_endpoint = if provider.provider_id == "ollama" {
        format!("{}/api/tags", provider.base_url.trim_end_matches("/v1"))
    } else {
        format!("{}/models", provider.base_url.trim_end_matches('/'))
    };
    let mut models_request = client.get(models_endpoint);
    if !provider.api_key.is_empty() {
        models_request = models_request.bearer_auth(provider.api_key.clone());
    }

    match models_request.send().await {
        Ok(response) if response.status().is_success() => {
            return Ok(ProviderConnectivityResult {
                reachable: true,
                authenticated: true,
                latency_ms: started_at.elapsed().as_millis(),
                detail: format!("models status {}", response.status()),
            });
        }
        Ok(response) if matches!(response.status().as_u16(), 401 | 403) => {
            return Ok(ProviderConnectivityResult {
                reachable: true,
                authenticated: false,
                latency_ms: started_at.elapsed().as_millis(),
                detail: format!("models status {}", response.status()),
            });
        }
        Ok(response) if response.status().as_u16() != 404 => {
            return Ok(ProviderConnectivityResult {
                reachable: true,
                authenticated: false,
                latency_ms: started_at.elapsed().as_millis(),
                detail: format!("models status {}", response.status()),
            });
        }
        Ok(_) => {}
        Err(error) => {
            return Ok(ProviderConnectivityResult {
                reachable: false,
                authenticated: false,
                latency_ms: started_at.elapsed().as_millis(),
                detail: error.to_string(),
            });
        }
    }

    if provider.model.trim().is_empty() {
        return Ok(ProviderConnectivityResult {
            reachable: true,
            authenticated: false,
            latency_ms: started_at.elapsed().as_millis(),
            detail: "models endpoint is not available and model is empty".into(),
        });
    }

    let chat_endpoint = format!(
        "{}/chat/completions",
        provider.base_url.trim_end_matches('/')
    );
    let mut chat_request = client.post(chat_endpoint).json(&json!({
        "model": provider.model,
        "messages": [{"role": "user", "content": "ping"}],
        "max_tokens": 1,
        "stream": false
    }));
    if !provider.api_key.is_empty() {
        chat_request = chat_request.bearer_auth(provider.api_key.clone());
    }

    match chat_request.send().await {
        Ok(response) => Ok(ProviderConnectivityResult {
            reachable: true,
            authenticated: response.status().is_success(),
            latency_ms: started_at.elapsed().as_millis(),
            detail: if response.status().is_success() {
                "models endpoint returned 404; chat completion succeeded".into()
            } else {
                format!("models status 404; chat status {}", response.status())
            },
        }),
        Err(error) => Ok(ProviderConnectivityResult {
            reachable: false,
            authenticated: false,
            latency_ms: started_at.elapsed().as_millis(),
            detail: error.to_string(),
        }),
    }
}

pub async fn validate_provider_key(
    provider: ProviderRecord,
) -> AppResult<ProviderConnectivityResult> {
    let endpoint = if provider.provider_id == "ollama" {
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

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::ProviderKind;
    use std::collections::BTreeMap;
    use tokio::io::{AsyncReadExt, AsyncWriteExt};
    use tokio::net::TcpListener;

    fn provider(base_url: String) -> ProviderRecord {
        ProviderRecord {
            local_id: 0,
            provider_id: "jobmd".into(),
            name: "jobmd".into(),
            kind: ProviderKind::Custom,
            base_url,
            model: "gpt-5.4".into(),
            api_key: "sk-test".into(),
            env_key: String::new(),
            http_headers: BTreeMap::new(),
            query_params: BTreeMap::new(),
            supports_websockets: false,
            active: false,
            enabled: true,
            last_validated_at: None,
            last_validation_status: "unknown".into(),
        }
    }

    #[tokio::test]
    #[ignore = "requires binding a local TCP listener"]
    async fn connectivity_falls_back_to_chat_when_models_is_404() {
        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let addr = listener.local_addr().unwrap();
        let server = tokio::spawn(async move {
            for _ in 0..2 {
                let (mut stream, _) = listener.accept().await.unwrap();
                let mut buffer = [0_u8; 2048];
                let size = stream.read(&mut buffer).await.unwrap();
                let request = String::from_utf8_lossy(&buffer[..size]);
                let response = if request.starts_with("GET /v1/models ") {
                    "HTTP/1.1 404 Not Found\r\nContent-Length: 0\r\n\r\n"
                } else if request.starts_with("POST /v1/chat/completions ") {
                    "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: 16\r\n\r\n{\"choices\":[{}]}"
                } else {
                    "HTTP/1.1 500 Internal Server Error\r\nContent-Length: 0\r\n\r\n"
                };
                stream.write_all(response.as_bytes()).await.unwrap();
            }
        });

        let result = test_provider_connectivity(provider(format!("http://{addr}/v1")))
            .await
            .unwrap();

        assert!(result.reachable);
        assert!(result.authenticated);
        assert!(result.detail.contains("chat completion succeeded"));
        server.await.unwrap();
    }
}
