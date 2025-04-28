use std::path::Path;

use crate::models::{
    global::AppState,
    search::{AuthorInfo, SearchHistory, SearchResult, UniqueTagList},
};
use rusqlite::{params, Result, ToSql};
use tauri::State;

#[tauri::command]
pub fn get_unique_tag_list(state: State<AppState>) -> Result<Vec<UniqueTagList>, String> {
    let conn = state.db.lock().unwrap();

    let mut stmt = conn
        .prepare("SELECT tag, COUNT(tag) as count FROM TAG_INFO GROUP BY tag ORDER BY count DESC")
        .map_err(|e| e.to_string())?;

    let tag_iter = stmt
        .query_map([], |row| {
            Ok(UniqueTagList {
                tag: row.get(0)?,
                count: row.get(1)?,
            })
        })
        .map_err(|e| e.to_string())?;

    let mut tags = Vec::new();
    for tag in tag_iter {
        tags.push(tag.map_err(|e| e.to_string())?);
    }

    Ok(tags)
}

#[tauri::command]
pub fn get_unique_characters(state: State<AppState>) -> Result<Vec<String>, String> {
    let conn = state.db.lock().unwrap();

    let mut stmt = conn
        .prepare("SELECT DISTINCT character FROM ILLUST_INFO")
        .map_err(|e| e.to_string())?;

    let character_iter = stmt
        .query_map([], |row| {
            let character: Option<String> = row.get(0)?;
            Ok(character)
        })
        .map_err(|e| e.to_string())?;

    let mut characters = Vec::new();
    for character in character_iter {
        if let Some(c) = character.map_err(|e| e.to_string())? {
            characters.push(c);
        }
    }

    Ok(characters)
}

#[tauri::command]
pub fn get_unique_authors(state: State<AppState>) -> Result<Vec<AuthorInfo>, String> {
    let conn = state.db.lock().unwrap();

    let mut stmt = conn
        .prepare("SELECT DISTINCT author_id, author_name, author_account FROM AUTHOR_INFO")
        .map_err(|e| e.to_string())?;

    let author_iter = stmt
        .query_map([], |row| {
            let author_id: u32 = row.get(0)?;
            let author_name: String = row.get(1)?;
            let author_account: String = row.get(2)?;
            Ok(AuthorInfo {
                author_id,
                author_name,
                author_account,
            })
        })
        .map_err(|e| e.to_string())?;

    let mut authors = Vec::new();
    for author in author_iter {
        authors.push(author.map_err(|e| e.to_string())?);
    }

    Ok(authors)
}

#[tauri::command]
pub fn search_by_criteria(
    state: State<AppState>,
    tags: Vec<String>,
    condition: String,
    character: Option<String>,
    author: Option<u32>,
) -> Result<Vec<SearchResult>, String> {
    let conn = state.db.lock().unwrap();
    let mut query = String::from(
    "SELECT ILLUST_INFO.illust_id, suffix, extension, ILLUST_INFO.author_id, character, save_dir, author_name, author_account, GROUP_CONCAT(TAG_INFO.tag, ',') AS tags \
     FROM ILLUST_INFO \
     JOIN AUTHOR_INFO ON ILLUST_INFO.author_id = AUTHOR_INFO.author_id \
     JOIN TAG_INFO ON ILLUST_INFO.illust_id = TAG_INFO.illust_id \
     AND ILLUST_INFO.control_num = TAG_INFO.control_num ",
);

    let mut params: Vec<Box<dyn ToSql>> = Vec::new();
    let mut where_clauses: Vec<String> = Vec::new();

    if !tags.is_empty() {
        // タグで対象のイラストIDを絞る
        let placeholders = std::iter::repeat("?")
            .take(tags.len())
            .collect::<Vec<_>>()
            .join(", ");

        query = format!(
        "SELECT filtered.illust_id, suffix, extension, filtered.author_id, character, save_dir, author_name, author_account, GROUP_CONCAT(TAG_INFO.tag, ',') AS tags \
         FROM ( \
             SELECT ILLUST_INFO.illust_id, suffix, extension, ILLUST_INFO.author_id, character, save_dir, ILLUST_INFO.control_num, author_name, author_account \
             FROM ILLUST_INFO \
             JOIN AUTHOR_INFO ON ILLUST_INFO.author_id = AUTHOR_INFO.author_id \
             JOIN TAG_INFO ON ILLUST_INFO.illust_id = TAG_INFO.illust_id \
             WHERE TAG_INFO.tag IN ({}) \
             GROUP BY ILLUST_INFO.illust_id \
             {} \
         ) AS filtered \
         LEFT JOIN TAG_INFO ON filtered.illust_id = TAG_INFO.illust_id \
         AND filtered.control_num = TAG_INFO.control_num ",
        placeholders,
        match condition.as_str() {
            "AND" => format!("HAVING COUNT(DISTINCT TAG_INFO.tag) = {}", tags.len()),
            "OR" => "".to_string(),
            _ => panic!("Unknown condition: {}", condition),
        }
    );

        for tag in &tags {
            params.push(Box::new(tag.clone()));
        }
    }

    // character, author 条件
    if character.is_some() || author.is_some() {
        where_clauses.clear(); // 新しい外側クエリ用
        if let Some(c) = character.clone() {
            where_clauses.push("filtered.character = ?".to_string());
            params.push(Box::new(c));
        }
        if let Some(a) = author {
            where_clauses.push("filtered.author_id = ?".to_string());
            params.push(Box::new(a));
        }
    }

    if !where_clauses.is_empty() {
        query.push_str(" WHERE ");
        query.push_str(&where_clauses.join(" AND "));
    }

    query.push_str(" GROUP BY filtered.illust_id");

    let mut stmt = conn.prepare(&query).map_err(|e| e.to_string())?;

    // Convert params to Vec<&dyn ToSql>
    let param_refs: Vec<&dyn ToSql> = params.iter().map(|p| p.as_ref()).collect();

    let detail_iter = stmt
        .query_map(&*param_refs, |row| {
            let id: u32 = row.get(0)?;
            let suffix: Option<u8> = row.get(1)?;
            let extension: String = row.get(2)?;
            let author_id: u32 = row.get(3)?;
            let character: Option<String> = row.get(4)?;
            let save_dir: String = row.get(5)?;
            let author_name: String = row.get(6)?;
            let author_account: String = row.get(7)?;
            let tags: Option<String> = row.get(8)?;
            let file_name = match suffix {
                Some(s) => format!("{}_p{}.{}", id, s, extension),
                None => format!("{}.{}", id, extension),
            };
            let pathbuf = Path::new(&save_dir).join(&file_name);
            let path = pathbuf.to_str().unwrap().to_string();

            let update_time: String = {
                let metadata = std::fs::metadata(&path)
                    .map_err(|_e| rusqlite::Error::InvalidPath(pathbuf.clone()))?;
                let modified_time = metadata.modified().unwrap();
                let datetime: chrono::DateTime<chrono::Local> = modified_time.into();
                datetime.format("%Y-%m-%d %H:%M:%S").to_string()
            };

            let author_info = AuthorInfo {
                author_id,
                author_name: author_name.clone(),
                author_account: author_account.clone(),
            };

            Ok(SearchResult {
                id,
                file_name,
                author: author_info,
                character,
                save_dir,
                update_time,
                thumbnail_url: path,
                tags,
            })
        })
        .map_err(|e| e.to_string())?;

    let mut results = Vec::new();
    for detail in detail_iter {
        results.push(detail.map_err(|e| e.to_string())?);
    }

    let author_info = author.and_then(|author_id| {
        results
            .iter()
            .find(|result| result.author.author_id == author_id)
            .map(|result| result.author.clone())
    });

    save_search_history(
        &conn,
        SearchHistory {
            tags,
            condition: condition.clone(),
            timestamp: chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string(),
            result_count: results.len() as u8,
            character,
            author: author_info,
        },
    )
    .map_err(|e| e.to_string())?;

    Ok(results)
}

#[tauri::command]
pub fn get_search_history(state: State<AppState>) -> Result<Vec<SearchHistory>, String> {
    let conn = state.db.lock().unwrap();

    let mut stmt = conn.prepare(
        "SELECT tags, character, author_info, condition, timestamp, result_count FROM SEARCH_HISTORY ORDER BY timestamp DESC LIMIT 10"
    ).map_err(|e| e.to_string())?;

    let history_iter = stmt
        .query_map([], |row| {
            let tags_json: String = row.get(0)?;
            let character: Option<String> = row.get(1)?;
            let author_json: Option<String> = row.get(2)?;
            let author: Option<AuthorInfo> = match author_json {
                Some(json) => serde_json::from_str(&json)
                    .map_err(|e| rusqlite::Error::UserFunctionError(Box::new(e)))?,
                None => None,
            };
            let condition: String = row.get(3)?;
            let timestamp: String = row.get(4)?;
            let result_count: u8 = row.get(5)?;

            let tags: Vec<String> = serde_json::from_str(&tags_json)
                .map_err(|e| rusqlite::Error::UserFunctionError(Box::new(e)))?;

            Ok(SearchHistory {
                tags,
                character,
                author,
                condition,
                timestamp,
                result_count,
            })
        })
        .map_err(|e| e.to_string())?;

    let mut history = Vec::new();
    for item in history_iter {
        history.push(item.map_err(|e| e.to_string())?);
    }

    Ok(history)
}

fn save_search_history(
    conn: &std::sync::MutexGuard<'_, rusqlite::Connection>,
    history: SearchHistory,
) -> Result<(), String> {
    let tags_json = serde_json::to_string(&history.tags).map_err(|e| e.to_string())?;
    let author_json = serde_json::to_string(&history.author).map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT INTO SEARCH_HISTORY (tags, character, author_info, condition, timestamp, result_count) VALUES (?, ?, ?, ?, ?, ?)",
        params![tags_json, history.character, author_json, history.condition, history.timestamp, history.result_count],
    )
    .map_err(|e| e.to_string())?;

    // 履歴は10件まで保存
    conn.execute(
        "DELETE FROM SEARCH_HISTORY WHERE ROWID NOT IN ( \
            SELECT ROWID FROM SEARCH_HISTORY ORDER BY timestamp DESC LIMIT 10 \
            )",
        [],
    )
    .map_err(|e| e.to_string())?;

    Ok(())
}
