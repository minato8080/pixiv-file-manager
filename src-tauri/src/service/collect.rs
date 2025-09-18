use anyhow::{Context, Result};
use regex::Regex;
use sqlx::Acquire;
use sqlx::SqliteConnection;
use sqlx::SqlitePool;
use std::fs;
use std::path::Path;
use std::path::PathBuf;
use walkdir::WalkDir;

use crate::constants;
use crate::execute_queries;
use crate::models::collect::*;
use crate::named_params;
use crate::service::common::{execute_named_queries, update_cnum};

pub async fn prepare_collect_ui_work(conn: &mut SqliteConnection) -> Result<()> {
    let sql = include_str!("../sql/collect/prepare_collect_ui_work.sql");

    execute_named_queries(
        &mut *conn,
        &sql,
        &named_params!({
            ":collect_root"=>constants::COLLECT_ROOT
        }),
    )
    .await?;
    Ok(())
}

pub async fn reflesh_collect_work(conn: &mut SqliteConnection) -> Result<()> {
    sqlx::query("DELETE FROM COLLECT_FILTER_WORK;")
        .execute(&mut *conn)
        .await?;

    let sql1 = include_str!("../sql/collect/insert_collect_filter_work_character.sql");
    execute_named_queries(
        &mut *conn,
        sql1,
        &named_params!({
            ":uncategorized_dir"=>constants::UNCATEGORIZED_DIR,
            ":collect_root"=>constants::COLLECT_ROOT
        }),
    )
    .await?;

    let sql2 = include_str!("../sql/collect/insert_collect_filter_work_series.sql");
    execute_named_queries(
        &mut *conn,
        sql2,
        &named_params!({
            ":uncategorized_dir"=>constants::UNCATEGORIZED_DIR,
            ":collect_root"=>constants::COLLECT_ROOT
        }),
    )
    .await?;

    let sql3 = include_str!("../sql/collect/delete_collect_filter_work.sql");
    execute_queries(&mut *conn, sql3).await?;

    let sql4 = include_str!("../sql/collect/update_after_count.sql");
    execute_queries(&mut *conn, sql4).await?;

    Ok(())
}

pub async fn sort_collect_work(conn: &mut SqliteConnection) -> Result<()> {
    let sql = include_str!("../sql/collect/sort_collect_work.sql");

    execute_queries(&mut *conn, sql).await?;

    Ok(())
}

pub async fn get_collect_summary(pool: &SqlitePool) -> Result<Vec<CollectSummary>> {
    let sql = include_str!("../sql/collect/get_collect_summary.sql");

    let results = sqlx::query_as::<_, CollectSummary>(sql)
        .fetch_all(pool)
        .await?;

    Ok(results)
}

pub async fn collect_character_info(conn: &mut SqliteConnection) -> Result<()> {
    let sql = include_str!("../sql/collect/collect_character_info.sql");

    execute_named_queries(
        &mut *conn,
        sql,
        &named_params!({
            ":collect_root"=>constants::COLLECT_ROOT
        }),
    )
    .await?;
    Ok(())
}

pub async fn collect_illust_detail(conn: &mut SqliteConnection) -> Result<()> {
    let sql = include_str!("../sql/collect/collect_illust_detail.sql");

    execute_queries(&mut *conn, sql).await?;

    Ok(())
}

pub async fn move_illust_files(conn: &mut SqliteConnection) -> Result<()> {
    let mut success_files = vec![];

    let sql = include_str!("../sql/collect/move_illust_files.sql");

    let rows: Vec<MoveIllustFiles> = sqlx::query_as(sql).fetch_all(&mut *conn).await?;

    for row in rows {
        let MoveIllustFiles {
            illust_id,
            suffix,
            extension,
            src_dir,
            dest_dir,
        } = row;

        let filename = format!("{}_p{}.{}", illust_id, suffix, extension);

        let src_path: PathBuf = Path::new(&src_dir).join(&filename);
        let dest_path: PathBuf = Path::new(&dest_dir).join(&filename);

        // ディレクトリが存在しなければ作成
        if let Err(e) = fs::create_dir_all(&dest_path.parent().unwrap())
            .with_context(|| format!("ディレクトリ作成失敗: {:?}", dest_path.parent().unwrap()))
        {
            eprintln!("{}", e);
            continue;
        }

        if src_path != dest_path {
            match fs::rename(&src_path, &dest_path) {
                Ok(_) => success_files.push((illust_id, suffix, dest_dir.clone())),
                Err(e) => eprintln!(
                    "ファイル移動失敗: {:?} → {:?} | エラー: {}",
                    src_path, dest_path, e
                ),
            }
        }
    }

    let sql = "UPDATE ILLUST_INFO
         SET save_dir = ?
         WHERE illust_id = ?
           AND suffix = ?;";

    for (illust_id, suffix, dest_dir) in success_files {
        sqlx::query(sql)
            .bind(dest_dir)
            .bind(illust_id)
            .bind(suffix)
            .execute(&mut *conn)
            .await?;
    }

    Ok(())
}

pub async fn process_sync_db(root: String, pool: &SqlitePool) -> Result<Vec<FileSummary>> {
    let mut tx = pool.begin().await?;
    let conn = tx.acquire().await?;

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
        sqlx::query("DELETE FROM SYNC_DB_WORK")
            .execute(&mut *conn)
            .await?;

        let sql = "INSERT INTO SYNC_DB_WORK (illust_id, suffix, extension, save_dir, path)
         VALUES (?, ?, ?, ?, ?)";

        for file in paths_to_insert {
            sqlx::query(sql)
                .bind(file.illust_id)
                .bind(file.suffix)
                .bind(file.extension)
                .bind(file.save_dir)
                .bind(file.path)
                .execute(&mut *conn)
                .await?;
        }

        // 4️⃣ メイン処理(SQL)
        let sql = include_str!("../sql/collect/process_sync_db.sql");
        execute_queries(&mut *conn, sql).await?;

        // 5️⃣ 重複ファイルをゴミ箱に
        let rows: Vec<String> = sqlx::query_scalar("SELECT path FROM tmp_to_trash")
            .fetch_all(&mut *tx)
            .await?;

        for p in rows {
            let path = PathBuf::from(p);
            if path.exists() {
                trash::delete(&path)?;
            }
        }

        // 6️⃣ 結果を返却
        let sql = "SELECT illust_id, suffix, path FROM tmp_missing_files";

        missing_files = sqlx::query_as::<_, FileSummary>(sql)
            .fetch_all(&mut *tx)
            .await?;

        // 管理番号を更新
        update_cnum(&mut *tx).await?;
    }

    tx.commit().await?;

    Ok(missing_files)
}
