-- (A) 消失したファイル
DROP TABLE IF EXISTS MISSING_FILES;
CREATE TEMP TABLE MISSING_FILES AS
SELECT I.illust_id, I.suffix, I.save_dir,
       I.save_dir || '/' || I.illust_id || '_p' || I.suffix || '.' || I.extension AS path
FROM ILLUST_INFO I
LEFT JOIN SYNC_DB_WORK SW
  ON I.illust_id = SW.illust_id AND I.suffix = SW.suffix
WHERE SW.rowid IS NULL;

-- (B) 移動したファイル
DROP TABLE IF EXISTS MOVED_FILES;
CREATE TEMP TABLE MOVED_FILES AS
SELECT I.illust_id, I.suffix, SW.save_dir AS actual_save_dir,
       I.save_dir || '/' || I.illust_id || '_p' || I.suffix || '.' || I.extension AS old_path,
       SW.save_dir || '/' || I.illust_id || '_p' || I.suffix || '.' || I.extension AS new_path
FROM ILLUST_INFO I
JOIN SYNC_DB_WORK SW
  ON I.illust_id = SW.illust_id AND I.suffix = SW.suffix
WHERE IFNULL(I.save_dir,'') <> IFNULL(SW.save_dir,'');

-- ILLUST_INFO の更新は移動ケースのみ
UPDATE ILLUST_INFO
SET save_dir = (
    SELECT M.actual_save_dir
    FROM MOVED_FILES M
    WHERE M.illust_id = ILLUST_INFO.illust_id
      AND M.suffix    = ILLUST_INFO.suffix
)
WHERE EXISTS (
    SELECT 1
    FROM MOVED_FILES M
    WHERE M.illust_id = ILLUST_INFO.illust_id
      AND M.suffix    = ILLUST_INFO.suffix
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
DROP TABLE IF EXISTS TEMP_TO_TRASH;
CREATE TEMP TABLE TEMP_TO_TRASH AS
WITH ranked AS (
    SELECT *,
           ROW_NUMBER() OVER (
               PARTITION BY illust_id, suffix 
               ORDER BY in_db DESC
           ) AS rn
    FROM SYNC_DB_WORK
)
SELECT path
FROM ranked
WHERE rn > 1;
