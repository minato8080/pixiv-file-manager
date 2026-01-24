use tauri::{command, State};

use crate::models::{common::AppState, search::*};
use crate::service::search::*;
use crate::util::LogErr;

#[command]
pub async fn get_unique_tags(state: State<'_, AppState>) -> Result<Vec<TagInfo>, String> {
    let pool = &state.pool;

    let sql = include_str!("../sql/search/get_unique_tags.sql");

    let tags = sqlx::query_as::<_, TagInfo>(sql)
        .fetch_all(pool)
        .await
        .log_err()?;

    Ok(tags)
}

#[command]
pub async fn get_unique_characters(
    state: State<'_, AppState>,
) -> Result<Vec<CharacterInfo>, String> {
    let pool = &state.pool;

    let sql = include_str!("../sql/search/get_unique_characters.sql");

    let characters = sqlx::query_as::<_, CharacterInfo>(sql)
        .fetch_all(pool)
        .await
        .log_err()?;

    Ok(characters)
}

#[command]
pub async fn get_unique_authors(state: State<'_, AppState>) -> Result<Vec<AuthorInfo>, String> {
    let pool = &state.pool;

    let sql = include_str!("../sql/search/get_unique_authors.sql");

    let authors = sqlx::query_as::<_, AuthorInfo>(sql)
        .fetch_all(pool)
        .await
        .log_err()?;

    Ok(authors)
}

#[command]
pub async fn search_by_criteria(
    tags: Vec<String>,
    character: Option<String>,
    author_id: Option<u32>,
    state: State<'_, AppState>,
) -> Result<Vec<SearchResult>, String> {
    let pool = &state.pool;

    let results = process_search_by_criteria(tags, character, author_id, pool)
        .await
        .log_err()?;

    Ok(results)
}

#[command]
pub async fn search_by_id(
    id: i64,
    state: State<'_, AppState>,
) -> Result<Vec<SearchResult>, String> {
    let pool = &state.pool;

    let results = process_search_by_id(id, pool).await.log_err()?;

    Ok(results)
}

#[command]
pub async fn filter_dropdowns(
    tags: Vec<String>,
    character: Option<String>,
    author_id: Option<u32>,
    state: State<'_, AppState>,
) -> Result<(Vec<TagInfo>, Vec<CharacterInfo>, Vec<AuthorInfo>), String> {
    let pool = &state.pool;

    let results = process_filter_dropdowns(tags, character, author_id, pool)
        .await
        .log_err()?;

    Ok(results)
}
