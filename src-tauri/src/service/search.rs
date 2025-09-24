use anyhow::Result;
use sqlx::SqlitePool;

use crate::{
    models::search::{AuthorInfo, CharacterInfo, SearchResult, TagInfo},
    service::common::{build_named_query, hash_params},
    util::ResultWithLocationExt,
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
        &hash_params(&vec![
            (":character", character.into()),
            (":author_id", author_id.into()),
            (":tag_count", tags.len().into()),
            (":tags", tags.into()),
        ])
        .with_location()?,
    )?
    .build_query_as()
    .fetch_all(pool)
    .await
    .with_location()?;

    Ok(results)
}

pub async fn process_search_by_id(id: i64, pool: &SqlitePool) -> Result<Vec<SearchResult>> {
    let sql = include_str!("../sql/search/search_by_id.sql");

    let results = sqlx::query_as::<_, SearchResult>(sql)
        .bind(id)
        .fetch_all(pool)
        .await
        .with_location()?;

    Ok(results)
}

pub async fn process_filter_dropdowns(
    tags: Vec<String>,
    character: Option<String>,
    author_id: Option<u32>,
    pool: &SqlitePool,
) -> Result<(Vec<TagInfo>, Vec<CharacterInfo>, Vec<AuthorInfo>)> {
    let param_vec = vec![
        (":character", character.into()),
        (":author_id", author_id.into()),
        (":tag_count", tags.len().into()),
        (":tags", tags.into()),
    ];
    let params = hash_params(&param_vec).with_location()?;

    let sql = include_str!("../sql/search/get_filtered_tags.sql");
    let tag_results: Vec<TagInfo> = build_named_query(&sql, &params)?
        .build_query_as()
        .fetch_all(pool)
        .await
        .with_location()?;

    let sql = include_str!("../sql/search/get_filtered_characters.sql");
    let character_results: Vec<CharacterInfo> = build_named_query(&sql, &params)?
        .build_query_as()
        .fetch_all(pool)
        .await
        .with_location()?;

    let sql = include_str!("../sql/search/get_filtered_authors.sql");
    let author_results: Vec<AuthorInfo> = build_named_query(&sql, &params)?
        .build_query_as()
        .fetch_all(pool)
        .await
        .with_location()?;

    Ok((tag_results, character_results, author_results))
}
