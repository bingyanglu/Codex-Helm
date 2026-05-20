use std::path::{Path, PathBuf};

#[derive(Debug, Clone)]
pub struct AppPaths {
    home_dir: PathBuf,
}

impl AppPaths {
    pub fn detect() -> Self {
        let home_dir = std::env::var("HOME")
            .map(PathBuf::from)
            .expect("HOME must be set");
        Self { home_dir }
    }

    pub fn from_home(home_dir: PathBuf) -> Self {
        Self { home_dir }
    }

    pub fn home_dir(&self) -> &Path {
        &self.home_dir
    }

    pub fn codex_dir(&self) -> PathBuf {
        self.home_dir.join(".codex")
    }

    pub fn manager_dir(&self) -> PathBuf {
        self.home_dir.join(".codex-manager")
    }

    pub fn settings_file(&self) -> PathBuf {
        self.manager_dir().join("settings.json")
    }

    pub fn settings_db_file(&self) -> PathBuf {
        self.manager_dir().join("settings.sqlite3")
    }

    pub fn auth_file(&self) -> PathBuf {
        self.codex_dir().join("auth.json")
    }

    pub fn config_file(&self) -> PathBuf {
        self.codex_dir().join("config.toml")
    }

    pub fn config_backup_dir(&self) -> PathBuf {
        self.manager_dir().join("backups").join("config")
    }
}
