use anyhow::{Context, Result};
use regex::Regex;
use rusqlite::named_params;
use rusqlite::params;
use rusqlite::Connection;
use std::collections::HashMap;
use std::fs;
use std::path::Path;
use std::path::PathBuf;
use walkdir::WalkDir;

use crate::models::collect::{FileSummary, TempFile};
use crate::service::common::{execute_sqls, update_cnum};
use crate::{constants, models::collect::CollectSummary};

pub fn prepare_collect_ui_work(conn: &Connection) -> Result<()> {
    let sql = include_str!("../sql/collect/prepare_collect_ui_work.sql");
    let mut params: HashMap<&str, &dyn rusqlite::ToSql> = HashMap::new();
    params.insert(":collect_root", &constants::COLLECT_ROOT);
    execute_sqls(conn, &sql, &params)?;
    Ok(())
}

pub fn reflesh_collect_work(conn: &Connection) -> Result<()> {
    conn.execute("DELETE FROM COLLECT_FILTER_WORK;", [])?;

    let sql1 = include_str!("../sql/collect/insert_collect_filter_work_character.sql");
    conn.execute(
        sql1,
        named_params! {
        ":uncategorized_dir":&constants::UNCATEGORIZED_DIR,
        ":collect_root":&constants::COLLECT_ROOT},
    )?;

    let sql2 = include_str!("../sql/collect/insert_collect_filter_work_series.sql");
    conn.execute(
        sql2,
        named_params! {
        ":uncategorized_dir":&constants::UNCATEGORIZED_DIR,
        ":collect_root":&constants::COLLECT_ROOT},
    )?;

    let sql3 = include_str!("../sql/collect/delete_collect_filter_work.sql");
    conn.execute_batch(sql3)?;

    let sql4 = include_str!("../sql/collect/update_after_count.sql");
    conn.execute_batch(sql4)?;

    Ok(())
}

pub fn sort_collect_work(conn: &Connection) -> Result<()> {
    let sql = include_str!("../sql/collect/sort_collect_work.sql");
    conn.execute_batch(sql)?;
    Ok(())
}

pub fn get_collect_summary(conn: &Connection) -> Result<Vec<CollectSummary>> {
    // COLLECT_UI_WORKの結果を取得して返す
    let mut stmt = conn.prepare(
        "SELECT
                id,
                series,
                character,
                collect_dir,
                before_count,
                after_count,
                unsave
            FROM COLLECT_UI_WORK
            WHERE collect_type <> 3
            ORDER BY id ASC
            ;",
    )?;
    let collect_work_iter = stmt.query_map([], |row| {
        Ok(CollectSummary {
            id: row.get(0)?,
            series: row.get(1)?,
            character: row.get(2)?,
            new_path: row.get::<_, Option<String>>(3)?,
            before_count: row.get(4)?,
            after_count: row.get(5)?,
            is_new: row.get(6)?,
        })
    })?;

    let mut results = Vec::new();
    for collect_work in collect_work_iter {
        results.push(collect_work?);
    }

    Ok(results)
}

pub fn collect_character_info(conn: &Connection) -> Result<()> {
    let sql = include_str!("../sql/collect/collect_character_info.sql");
    let mut params: HashMap<&str, &dyn rusqlite::ToSql> = HashMap::new();
    params.insert(":collect_root", &constants::COLLECT_ROOT);
    execute_sqls(conn, sql, &params)?;
    Ok(())
}

pub fn collect_illust_detail(conn: &Connection) -> Result<()> {
    let sql = include_str!("../sql/collect/collect_illust_detail.sql");
    conn.execute_batch(sql)?;

    Ok(())
}

pub fn move_illust_files(conn: &Connection) -> Result<()> {
    let mut success_files = vec![];

    let mut stmt = conn.prepare(
        "SELECT
            I.illust_id,
            I.suffix,
            I.extension,
            I.save_dir,
            F.collect_dir
            FROM COLLECT_FILTER_WORK F
            JOIN ILLUST_INFO I
            ON F.illust_id = I.illust_id
            AND F.cnum = I.cnum",
    )?;

    let rows = stmt.query_map([], |row| {
        Ok((
            row.get::<_, i64>(0)?,    // illust_id
            row.get::<_, i32>(1)?,    // suffix
            row.get::<_, String>(2)?, // extension
            row.get::<_, String>(3)?, // src_dir
            row.get::<_, String>(4)?, // dest_dir
        ))
    })?;

    for row in rows {
        let row = row?;
        let (illust_id, suffix, extension, src_dir, dest_dir) = row.clone();

        let filename = format!("{}_p{}.{}", illust_id, suffix, extension);
        let src_dir_path = Path::new(&src_dir);
        let src_path = src_dir_path.join(&filename);
        let dest_dir_path = Path::new(&dest_dir);
        let dest_path = dest_dir_path.join(&filename);

        // ディレクトリが存在しなければ作成
        if !dest_dir_path.exists() {
            fs::create_dir_all(&dest_dir_path)
                .with_context(|| format!("ディレクトリ作成失敗: {:?}", dest_dir_path))?;
        }
        if src_path != dest_path {
            match fs::rename(&src_path, &dest_path) {
                Ok(_) => {
                    success_files.push((illust_id, suffix, dest_dir));
                }
                Err(e) => {
                    eprintln!(
                        "ファイル移動失敗: {:?} → {:?} | エラー: {}",
                        src_path, dest_path, e
                    );
                }
            }
        }
    }

    let mut stmt = conn.prepare(
        "UPDATE ILLUST_INFO
         SET save_dir = ?
         WHERE illust_id = ?
           AND suffix = ?;",
    )?;

    for (illust_id, suffix, dest_dir) in success_files {
        stmt.execute(params![dest_dir, illust_id, suffix])?;
    }

    Ok(())
}

pub fn process_sync_db(root: String, conn: &mut Connection) -> Result<Vec<FileSummary>> {
    let tx = conn.transaction()?;
    let missing_files;

    {
        let reg = Regex::new(r"^(\d+)_p(\d+)\.(jpg|png|jpeg)$")?;
        let mut paths_to_insert = Vec::new();

        // 1️⃣ root以下の解析
        for entry in WalkDir::new(&root)
            .into_iter()
            .filter_map(|e| e.ok())
            .filter(|e| e.file_type().is_file())
        {
            if let Some(caps) = reg.captures(&entry.file_name().to_string_lossy()) {
                let path = entry.path();
                let save_dir = path
                    .parent()
                    .map(|p| p.to_string_lossy().to_string())
                    .unwrap_or_default();

                let temp_file = TempFile {
                    illust_id: caps[1].parse()?,
                    suffix: caps[2].parse()?,
                    extension: caps[3].to_string(),
                    save_dir,
                    path: path.to_string_lossy().to_string(),
                };
                paths_to_insert.push(temp_file);
            }
        }

        // 3️⃣ SYNC_DB_WORK に一括 INSERT
        tx.execute("DELETE FROM SYNC_DB_WORK", ())?;
        let mut stmt = tx.prepare(
            "INSERT INTO SYNC_DB_WORK (illust_id, suffix, extension, save_dir, path)
         VALUES (?, ?, ?, ?, ?)",
        )?;
        for file in paths_to_insert {
            stmt.execute(params![
                file.illust_id,
                file.suffix,
                file.extension,
                file.save_dir,
                file.path,
            ])?;
        }

        // 4️⃣ メイン処理(SQL)
        let sql = include_str!("../sql/collect/process_sync_db.sql");
        tx.execute_batch(sql)?;

        // 5️⃣ 重複ファイルをゴミ箱に
        let mut stmt = tx.prepare("SELECT path FROM tmp_to_trash")?;
        for path in stmt.query_map([], |row| row.get::<_, String>(0))? {
            let path = PathBuf::from(path?);
            if path.exists() {
                trash::delete(path)?;
            }
        }

        // 6️⃣ 結果を返却
        let mut stmt = tx.prepare("SELECT illust_id, suffix, path FROM tmp_missing_files")?;
        missing_files = stmt
            .query_map([], |row| {
                Ok(FileSummary {
                    illust_id: row.get(0)?,
                    suffix: row.get(1)?,
                    path: row.get(2)?,
                })
            })?
            .collect::<Result<Vec<FileSummary>, _>>()?;

        // 管理番号を更新
        update_cnum(&tx)?;
    }

    tx.commit()?;

    Ok(missing_files)
}
