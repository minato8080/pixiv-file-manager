use anyhow::{anyhow, Result};
use chrono::{DateTime, FixedOffset, Utc};
use regex::Regex;
use sqlx::{QueryBuilder, Sqlite, SqliteConnection};
use std::fmt::Display;
use std::time::Duration;
use std::{collections::HashMap, path::Path};

use crate::models::common::{BindValue, FileInfo};

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
        .parse::<i32>()
        .map_err(|_| anyhow!("illust_id のパースに失敗: {}", &caps[1]))?;

    let suffix = caps[2]
        .parse::<i16>()
        .map_err(|_| anyhow!("suffix のパースに失敗: {}", &caps[2]))?;

    let extension = caps[3].to_string();

    Ok(FileInfo {
        illust_id,
        suffix,
        extension,
        save_dir: None,
    })
}

pub async fn update_cnum(conn: &mut SqliteConnection) -> Result<()> {
    let sql = include_str!("../sql/update_cnum.sql");
    execute_queries(&mut *conn, sql).await?;

    Ok(())
}

pub fn log_error<T: Display>(error: T) -> String {
    let s = error.to_string();
    log::error!("{}", s);
    eprintln!("{}", s);
    s
}

pub async fn execute_queries(conn: &mut SqliteConnection, sql: &str) -> Result<()> {
    let queries: Vec<&str> = sql
        .split(';')
        .map(|q| q.trim())
        .filter(|q| !q.is_empty())
        .collect();

    for q in queries {
        sqlx::query(q).execute(&mut *conn).await?;
    }

    Ok(())
}

pub async fn execute_named_queries(
    conn: &mut SqliteConnection,
    sqls: &str,
    params: &HashMap<&str, BindValue>,
) -> Result<()> {
    let queries: Vec<&str> = sqls
        .split(';')
        .map(|s| s.trim())
        .filter(|s| !s.is_empty())
        .collect();

    for raw_sql in queries {
        build_named_query(raw_sql, params)?
            .build()
            .execute(&mut *conn)
            .await?;
    }

    Ok(())
}

pub fn build_named_query<'a>(
    sql: &str,
    params: &'a HashMap<&str, BindValue>,
) -> Result<QueryBuilder<'a, Sqlite>> {
    let re = Regex::new(r":([A-Za-z0-9_]+)").unwrap();
    let mut builder: QueryBuilder<Sqlite> = QueryBuilder::new("");

    // まず、SQL文字列を分割して、プレースホルダを処理します
    let mut last_index = 0;
    for mat in re.find_iter(sql) {
        // マッチする前の文字列をそのまま追加
        builder.push(&sql[last_index..mat.start()]);

        // パラメータ名を取得
        let key = &sql[mat.start()..mat.end()];
        let value = params.get(key).ok_or_else(|| {
            let sql_prefix = &sql[..std::cmp::min(sql.len(), 40)];
            sqlx::Error::Io(std::io::Error::new(
                std::io::ErrorKind::NotFound,
                format!(
                    "Parameter not found: '{}'. SQL starts with: '{}...'",
                    key, sql_prefix
                ),
            ))
        })?;

        // パラメータの型に応じて値をバインド
        match value {
            BindValue::Text(s) => {
                builder.push_bind(s);
            }
            BindValue::Int(i) => {
                builder.push_bind(i);
            }
            BindValue::OptText(s) => {
                builder.push_bind(s);
            }
            BindValue::OptInt(i) => {
                builder.push_bind(i);
            }
            BindValue::VecText(vec_s) => {
                let mut separated = builder.separated(", ");
                for v in vec_s {
                    separated.push_bind(v);
                }
            }
            BindValue::VecInt(vec_i) => {
                let mut separated = builder.separated(", ");
                for v in vec_i {
                    separated.push_bind(v);
                }
            }
        };

        // 次の検索開始位置を更新
        last_index = mat.end();
    }
    // 最後に残った文字列を追加
    builder.push(&sql[last_index..]);

    Ok(builder)
}

/// INSERT INTO ... VALUES \[(?, ?)\]の形式で、複数行のデータを一括で挿入するクエリを実行する。
pub async fn execute_multi_insert_query<'a>(
    conn: &mut SqliteConnection,
    sql_template: &'a str,
    rows: &'a [Vec<BindValue>],
) -> sqlx::Result<()> {
    if rows.is_empty() {
        return Err(sqlx::Error::Io(std::io::Error::new(
            std::io::ErrorKind::InvalidInput,
            "No rows provided",
        )));
    }

    let expanded = expand_multi_values(sql_template, rows.len())?;
    let query = bind_rows(&expanded, &rows)?;
    query.execute(&mut *conn).await?;

    Ok(())
}

/// SQL テンプレートを受け取り、`[(?,0,?)]` を行数分に展開した文字列を返す
fn expand_multi_values(sql_template: &str, rows_len: usize) -> sqlx::Result<String> {
    // [(...)] を検出
    let start = sql_template.find("[(").ok_or_else(|| {
        sqlx::Error::Io(std::io::Error::new(
            std::io::ErrorKind::InvalidInput,
            "template must contain [(..)]",
        ))
    })?;
    let end = sql_template[start..]
        .find(")]")
        .map(|i| start + i + 2)
        .ok_or_else(|| {
            sqlx::Error::Io(std::io::Error::new(
                std::io::ErrorKind::InvalidInput,
                "template must contain [(..)]",
            ))
        })?;

    let prefix = &sql_template[..start];
    let pattern = &sql_template[start + 1..end - 1]; // "(?,0,?)" 部分
    let suffix = &sql_template[end..];

    let mut values = String::new();
    for i in 0..rows_len {
        if i > 0 {
            values.push_str(", ");
        }
        values.push_str(pattern);
    }

    Ok(format!("{prefix}{values}{suffix}"))
}

/// 展開済みの SQL に行データを bind する
fn bind_rows<'a>(
    sql: &'a str,
    rows: &'a [Vec<BindValue>],
) -> sqlx::Result<sqlx::query::Query<'a, sqlx::Sqlite, sqlx::sqlite::SqliteArguments<'a>>> {
    // プレースホルダの数
    let binds_per_row = rows[0].len();

    let mut query = sqlx::query(sql);
    for (idx, row) in rows.iter().enumerate() {
        if row.len() != binds_per_row {
            return Err(sqlx::Error::Io(std::io::Error::new(
                std::io::ErrorKind::InvalidInput,
                format!(
                    "Row {idx} has {} values, expected {}",
                    row.len(),
                    binds_per_row
                ),
            )));
        }

        for value in row {
            match value {
                BindValue::Text(s) => query = query.bind(s),
                BindValue::Int(i) => query = query.bind(i),
                BindValue::OptText(s) => query = query.bind(s),
                BindValue::OptInt(i) => query = query.bind(i),
                _ => {
                    return Err(sqlx::Error::Io(std::io::Error::new(
                        std::io::ErrorKind::InvalidInput,
                        "Unsupported BindValue type",
                    )))
                }
            }
        }
    }
    Ok(query)
}

pub fn hash_params<K>(pairs: &[(K, BindValue)]) -> Result<HashMap<&str, BindValue>>
where
    K: AsRef<str>,
{
    let mut map = HashMap::new();
    for (k, v) in pairs {
        let key = k.as_ref();
        if map.contains_key(key) {
            return Err(anyhow!("Duplicate key: {}", key));
        }
        map.insert(key, v.clone());
    }
    Ok(map)
}
