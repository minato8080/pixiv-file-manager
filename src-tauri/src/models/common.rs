use sqlx::SqlitePool;
use std::sync::Arc;

use crate::api::pixiv::PixivClientProvider;

pub struct AppState {
    pub pool: SqlitePool,
    pub pixiv_client_provider: Arc<dyn PixivClientProvider>,
}

impl Drop for AppState {
    fn drop(&mut self) {
        tauri::async_runtime::block_on(self.pool.close());
    }
}

#[derive(Debug)]
pub struct FileInfo {
    pub illust_id: i32,
    pub suffix: i16,
    pub extension: String,
    pub save_dir: Option<String>,
}

#[derive(Debug, Clone)]
pub enum BindValue {
    Text(String),
    Int(i64),
    OptText(Option<String>),
    OptInt(Option<i64>),
    VecText(Vec<String>),
    VecInt(Vec<i64>),
}

macro_rules! impl_from_num {
    ($($t:ty),+) => {
        $(
            impl From<$t> for BindValue {
                fn from(v: $t) -> Self {
                    BindValue::Int(v as i64)
                }
            }

            impl From<Option<$t>> for BindValue {
                fn from(v: Option<$t>) -> Self {
                    match v {
                        Some(x) => BindValue::OptInt(Some(x as i64)),
                        None => BindValue::OptInt(None),
                    }
                }
            }
            impl From<Vec<$t>> for BindValue {
                fn from(v: Vec<$t>) -> Self {
                    BindValue::VecInt(
                        v.into_iter().map(|x| x as i64).collect()
                    )
                }
            }
        )+
    };
}
impl_from_num!(i8, i16, i32, i64, u8, u16, u32, u64, isize, usize);

impl From<String> for BindValue {
    fn from(v: String) -> Self {
        BindValue::Text(v)
    }
}

impl From<&str> for BindValue {
    fn from(v: &str) -> Self {
        BindValue::OptText(Some(v.to_string()))
    }
}

impl From<Option<String>> for BindValue {
    fn from(v: Option<String>) -> Self {
        BindValue::OptText(v)
    }
}

impl From<Option<&str>> for BindValue {
    fn from(v: Option<&str>) -> Self {
        BindValue::OptText(v.map(|s| s.to_owned()))
    }
}

impl From<Vec<String>> for BindValue {
    fn from(v: Vec<String>) -> Self {
        BindValue::VecText(v)
    }
}
