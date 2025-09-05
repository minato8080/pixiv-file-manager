use std::path::Path;

use crate::models::search::{AuthorInfo, CharacterInfo, SearchResult, TagInfo};
use anyhow::Result;
use rusqlite::{params, params_from_iter, Connection, Row, ToSql};

pub fn process_search_by_criteria(
    tags: Vec<String>,
    character: Option<String>,
    author_id: Option<u32>,
    conn: &Connection,
) -> Result<Vec<SearchResult>> {
    println!("author_id:{:?}", author_id);
    let tag_placeholders: String = (0..tags.len())
        .map(|_| "?".to_string())
        .collect::<Vec<_>>()
        .join(", ");

    let sql =
        include_str!("../sql/search/search_by_criteria.sql").replace(":tags", &tag_placeholders);

    let mut params: Vec<Box<dyn ToSql>> = Vec::new();
    params.push(Box::new(character));
    params.push(Box::new(author_id));
    let tag_count = tags.len();
    params.push(Box::new(tag_count));
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

pub fn process_filter_dropdowns(
    tags: Vec<String>,
    character: Option<String>,
    author_id: Option<u32>,
    conn: &Connection,
) -> Result<(Vec<TagInfo>, Vec<CharacterInfo>, Vec<AuthorInfo>)> {
    // prepare parameters
    let tag_placeholders: String = (0..tags.len())
        .map(|_| "?".to_string())
        .collect::<Vec<_>>()
        .join(", ");

    let mut params: Vec<Box<dyn ToSql>> = Vec::new();
    params.push(Box::new(character));
    params.push(Box::new(author_id));
    let tag_count = tags.len();
    params.push(Box::new(tag_count));
    for t in &tags {
        params.push(Box::new(t.clone()));
    }

    // tags
    let tag_sql =
        include_str!("../sql/search/get_filtered_tags.sql").replace(":tags", &tag_placeholders);
    let mut tag_stmt = conn.prepare(&tag_sql)?;
    let tag_rows =
        tag_stmt.query_map(params_from_iter(params.iter().map(|p| p.as_ref())), |row| {
            Ok(TagInfo {
                tag: row.get(0)?,
                count: row.get(1)?,
            })
        })?;
    let mut tag_results = Vec::new();
    for row in tag_rows {
        tag_results.push(row?);
    }

    // characters
    let char_sql = include_str!("../sql/search/get_filtered_characters.sql")
        .replace(":tags", &tag_placeholders);
    let mut char_stmt = conn.prepare(&char_sql)?;
    let char_rows =
        char_stmt.query_map(params_from_iter(params.iter().map(|p| p.as_ref())), |row| {
            Ok(CharacterInfo {
                character: row.get(0)?,
                count: row.get(1)?,
            })
        })?;
    let mut character_results = Vec::new();
    for row in char_rows {
        character_results.push(row?);
    }

    // authors
    let author_sql =
        include_str!("../sql/search/get_filtered_authors.sql").replace(":tags", &tag_placeholders);
    let mut author_stmt = conn.prepare(&author_sql)?;
    let author_rows =
        author_stmt.query_map(params_from_iter(params.iter().map(|p| p.as_ref())), |row| {
            Ok(AuthorInfo {
                author_id: row.get(0)?,
                author_name: row.get(1)?,
                author_account: row.get(2)?,
                count: row.get(3)?,
            })
        })?;
    let mut author_results = Vec::new();
    for row in author_rows {
        author_results.push(row?);
    }

    Ok((tag_results, character_results, author_results))
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
