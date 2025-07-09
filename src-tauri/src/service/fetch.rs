use pixieve_rs::pixiv::result::illustration_proxy::IllustrationProxy;
use regex::Regex;
use rusqlite::{params, Connection, Result};
use std::fs;
use std::path::Path;
use std::time::Instant;
use std::vec::Vec;
use tauri::{Emitter, State};
use trash::delete;

use crate::models::fetch::{
    FileDetail, IdInfo, PostConvSequentialInfo, PreConvSequentialInfo, ProcessStats, TagProgress,
};
use crate::models::global::AppState;
use crate::models::pixiv::{PixivApi, RealPixivApi};

pub fn extract_dir_detail<P: AsRef<Path>>(folder: P) -> Vec<FileDetail> {
    let mut details = Vec::new();

    fn visit_dirs(dir: &Path, details: &mut Vec<FileDetail>) {
        let re = Regex::new(r"^(\d+)_p(\d+)\.(jpg|png)$").unwrap();
        if let Ok(entries) = fs::read_dir(dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.is_dir() {
                    visit_dirs(&path, details);
                } else if let Some(file_name) = entry.file_name().to_str() {
                    if let Some(caps) = re.captures(file_name) {
                        let filename = caps.get(0).unwrap().as_str(); // 全体のマッチ
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

pub fn process_image_ids_detail(
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
            insert_illust_info_with_defaults(&tx, &id_info)?;
            insert_tags_with_defaults(&tx, &id_info)?;
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
    // テーブル初期化
    conn.execute("DELETE FROM ILLUST_INFO_WORK;", ())?;

    // Prepared Statement を事前に用意
    let sql = "INSERT OR IGNORE INTO ILLUST_INFO_WORK (
        illust_id, suffix, extension, save_dir,
        created_time, file_size, delete_flg, insert_flg, ignore_flg
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)";
    let mut stmt = conn.prepare(sql)?;

    // チャンクサイズ（バルクインサート）
    const BATCH_SIZE: usize = 100;

    for chunk in file_details.chunks(BATCH_SIZE) {
        for file_detail in chunk {
            stmt.execute(params![
                file_detail.id,
                file_detail.suffix,
                file_detail.extension,
                file_detail.save_dir,
                file_detail.created_time,
                file_detail.file_size,
                0, // delete_flg
                1, // insert_flg
                0, // ignore_flg
            ])?;
        }
    }

    // フラグ更新（この関数が外部ならそのまま呼び出し）
    update_flags(conn)?;

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
        "INSERT INTO ILLUST_INFO (illust_id, suffix, extension, save_dir, control_num) VALUES (?1, ?2, ?3, ?4, ?5)"
    )?;
    for info in &filtered_info.sequential_info {
        stmt.execute(params![
            resp.illust.id(),
            info.suffix,
            info.extension,
            info.save_dir,
            0,
        ])?;
    }
    let mut stmt = conn.prepare(
        "INSERT INTO ILLUST_DETAIL (illust_id, author_id, character, control_num) VALUES (?1, ?2, ?3, ?4)"
    )?;
    stmt.execute(params![
        resp.illust.id(),
        resp.illust.user().id(),
        None::<String>,
        0,
    ])?;
    Ok(())
}

fn insert_illust_info_with_defaults(
    conn: &Connection,
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
        "INSERT INTO ILLUST_INFO (illust_id, suffix, extension, save_dir, control_num) VALUES (?1, ?2, ?3, ?4, ?5)"
    )?;
    for info in &filtered_info.sequential_info {
        stmt.execute(params![
            id_info.illust_id,
            info.suffix,
            info.extension,
            info.save_dir,
            0,
        ])?;
    }
    let mut stmt = conn.prepare(
        "INSERT INTO ILLUST_DETAIL (illust_id, author_id, character, control_num) VALUES (?1, ?2, ?3, ?4)"
    )?;
    stmt.execute(params![id_info.illust_id, 0, None::<String>, 0,])?;
    Ok(())
}

fn insert_suffixes_to_illust_info(
    conn: &Connection,
    id_info: IdInfo,
) -> Result<(), Box<dyn std::error::Error>> {
    // insert_flagが1のものだけを抽出
    let filtered_info = IdInfo {
        illust_id: id_info.illust_id,
        sequential_info: id_info
            .sequential_info
            .iter()
            .filter(|info| info.insert_flag == 1)
            .cloned()
            .collect(),
    };

    // 既存のILLUST_INFOからcontrol_numを取得
    let (control_num,) = {
        let mut stmt = conn.prepare(
            "SELECT control_num FROM ILLUST_INFO WHERE illust_id = ?1 ORDER BY control_num ASC LIMIT 1"
        )?;
        stmt.query_row(params![filtered_info.illust_id], |row| {
            let control_num: i64 = row.get(0)?;
            Ok((control_num,))
        })?
    };

    // 挿入用ステートメントを準備
    let mut insert_stmt = conn.prepare(
        "INSERT INTO ILLUST_INFO (illust_id, suffix, extension, save_dir, control_num) VALUES (?1, ?2, ?3, ?4, ?5)"
    )?;

    // 各sequential_infoを挿入
    for info in &filtered_info.sequential_info {
        insert_stmt.execute(params![
            filtered_info.illust_id,
            info.suffix,
            info.extension,
            info.save_dir,
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

fn insert_tags_with_defaults(
    conn: &Connection,
    id_info: &IdInfo,
) -> Result<(), Box<dyn std::error::Error>> {
    conn.execute(
        "INSERT OR REPLACE INTO TAG_INFO (illust_id, control_num, tag) VALUES (?1, ?2, ?3)",
        params![id_info.illust_id, 0, "Missing"],
    )?;
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
