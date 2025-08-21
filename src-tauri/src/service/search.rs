use std::path::Path;

use crate::models::search::{AuthorInfo, SearchHistory, SearchResult};
use anyhow::Result;
use rusqlite::{params, params_from_iter, Connection, Row, ToSql};

pub fn process_search_by_criteria(
    tags: Vec<String>,
    character: Option<String>,
    author: Option<u32>,
    conn: &Connection,
) -> Result<Vec<SearchResult>> {
    let sql = include_str!("../sql/search/search_by_criteria.sql");

    let tag_placeholders: String = (0..tags.len())
        .map(|_| "?".to_string())
        .collect::<Vec<_>>()
        .join(", ");

    let sql = sql
        .replace(":tags", &tag_placeholders)
        .replace(":tag_count", &tags.len().to_string());

    let mut params: Vec<Box<dyn ToSql>> = Vec::new();
    params.push(Box::new(character.clone()));
    params.push(Box::new(author.clone()));
    for t in &tags {
        params.push(Box::new(t.clone()));
    }

    let mut stmt = conn.prepare(&sql)?;
    let results = stmt
        .query_map(params_from_iter(params.iter().map(|p| p.as_ref())), |row| {
            Ok(format_search_result(row)?)
        })?
        .collect::<Result<Vec<_>, _>>()?;

    save_search_history(tags, character, author, results.len() as u32, &conn)?;

    Ok(results)
}

pub fn process_search_by_id(id: i64, conn: &Connection) -> Result<Vec<SearchResult>> {
    let sql = include_str!("../sql/search/search_by_id.sql");
    let mut stmt = conn.prepare(sql)?;

    let results = stmt
        .query_map(params![id], |row| Ok(format_search_result(row)?))?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(results)
}

fn format_search_result(row: &Row) -> rusqlite::Result<SearchResult> {
    let illust_id: u32 = row.get(0)?;
    let suffix: u8 = row.get(1)?;
    let extention: String = row.get(2)?;
    let save_dir: String = row.get(3)?;
    let character: Option<String> = row.get(4)?;
    let author_name: String = row.get(5)?;
    let tags: Option<String> = row.get(6)?;

    let file_name = format!("{}_p{}.{}", illust_id, suffix, extention);

    let pathbuf = Path::new(&save_dir).join(&file_name);
    let path_str = pathbuf.to_str().unwrap_or("").to_string();

    let update_time = match std::fs::metadata(&pathbuf).and_then(|m| m.modified()) {
        Ok(t) => chrono::DateTime::<chrono::Local>::from(t)
            .format("%Y-%m-%d %H:%M:%S")
            .to_string(),
        Err(_) => "unknown".to_string(),
    };

    Ok(SearchResult {
        id: illust_id,
        file_name,
        thumbnail_url: path_str,
        author_name,
        character,
        save_dir,
        update_time,
        tags,
    })
}

fn save_search_history(
    tags: Vec<String>,
    character: Option<String>,
    author_id: Option<u32>,
    result_count: u32,
    conn: &Connection,
) -> Result<()> {
    let tags_json = serde_json::to_string(&tags)?;
    let timestamp = chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string();
    conn.execute(
        "INSERT INTO SEARCH_HISTORY (tags, character, author_id, timestamp, result_count) VALUES (?, ?, ?, ?, ?)",
        params![tags_json, character, author_id, timestamp, result_count],
    )
    ?;

    // 履歴は10件まで保存
    conn.execute(
        "DELETE FROM SEARCH_HISTORY WHERE ROWID NOT IN (
            SELECT ROWID FROM SEARCH_HISTORY ORDER BY timestamp DESC LIMIT 10
            )",
        [],
    )?;

    Ok(())
}

pub fn process_get_search_history(conn: &Connection) -> Result<Vec<SearchHistory>> {
    let sql = include_str!("../sql/search/get_search_history.sql");
    let mut stmt = conn.prepare(sql)?;

    let history = stmt
        .query_map([], |row| {
            let tags_json: String = row.get(0)?;
            let character: Option<String> = row.get(1)?;
            let author_id: Option<u32> = row.get(2)?;
            let author_name: Option<String> = row.get(3)?;
            let author_account: Option<String> = row.get(4)?;
            let timestamp: String = row.get(5)?;
            let result_count: u32 = row.get(6)?;

            let tags: Vec<String> = serde_json::from_str(&tags_json)
                .map_err(|e| rusqlite::Error::UserFunctionError(Box::new(e)))?;

            let author = match (author_id, author_name, author_account) {
                (Some(id), Some(name), Some(account)) => Some(AuthorInfo {
                    author_id: id,
                    author_name: name,
                    author_account: account,
                    count: None,
                }),
                (_, _, _) => None,
            };
            Ok(SearchHistory {
                tags,
                character,
                author,
                timestamp,
                result_count,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;

    Ok(history)
}
