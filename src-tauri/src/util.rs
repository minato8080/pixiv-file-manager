use anyhow::{Context, Result};
use std::{fmt::Display, panic::Location};

pub trait ResultWithLocationExt<T> {
    #[track_caller]
    fn with_location(self) -> Result<T>;
}

impl<T, E> ResultWithLocationExt<T> for std::result::Result<T, E>
where
    E: std::error::Error + Send + Sync + 'static,
{
    /// エラーに呼び出し元の位置情報を付与する
    #[track_caller]
    fn with_location(self) -> Result<T> {
        // #[track_caller] により、この関数の呼び出し元の情報を取得
        let location = Location::caller();
        // anyhow の with_context を使って情報を付与
        let any_result: Result<T> = self.map_err(|e| anyhow::Error::new(e));
        any_result.with_context(|| format!("at {}:{}", location.file(), location.line()))
    }
}

pub fn log_error<T: Display>(error: T) -> String {
    let s = error.to_string();
    log::error!("{}", s);
    eprintln!("{}", s);
    s
}
