use std::path::Path;

use crate::models::{
    global::AppState,
    search::{AuthorInfo, CharacterInfo, SearchHistory, SearchResult, TagInfo},
};
use rusqlite::{params, Result, ToSql};
use tauri::State;

#[tauri::command]
pub fn get_unique_tag_list(state: State<AppState>) -> Result<Vec<TagInfo>, String> {
    let conn = state.db.lock().unwrap();

    let mut stmt = conn
        .prepare(
            "SELECT T.tag, COUNT(DISTINCT I.illust_id || '-' || I.suffix) AS count
         FROM TAG_INFO T
         JOIN ILLUST_INFO I
           ON T.illust_id = I.illust_id AND T.control_num = I.control_num
         GROUP BY T.tag
         ORDER BY count DESC, T.tag ASC",
        )
        .map_err(|e| e.to_string())?;

    let tag_iter = stmt
        .query_map([], |row| {
            Ok(TagInfo {
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
pub fn get_unique_characters(state: State<AppState>) -> Result<Vec<CharacterInfo>, String> {
    let conn = state.db.lock().unwrap();

    let mut stmt = conn
        .prepare(
            "
            SELECT 
                C.character,
                COUNT(DISTINCT I.illust_id || '-' || I.suffix) AS illust_count
            FROM 
                CHARACTER_INFO C
            LEFT JOIN 
                ILLUST_DETAIL D ON C.character = D.character
            LEFT JOIN 
                ILLUST_INFO I ON D.illust_id = I.illust_id
            GROUP BY 
                C.character
            ORDER BY illust_count DESC, C.character ASC
        ",
        )
        .map_err(|e| e.to_string())?;

    let character_iter = stmt
        .query_map([], |row| {
            let character: String = row.get(0)?;
            let count: Option<u32> = row.get(1)?;
            Ok(CharacterInfo { character, count })
        })
        .map_err(|e| e.to_string())?;

    let characters: Vec<CharacterInfo> = character_iter
        .into_iter()
        .filter_map(|character| character.ok())
        .collect();

    Ok(characters)
}

#[tauri::command]
pub fn get_unique_authors(state: State<AppState>) -> Result<Vec<AuthorInfo>, String> {
    let conn = state.db.lock().unwrap();

    let mut stmt = conn
        .prepare(
            "
            SELECT 
                A.author_id,
                A.author_name,
                A.author_account,
                COUNT(DISTINCT I.illust_id || '-' || I.suffix) AS illust_count
            FROM 
                ILLUST_INFO I
            INNER JOIN 
                AUTHOR_INFO A ON A.author_id = D.author_id
            INNER JOIN 
                ILLUST_DETAIL D ON I.illust_id = D.illust_id AND I.control_num = D.control_num
            GROUP BY 
                A.author_id, A.author_name, A.author_account
            ORDER BY illust_count DESC, A.author_id ASC
        ",
        )
        .map_err(|e| e.to_string())?;

    let author_iter = stmt
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

    let mut authors = Vec::new();
    for author in author_iter {
        let author_info = author.map_err(|e| e.to_string())?;
        if author_info.count.unwrap_or(0) > 0 {
            authors.push(author_info);
        }
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
    let mut params: Vec<Box<dyn ToSql>> = vec![];

    let sql_template = include_str!("../sql/search_by_criteria.sql");

    let subquery_where_clause = if tags.len() > 0 {
        let tag_placeholders = tags.iter().map(|_| "?").collect::<Vec<_>>().join(", ");
        format!("WHERE T.tag IN ({})", tag_placeholders)
    } else {
        "".to_string()
    };

    for tag in &tags {
        params.push(Box::new(tag.clone()));
    }

    let having_clause = if tags.len() > 0 {
        match condition.as_str() {
            "AND" => format!("HAVING COUNT(DISTINCT T.tag) = {}", tags.len()),
            "OR" => "".to_string(),
            _ => return Err("不正な条件指定".to_string()),
        }
    } else {
        "".to_string()
    };

    let mut where_clauses = vec![];

    if let Some(c) = &character {
        where_clauses.push("F.character = ?".to_string());
        params.push(Box::new(c.clone()));
    }

    if let Some(a) = author {
        where_clauses.push("F.author_id = ?".to_string());
        params.push(Box::new(a));
    }

    let where_clause = if !where_clauses.is_empty() {
        format!("WHERE {}", where_clauses.join(" AND "))
    } else {
        "".to_string()
    };

    let sql = sql_template
        .replace("/*:subquery_where_clause*/", &subquery_where_clause)
        .replace("/*:having_clause*/", &having_clause)
        .replace("/*:where_clause*/", &where_clause);

    let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;
    let param_refs: Vec<&dyn ToSql> = params.iter().map(|p| p.as_ref()).collect();

    let rows = stmt
        .query_map(&*param_refs, |row| {
            let id: u32 = row.get(0)?;
            let suffix: Option<u8> = row.get(1)?;
            let ext: String = row.get(2)?;
            let author_id: u32 = row.get(3)?;
            let character: Option<String> = row.get(4)?;
            let save_dir: String = row.get(5)?;
            let author_name: String = row.get(6)?;
            let author_account: String = row.get(7)?;
            let tags: Option<String> = row.get(8)?;

            let file_name = match suffix {
                Some(s) => format!("{}_p{}.{}", id, s, ext),
                None => format!("{}.{}", id, ext),
            };

            let pathbuf = Path::new(&save_dir).join(&file_name);
            let path_str = pathbuf.to_str().unwrap_or("").to_string();

            let update_time = match std::fs::metadata(&pathbuf).and_then(|m| m.modified()) {
                Ok(t) => chrono::DateTime::<chrono::Local>::from(t)
                    .format("%Y-%m-%d %H:%M:%S")
                    .to_string(),
                Err(_) => "1970-01-01 00:00:00".to_string(),
            };

            Ok(SearchResult {
                id,
                file_name,
                author: AuthorInfo {
                    author_id,
                    author_name,
                    author_account,
                    count: None,
                },
                character,
                save_dir,
                update_time,
                thumbnail_url: path_str,
                tags,
            })
        })
        .map_err(|e| e.to_string())?;

    let mut results = vec![];
    for row in rows {
        results.push(row.map_err(|e| e.to_string())?);
    }

    let author_info = author.and_then(|author_id| {
        results
            .iter()
            .find(|r| r.author.author_id == author_id)
            .map(|r| r.author.clone())
    });

    save_search_history(
        &conn,
        SearchHistory {
            tags,
            condition,
            timestamp: chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string(),
            result_count: results.len() as u32,
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
            let result_count: u32 = row.get(5)?;

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
        "DELETE FROM SEARCH_HISTORY WHERE ROWID NOT IN (
            SELECT ROWID FROM SEARCH_HISTORY ORDER BY timestamp DESC LIMIT 10
            )",
        [],
    )
    .map_err(|e| e.to_string())?;

    Ok(())
}
