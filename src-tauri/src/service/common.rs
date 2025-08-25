use anyhow::{anyhow, Result};
use chrono::{DateTime, FixedOffset, Utc};
use regex::Regex;
use rusqlite::{params_from_iter, Connection, ToSql, Transaction};
use std::collections::HashMap;
use std::path::Path;
use std::time::Duration;

use crate::models::common::FileInfo;

pub fn format_duration(ms: u64) -> String {
    let duration = Duration::from_millis(ms);
    let hours = duration.as_secs() / 3600;
    let minutes = (duration.as_secs() % 3600) / 60;
    let seconds = duration.as_secs() % 60;

    format!("{:02}:{:02}:{:02}", hours, minutes, seconds)
}

pub fn format_unix_timestamp(ts: i64) -> String {
    let datetime_opt = DateTime::<Utc>::from_timestamp(ts, 0);
    match datetime_opt {
        Some(datetime) => {
            let jst: FixedOffset = FixedOffset::east_opt(9 * 3600).unwrap();
            datetime
                .with_timezone(&jst)
                .format("%Y-%m-%d %H:%M:%S")
                .to_string()
        }
        None => "Invalid timestamp".to_string(), // または "" や任意のデフォルト文字列
    }
}

pub fn remove_invalid_chars(path: &str) -> String {
    // Windowsでファイル名に使えない文字のリスト
    let invalid_chars = ['\\', '/', ':', '*', '?', '"', '<', '>', '|', ' '];

    path.chars()
        .filter(|c| !invalid_chars.contains(c))
        .collect()
}

pub fn parse_path_info(path: &Path) -> Result<FileInfo> {
    let filename = path
        .file_name()
        .and_then(|f| f.to_str())
        .ok_or_else(|| anyhow!("ファイル名が取得できません: {:?}", path))?;

    let mut file_info = parse_file_info(filename)?;

    let save_dir = path
        .parent()
        .and_then(|p| p.to_str())
        .ok_or_else(|| anyhow!("親ディレクトリの取得に失敗しました: {:?}", path))?
        .to_string();
    file_info.save_dir = Some(save_dir);

    Ok(file_info)
}

pub fn parse_file_info(file_name: &str) -> Result<FileInfo> {
    // 拡張子は必要に応じて拡張可能
    let reg = Regex::new(r"^(\d+)_p(\d+)\.(jpg|png|jpeg)$")
        .map_err(|e| anyhow!("正規表現のコンパイルに失敗: {}", e))?;

    let caps = reg
        .captures(file_name)
        .ok_or_else(|| anyhow!("ファイル名の形式が不正です: {}", file_name))?;

    let illust_id = caps[1]
        .parse::<u32>()
        .map_err(|_| anyhow!("illust_id のパースに失敗: {}", &caps[1]))?;

    let suffix = caps[2]
        .parse::<u8>()
        .map_err(|_| anyhow!("suffix のパースに失敗: {}", &caps[2]))?;

    let extension = caps[3].to_string();

    Ok(FileInfo {
        illust_id,
        suffix,
        extension,
        save_dir: None,
    })
}

pub fn update_cnum(conn: &Connection) -> Result<()> {
    let sql = include_str!("../sql/update_cnum.sql");
    conn.execute_batch(sql)?;
    Ok(())
}

pub fn execute_sql_script(
    tx: &Transaction,
    sql: &str,
    params_map: &HashMap<&str, &dyn ToSql>,
) -> Result<()> {
    for raw_query in sql.split(';') {
        let query = raw_query.trim();
        if query.is_empty() {
            continue;
        }

        // クエリ内で使われているパラメータだけ抽出
        let used_params: Vec<(&str, &dyn ToSql)> = params_map
            .iter()
            .filter(|(k, _)| query.contains(*k))
            .map(|(k, v)| (*k, *v))
            .collect();

        if used_params.is_empty() {
            tx.execute(query, [])?;
        } else {
            // 動的名前付きパラメータをパラメータ配列に変換
            let param_values = used_params.iter().map(|(_, v)| *v);
            tx.execute(query, params_from_iter(param_values))?;
        }
    }

    Ok(())
}
