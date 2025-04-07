use std::path::PathBuf;

use dirs::data_dir;
use once_cell::sync::Lazy;

pub static DB_PATH: Lazy<PathBuf> = Lazy::new(|| {
    data_dir().unwrap_or_else(|| PathBuf::from("default/path")).join("pixiv.db")
});
