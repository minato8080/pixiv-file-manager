use std::path::Path;

use crate::models::search::SearchResult;
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
