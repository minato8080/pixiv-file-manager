-- (A) 消失したファイル
DROP TABLE IF EXISTS tmp_missing_files;
CREATE TEMP TABLE tmp_missing_files AS
SELECT I.illust_id, I.suffix, I.save_dir,
       I.save_dir || '\' || I.illust_id || '_p' || I.suffix || '.' || I.extension AS path
FROM ILLUST_INFO I
LEFT JOIN SYNC_DB_WORK SW
  ON I.illust_id = SW.illust_id AND I.suffix = SW.suffix
WHERE SW.rowid IS NULL;

-- (B) 移動したファイル
DROP TABLE IF EXISTS tmp_moved_files;
CREATE TEMP TABLE tmp_moved_files AS
SELECT I.illust_id, I.suffix, SW.save_dir AS actual_save_dir,
       I.save_dir || '\' || I.illust_id || '_p' || I.suffix || '.' || I.extension AS old_path,
       SW.save_dir || '\' || I.illust_id || '_p' || I.suffix || '.' || I.extension AS new_path
FROM ILLUST_INFO I
JOIN SYNC_DB_WORK SW
  ON I.illust_id = SW.illust_id AND I.suffix = SW.suffix
WHERE IFNULL(I.save_dir,'') <> IFNULL(SW.save_dir,'');

-- ILLUST_INFO の更新は移動ケースのみ
UPDATE ILLUST_INFO
SET save_dir = (
    SELECT mf.actual_save_dir
    FROM tmp_moved_files mf
    WHERE mf.illust_id = ILLUST_INFO.illust_id
      AND mf.suffix    = ILLUST_INFO.suffix
)
WHERE EXISTS (
    SELECT 1
    FROM tmp_moved_files mf
    WHERE mf.illust_id = ILLUST_INFO.illust_id
      AND mf.suffix    = ILLUST_INFO.suffix
);

-- 5) in_db を更新
UPDATE SYNC_DB_WORK
SET in_db = 1
WHERE EXISTS (
    SELECT 1
    FROM ILLUST_INFO I
    WHERE I.illust_id = SYNC_DB_WORK.illust_id
      AND I.suffix    = SYNC_DB_WORK.suffix
      AND I.save_dir  = SYNC_DB_WORK.save_dir
);


-- 6) 重複ファイルをゴミ箱へ
DROP TABLE IF EXISTS tmp_to_trash;
CREATE TEMP TABLE tmp_to_trash AS
WITH ranked AS (
    SELECT *,
           ROW_NUMBER() OVER (
               PARTITION BY illust_id, suffix 
               ORDER BY in_db DESC
           ) AS row_num
    FROM SYNC_DB_WORK
)
SELECT path
FROM ranked
WHERE row_num > 1;
