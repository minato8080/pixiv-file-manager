use crate::{
    models::{
        common::AppState,
        search::{AuthorInfo, CharacterInfo, SearchResult, TagInfo},
    },
    service::search::{process_search_by_criteria, process_search_by_id},
};
use rusqlite::Result;
use tauri::{command, State};

#[command]
pub fn get_unique_tags(state: State<AppState>) -> Result<Vec<TagInfo>, String> {
    let conn = state.db.lock().unwrap();

    let sql = include_str!("../sql/search/get_unique_tags.sql");
    let mut stmt = conn.prepare(sql).map_err(|e| e.to_string())?;

    let iter = stmt
        .query_map([], |row| {
            Ok(TagInfo {
                tag: row.get(0)?,
                count: row.get(1)?,
            })
        })
        .map_err(|e| e.to_string())?;

    let tags = iter.into_iter().filter_map(|tag| tag.ok()).collect();

    Ok(tags)
}

#[command]
pub fn get_unique_characters(state: State<AppState>) -> Result<Vec<CharacterInfo>, String> {
    let conn = state.db.lock().unwrap();

    let sql = include_str!("../sql/search/get_unique_characters.sql");
    let mut stmt = conn.prepare(sql).map_err(|e| e.to_string())?;

    let iter = stmt
        .query_map([], |row| {
            let character: String = row.get(0)?;
            let count: Option<u32> = row.get(1)?;
            Ok(CharacterInfo { character, count })
        })
        .map_err(|e| e.to_string())?;

    let characters = iter
        .into_iter()
        .filter_map(|character| character.ok())
        .collect();

    Ok(characters)
}

#[command]
pub fn get_unique_authors(state: State<AppState>) -> Result<Vec<AuthorInfo>, String> {
    let conn = state.db.lock().unwrap();

    let sql = include_str!("../sql/search/get_unique_authors.sql");
    let mut stmt = conn.prepare(sql).map_err(|e| e.to_string())?;

    let iter = stmt
        .query_map([], |row| {
            let author_id: u32 = row.get(0)?;
            let author_name: String = row.get(1)?;
            let author_account: String = row.get(2)?;
            let count: Option<u32> = row.get(3)?;
            Ok(AuthorInfo {
                author_id,
                author_name,
                author_account,
                count,
            })
        })
        .map_err(|e| e.to_string())?;

    let authors = iter.into_iter().filter_map(|author| author.ok()).collect();

    Ok(authors)
}

#[command]
pub fn search_by_criteria(
    tags: Vec<String>,
    character: Option<String>,
    author: Option<u32>,
    state: State<AppState>,
) -> Result<Vec<SearchResult>, String> {
    let conn = state.db.lock().unwrap();
    let results =
        process_search_by_criteria(tags, character, author, &conn).map_err(|e| e.to_string())?;

    Ok(results)
}

#[command]
pub fn search_by_id(id: i64, state: State<AppState>) -> Result<Vec<SearchResult>, String> {
    let conn = state.db.lock().unwrap();
    let results = process_search_by_id(id, &conn).map_err(|e| e.to_string())?;

    Ok(results)
}
