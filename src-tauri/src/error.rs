use thiserror::Error;

#[derive(Debug, Error)]
pub enum AppError {
    #[error("failed to read file: {0}")]
    Io(#[from] std::io::Error),
    #[error("failed to parse json: {0}")]
    Json(#[from] serde_json::Error),
    #[error("sqlite error: {0}")]
    Sqlite(#[from] rusqlite::Error),
    #[error("failed to parse toml: {0}")]
    Toml(#[from] toml::de::Error),
    #[error("failed to serialize toml: {0}")]
    TomlSer(#[from] toml::ser::Error),
    #[error("{0}")]
    Message(String),
}

pub type AppResult<T> = Result<T, AppError>;
