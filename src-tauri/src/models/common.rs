use sqlx::SqlitePool;
use std::sync::Arc;

use crate::api::pixiv::PixivClientProvider;

pub struct AppState {
    pub pool: SqlitePool,
    pub pixiv_client_provider: Arc<dyn PixivClientProvider>,
}

#[derive(Debug)]
pub struct FileInfo {
    pub illust_id: i32,
    pub suffix: i16,
    pub extension: String,
    pub save_dir: Option<String>,
}

#[derive(Debug)]
pub enum BindValue {
    Text(String),
    Int(i64),
    OptText(Option<String>),
    OptInt(Option<i64>),
    VecText(Vec<String>),
    VecInt(Vec<i64>),
}

pub enum BindValueWrapper {
    Inner(BindValue),
}

impl BindValueWrapper {
    pub fn into_inner(self) -> BindValue {
        match self {
            BindValueWrapper::Inner(v) => v,
        }
    }
}

impl From<i64> for BindValueWrapper {
    fn from(v: i64) -> Self {
        BindValueWrapper::Inner(BindValue::Int(v))
    }
}

impl From<Option<i64>> for BindValueWrapper {
    fn from(v: Option<i64>) -> Self {
        BindValueWrapper::Inner(BindValue::OptInt(v))
    }
}

impl From<String> for BindValueWrapper {
    fn from(v: String) -> Self {
        BindValueWrapper::Inner(BindValue::Text(v))
    }
}

impl From<&str> for BindValueWrapper {
    fn from(v: &str) -> Self {
        BindValueWrapper::Inner(BindValue::OptText(Some(v.to_string())))
    }
}

impl From<Option<String>> for BindValueWrapper {
    fn from(v: Option<String>) -> Self {
        BindValueWrapper::Inner(BindValue::OptText(v))
    }
}

impl From<Option<&str>> for BindValueWrapper {
    fn from(v: Option<&str>) -> Self {
        BindValueWrapper::Inner(BindValue::OptText(v.map(|s| s.to_owned())))
    }
}

impl From<Vec<String>> for BindValueWrapper {
    fn from(v: Vec<String>) -> Self {
        BindValueWrapper::Inner(BindValue::VecText(v))
    }
}

impl From<Vec<i64>> for BindValueWrapper {
    fn from(v: Vec<i64>) -> Self {
        BindValueWrapper::Inner(BindValue::VecInt(v))
    }
}
