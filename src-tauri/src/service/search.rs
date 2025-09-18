use anyhow::Result;
use sqlx::SqlitePool;

use crate::{
    models::search::{AuthorInfo, CharacterInfo, SearchResult, TagInfo},
    named_params,
    service::common::build_named_query,
};

pub async fn process_search_by_criteria(
    tags: Vec<String>,
    character: Option<String>,
    author_id: Option<u32>,
    pool: &SqlitePool,
) -> Result<Vec<SearchResult>> {
    let sql = include_str!("../sql/search/search_by_criteria.sql");

    let results = build_named_query(
        &sql,
        &named_params!({
            ":character"=>character,
            ":author_id"=>author_id.map(|v| v as i64),
            ":tag_count"=>tags.len() as i64,
            ":tags"=>tags,
        }),
    )?
    .build_query_as()
    .fetch_all(pool)
    .await?;

    Ok(results)
}

pub async fn process_search_by_id(id: i64, pool: &SqlitePool) -> Result<Vec<SearchResult>> {
    let sql = include_str!("../sql/search/search_by_id.sql");

    let results = sqlx::query_as::<_, SearchResult>(sql)
        .bind(id)
        .fetch_all(pool)
        .await?;

    Ok(results)
}

pub async fn process_filter_dropdowns(
    tags: Vec<String>,
    character: Option<String>,
    author_id: Option<u32>,
    pool: &SqlitePool,
) -> Result<(Vec<TagInfo>, Vec<CharacterInfo>, Vec<AuthorInfo>)> {
    let params = &named_params!({
        ":character"=>character,
        ":author_id"=>author_id.map(|v| v as i64),
        ":tag_count"=>tags.len() as i64,
        ":tags"=>tags,
    });

    let sql = include_str!("../sql/search/get_filtered_tags.sql");
    let tag_results: Vec<TagInfo> = build_named_query(&sql, params)?
        .build_query_as()
        .fetch_all(pool)
        .await?;

    let sql = include_str!("../sql/search/get_filtered_characters.sql");
    let character_results: Vec<CharacterInfo> = build_named_query(&sql, params)?
        .build_query_as()
        .fetch_all(pool)
        .await?;

    let sql = include_str!("../sql/search/get_filtered_authors.sql");
    let author_results: Vec<AuthorInfo> = build_named_query(&sql, params)?
        .build_query_as()
        .fetch_all(pool)
        .await?;

    Ok((tag_results, character_results, author_results))
}
