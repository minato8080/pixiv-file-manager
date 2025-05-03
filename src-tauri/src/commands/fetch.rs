use pixieve_rs::pixiv::result::illustration_proxy::IllustrationProxy;
use rusqlite::{params, params_from_iter, Connection, Result, ToSql};
use std::fs;
use std::path::Path;
use std::time::Instant;
use std::vec::Vec;
use tauri::{Emitter, State};
use trash::delete;
use walkdir::WalkDir;

use crate::models::fetch::{
    FileCounts, FileDetail, IdInfo, PostConvSequentialInfo, PreConvSequentialInfo, ProcessStats,
    TagProgress,
};
use crate::models::global::AppState;
use crate::models::pixiv::{PixivApi, RealPixivApi};

use crate::models::fetch::FolderCount;

// Start of Selection
#[tauri::command]
pub fn count_files_in_dir(_state: State<AppState>, dir_paths: Vec<String>) -> FileCounts {
    let folder_counts: Vec<FolderCount> = dir_paths
        .iter()
        .map(|dir_path| {
            let path = Path::new(dir_path);
            let base_count = WalkDir::new(path)
                .max_depth(1)
                .into_iter()
                .filter_map(|e| e.ok())
                .filter(|e| e.file_type().is_file())
                .count() as i32;

            let sub_dir_count = WalkDir::new(path)
                .min_depth(2)
                .into_iter()
                .filter_map(|e| e.ok())
                .filter(|e| e.file_type().is_file())
                .count() as i32;

            FolderCount {
                base_count,
                sub_dir_count,
            }
        })
        .collect();

    let total_files = folder_counts
        .iter()
        .map(|fc| fc.base_count + fc.sub_dir_count)
        .sum();

    let interval = std::env::var("INTERVAL_MILL_SEC")
        .ok()
        .and_then(|val| val.parse::<i32>().ok())
        .unwrap_or(1000);

    let total_processing_time_secs = (interval + 200) * total_files / 1000;
    let hours = total_processing_time_secs / 3600;
    let minutes = (total_processing_time_secs % 3600) / 60;
    let seconds = total_processing_time_secs % 60;

    let processing_time = format!("{:02}:{:02}:{:02}", hours, minutes, seconds);

    FileCounts {
        folders: folder_counts,
        total: total_files,
        processing_time,
    }
}

fn extract_dir_detail<P: AsRef<Path>>(folder: P) -> Vec<FileDetail> {
    let mut details = Vec::new();

    fn visit_dirs(dir: &Path, details: &mut Vec<FileDetail>) {
        if let Ok(entries) = fs::read_dir(dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.is_dir() {
                    visit_dirs(&path, details);
                } else if let Some(filename) = entry.file_name().to_str() {
                    if filename.ends_with(".jpg") || filename.ends_with(".png") {
                        if let Some(id) = filename.split('_').next() {
                            let suffix = filename
                                .split("_p")
                                .nth(1)
                                .and_then(|s| s.split('.').next())
                                .unwrap_or("")
                                .to_string();
                            let extension = filename.split('.').last().unwrap_or("").to_string();
                            let save_dir = path
                                .parent()
                                .unwrap_or(Path::new(""))
                                .to_str()
                                .unwrap_or("")
                                .to_string();
                            let created_time = {
                                let metadata = fs::metadata(&path).unwrap();
                                let created_time = metadata.created().unwrap();
                                let duration_since_epoch =
                                    created_time.duration_since(std::time::UNIX_EPOCH).unwrap();
                                duration_since_epoch.as_secs() as i64
                            };
                            let file_size = {
                                let metadata = fs::metadata(&path).unwrap();
                                metadata.len() as i64
                            };
                            details.push(FileDetail {
                                id: id.parse::<u32>().unwrap_or_default(),
                                suffix: suffix.parse::<u8>().unwrap_or_default(),
                                extension,
                                save_dir,
                                created_time,
                                file_size,
                            });
                        }
                    }
                }
            }
        }
    }

    visit_dirs(folder.as_ref(), &mut details);
    details
}

#[tauri::command]
pub fn capture_illust_detail(
    state: State<'_, AppState>,
    window: tauri::Window,
    folders: Vec<String>,
) -> Result<ProcessStats, String> {
    let file_details: Vec<FileDetail> = folders
        .iter()
        .flat_map(|folder| extract_dir_detail(folder))
        .collect();
    // 画像IDを処理し、結果を返す
    match process_image_ids_detail(state, window, file_details) {
        Ok(stats) => Ok(stats),       // 成功時は ProcessStats を返す
        Err(e) => Err(e.to_string()), // 失敗時はエラーメッセージを文字列として返す
    }
}

fn process_image_ids_detail(
    state: State<AppState>,
    window: tauri::Window,
    file_details: Vec<FileDetail>,
) -> Result<ProcessStats, Box<dyn std::error::Error>> {
    let start = Instant::now();
    let mut conn = state.db.lock().unwrap();
    let tx = conn.transaction().map_err(|e| e.to_string())?;

    let mut success_count = 0;
    let mut fail_count = 0;
    let total: usize = file_details.len();
    let mut failed_file_paths = Vec::new();

    prepare_work_table(&tx, &file_details)?;

    let ids_info = extract_unique_ids_info(&tx)?;

    for id_info in ids_info {
        if let Some(first_info) = id_info.sequential_info.first() {
            if first_info.ignore_flag == 1 {
                insert_suffixes_to_illust_info(&tx, id_info)?;
                continue;
            }
        }
        if let Ok(resp) = RealPixivApi::fetch_detail(&state, id_info.illust_id as u32) {
            insert_illust_info(&tx, &resp, &id_info)?;
            insert_tags(&tx, &resp, &id_info)?;
            insert_author_info(&tx, &resp)?;
            success_count += 1;
        } else {
            fail_count += 1;
            failed_file_paths.extend(id_info.sequential_info.iter().map(|info| {
                format!(
                    "{}\\{}_p{}.{}",
                    info.save_dir, id_info.illust_id, info.suffix, info.extension
                )
            }));
        }

        emit_progress(&window, success_count, fail_count, total)?;
        sleep_interval();
    }
    let duration = start.elapsed();
    window.emit("update_db", ()).unwrap();

    delete_duplicate_files(&tx)?;

    tx.commit().map_err(|e| e.to_string())?;

    Ok(ProcessStats {
        total_files: total,
        failed_files: fail_count,
        processing_time_ms: duration.as_millis(),
        failed_file_paths,
    })
}

fn prepare_work_table(
    conn: &Connection,
    file_details: &Vec<FileDetail>,
) -> Result<(), Box<dyn std::error::Error>> {
    conn.execute("DELETE FROM ILLUST_INFO_WORK;", ())?;

    fn to_sql_ref<T: ToSql>(value: &T) -> &dyn ToSql {
        value
    }
    let values = file_details
        .iter()
        .map(|_| "(?, ?, ?, ?, ?, ?, ?, ?, ?)")
        .collect::<Vec<_>>()
        .join(", ");
    let params: Vec<&dyn ToSql> = file_details
        .iter()
        .flat_map(|file_detail| {
            vec![
                to_sql_ref(&file_detail.id),
                to_sql_ref(&file_detail.suffix),
                to_sql_ref(&file_detail.extension),
                to_sql_ref(&file_detail.save_dir),
                to_sql_ref(&file_detail.created_time),
                to_sql_ref(&file_detail.file_size),
                to_sql_ref(&0),
                to_sql_ref(&1),
                to_sql_ref(&0),
            ]
        })
        .collect();

    let sql = format!(
        "INSERT INTO ILLUST_INFO_WORK (illust_id, suffix, extension, save_dir, created_time, file_size, delete_flg, insert_flg, ignore_flg) VALUES {}",
        values
    );
    conn.execute(&sql, params_from_iter(params))?;

    update_flags(&conn)?;

    Ok(())
}

fn update_flags(conn: &Connection) -> Result<(), Box<dyn std::error::Error>> {
    let ignore_flg_update_sql = "UPDATE ILLUST_INFO_WORK \
        SET ignore_flg = 1 \
        WHERE illust_id IN (SELECT illust_id FROM ILLUST_INFO);";
    conn.execute(ignore_flg_update_sql, ())?;

    let insert_flg_update_sql1 = "UPDATE ILLUST_INFO_WORK
        SET insert_flg = 0
        WHERE (illust_id, suffix) IN (
            SELECT illust_id, suffix
            FROM ILLUST_INFO
        );";
    conn.execute(insert_flg_update_sql1, ())?;

    let update_priority_sql = "
        UPDATE ILLUST_INFO_WORK
        SET delete_flg = CASE
            WHEN ROWID = (
                SELECT MIN(sub.ROWID)
                FROM ILLUST_INFO_WORK sub
                WHERE sub.illust_id = ILLUST_INFO_WORK.illust_id
                AND sub.suffix = ILLUST_INFO_WORK.suffix
                AND sub.file_size = (
                    SELECT MIN(sub2.file_size)
                    FROM ILLUST_INFO_WORK sub2
                    WHERE sub2.illust_id = ILLUST_INFO_WORK.illust_id
                    AND sub2.suffix = ILLUST_INFO_WORK.suffix
                )
                AND sub.created_time = (
                    SELECT MIN(sub3.created_time)
                    FROM ILLUST_INFO_WORK sub3
                    WHERE sub3.illust_id = ILLUST_INFO_WORK.illust_id
                    AND sub3.suffix = ILLUST_INFO_WORK.suffix
                    AND sub3.file_size = (
                        SELECT MIN(sub4.file_size)
                        FROM ILLUST_INFO_WORK sub4
                        WHERE sub4.illust_id = ILLUST_INFO_WORK.illust_id
                        AND sub4.suffix = ILLUST_INFO_WORK.suffix
                    )
                )
            ) THEN 0
            ELSE 1
        END;
    ";
    conn.execute(update_priority_sql, ())?;

    let insert_flg_update_sql2 = "UPDATE ILLUST_INFO_WORK
        SET insert_flg = 0
        WHERE delete_flg = 1;";
    conn.execute(insert_flg_update_sql2, ())?;
    Ok(())
}

fn extract_unique_ids_info(conn: &Connection) -> Result<Vec<IdInfo>, Box<dyn std::error::Error>> {
    let select_unique_ids_sql = "
        SELECT 
            illust_id,
            GROUP_CONCAT(suffix) AS suffixes,
            GROUP_CONCAT(extension) AS extensions,
            GROUP_CONCAT(save_dir) AS save_dirs,
            GROUP_CONCAT(delete_flg) AS delete_flags,
            GROUP_CONCAT(insert_flg) AS insert_flags,
            GROUP_CONCAT(ignore_flg) AS ignore_flags
        FROM ILLUST_INFO_WORK
        GROUP BY illust_id;
    ";

    let mut stmt = conn.prepare(select_unique_ids_sql)?;
    let unique_ids_iter = stmt.query_map([], |row| {
        let file_info = PreConvSequentialInfo {
            suffix: row
                .get::<_, String>(1)?
                .split(',')
                .filter_map(|s| s.parse::<i64>().ok()) // 文字列をi64に変換
                .collect::<Vec<i64>>(), // suffix
            extension: row
                .get::<_, String>(2)?
                .split(',')
                .filter_map(|s| s.parse::<String>().ok()) // 文字列をi64に変換
                .collect::<Vec<String>>(), // extension
            save_dir: row
                .get::<_, String>(3)?
                .split(',')
                .filter_map(|s| s.parse::<String>().ok()) // 文字列をi64に変換
                .collect::<Vec<String>>(), // save_dir
            delete_flag: row
                .get::<_, String>(4)?
                .split(',')
                .filter_map(|s| s.parse::<i64>().ok()) // 文字列をi64に変換
                .collect::<Vec<i64>>(), // delete_flag
            insert_flag: row
                .get::<_, String>(5)?
                .split(',')
                .filter_map(|s| s.parse::<i64>().ok()) // 文字列をi64に変換
                .collect::<Vec<i64>>(), // insert_flag
            ignore_flag: row
                .get::<_, String>(6)?
                .split(',')
                .filter_map(|s| s.parse::<i64>().ok()) // 文字列をi64に変換
                .collect::<Vec<i64>>(), // ignore_flag
        };
        let sequential_info = file_info
            .suffix
            .iter()
            .zip(file_info.extension.iter())
            .zip(file_info.save_dir.iter())
            .zip(file_info.delete_flag.iter())
            .zip(file_info.insert_flag.iter())
            .zip(file_info.ignore_flag.iter())
            .map(
                |(((((suffix, extension), save_dir), delete_flag), insert_flag), ignore_flag)| {
                    PostConvSequentialInfo {
                        suffix: *suffix,
                        extension: extension.clone(),
                        save_dir: save_dir.clone(),
                        delete_flag: *delete_flag,
                        insert_flag: *insert_flag,
                        ignore_flag: *ignore_flag,
                    }
                },
            )
            .collect::<Vec<PostConvSequentialInfo>>();

        Ok(IdInfo {
            illust_id: row.get::<_, i64>(0)?, // illust_id
            sequential_info,
        })
    })?;

    let mut unique_ids = Vec::new();
    for unique_id in unique_ids_iter {
        unique_ids.push(unique_id?);
    }

    Ok(unique_ids)
}

fn insert_illust_info(
    conn: &Connection,
    resp: &IllustrationProxy,
    id_info: &IdInfo,
) -> Result<(), Box<dyn std::error::Error>> {
    let filtered_sequential_info = id_info
        .sequential_info
        .iter()
        .filter(|info| info.insert_flag == 1)
        .cloned()
        .collect();
    let filtered_info = IdInfo {
        illust_id: id_info.illust_id,
        sequential_info: filtered_sequential_info,
    };
    let mut stmt = conn.prepare(
        "INSERT INTO ILLUST_INFO (illust_id, suffix, extension, author_id, character, save_dir, control_num) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)"
    )?;
    for info in &filtered_info.sequential_info {
        stmt.execute(params![
            resp.illust.id(),
            info.suffix,
            info.extension,
            resp.illust.user().id(),
            None::<String>,
            info.save_dir,
            0,
        ])?;
    }
    Ok(())
}

fn insert_suffixes_to_illust_info(
    conn: &Connection,
    id_info: IdInfo,
) -> Result<(), Box<dyn std::error::Error>> {
    let filtered_sequential_info = id_info
        .sequential_info
        .iter()
        .filter(|info| info.insert_flag == 1)
        .cloned()
        .collect();
    let filtered_info = IdInfo {
        illust_id: id_info.illust_id,
        sequential_info: filtered_sequential_info,
    };
    let mut select_stmt = conn.prepare(
        "SELECT suffix, extension, author_id, character, save_dir, control_num FROM ILLUST_INFO WHERE illust_id = ?1 ORDER BY control_num ASC LIMIT 1"
    )?;

    let mut stmt = conn.prepare(
        "INSERT INTO ILLUST_INFO (illust_id, suffix, extension, author_id, character, save_dir, control_num) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)"
    )?;

    let row = select_stmt.query_row(params![filtered_info.illust_id], |row| {
        let suffix: i64 = row.get(0)?;
        let extension: String = row.get(1)?;
        let author_id: i64 = row.get(2)?;
        let character: Option<String> = row.get(3)?;
        let save_dir: String = row.get(4)?;
        let control_num: i64 = row.get(5)?;
        Ok((
            suffix,
            extension,
            author_id,
            character,
            save_dir,
            control_num,
        ))
    })?;
    for info in &filtered_info.sequential_info {
        let suffix: i64 = info.suffix;
        let extension: String = info.extension.clone();
        let author_id: i64 = row.2;
        let character: Option<String> = row.3.clone();
        let save_dir: String = info.save_dir.clone();
        let control_num: i64 = row.5;

        stmt.execute(params![
            filtered_info.illust_id,
            suffix,
            extension,
            author_id,
            character,
            save_dir,
            control_num,
        ])?;
    }
    Ok(())
}

fn insert_tags(
    conn: &Connection,
    resp: &IllustrationProxy,
    id_info: &IdInfo,
) -> Result<(), Box<dyn std::error::Error>> {
    for tag in resp.illust.tags() {
        conn.execute(
            "INSERT OR REPLACE INTO TAG_INFO (illust_id, control_num, tag) VALUES (?1, ?2, ?3)",
            params![id_info.illust_id, 0, tag.name()],
        )?;
    }
    Ok(())
}

fn insert_author_info(
    conn: &Connection,
    resp: &IllustrationProxy,
) -> Result<(), Box<dyn std::error::Error>> {
    conn.execute(
        "INSERT OR REPLACE INTO AUTHOR_INFO (author_id, author_name, author_account) VALUES (?1, ?2, ?3)",
        params![
            resp.illust.user().id(),
            resp.illust.user().name(),
            resp.illust.user().account()
        ],
    )?;
    Ok(())
}

fn emit_progress(
    window: &tauri::Window,
    success_count: usize,
    fail_count: usize,
    total: usize,
) -> Result<(), Box<dyn std::error::Error>> {
    let progress = TagProgress {
        success: success_count,
        fail: fail_count,
        current: success_count + fail_count,
        total,
    };
    if let Err(e) = window.emit("tag_progress", serde_json::json!(progress)) {
        eprintln!("Failed to emit event: {}", e);
    }
    Ok(())
}

fn sleep_interval() {
    let interval = std::env::var("INTERVAL_MILL_SEC")
        .ok()
        .and_then(|val| val.parse::<u64>().ok())
        .unwrap_or(1000);

    std::thread::sleep(std::time::Duration::from_millis(interval));
}

fn delete_duplicate_files(conn: &Connection) -> Result<(), String> {
    let delete_query =
        "SELECT save_dir, illust_id, suffix, extension FROM ILLUST_INFO_WORK WHERE delete_flg = 1";
    let mut stmt = conn.prepare(delete_query).map_err(|e| e.to_string())?;
    let delete_iter = stmt
        .query_map([], |row| {
            let save_dir: String = row.get(0)?;
            let illust_id: i64 = row.get(1)?;
            let suffix: i64 = row.get(2)?;
            let extension: String = row.get(3)?;
            Ok((save_dir, illust_id, suffix, extension))
        })
        .map_err(|e| e.to_string())?;

    for entry in delete_iter {
        let (save_dir, illust_id, suffix, extension) = entry.map_err(|e| e.to_string())?;
        let file_name = format!("{}_p{}.{}", illust_id, suffix, extension);
        // ファイルを削除（ゴミ箱に移動）
        let source_path = std::path::Path::new(&save_dir).join(&file_name);
        delete(source_path).map_err(|e| e.to_string())?;
    }

    conn.execute("DELETE FROM ILLUST_INFO_WORK", ())
        .map_err(|e| e.to_string())?;
    Ok(())
}
