-- 1. 優先度の高いファイルを抽出（suffixごとに1件だけ）
DROP TABLE IF EXISTS tmp_insert_files;
CREATE TEMP TABLE tmp_insert_files AS
SELECT *
FROM (
  SELECT *,
         ROW_NUMBER() OVER (
           PARTITION BY illust_id, suffix
           ORDER BY file_size ASC, created_time ASC
         ) AS row_num
  FROM ILLUST_FETCH_WORK
) AS ranked
WHERE row_num = 1;

-- 2. ILLUST_INFO（= 登録済み）と一致する (illust_id, suffix) を除外
DELETE FROM tmp_insert_files
WHERE (illust_id, suffix) IN (
  SELECT I.illust_id, I.suffix
  FROM ILLUST_INFO I
  JOIN ILLUST_DETAIL D ON I.illust_id = D.illust_id
  WHERE D.author_id != 0
);

-- 3. 削除対象を作成
DROP TABLE IF EXISTS tmp_delete_files;
CREATE TEMP TABLE tmp_delete_files AS
WITH tmp AS (
    SELECT
        W.save_dir || '\' || W.illust_id || '_p' || W.suffix || '.' || W.extension AS file_path,
        I.save_dir || '\' || I.illust_id || '_p' || I.suffix || '.' || I.extension AS keep_file_path,
        W.illust_id,
        W.suffix,
        W.extension,
        W.save_dir
    FROM ILLUST_FETCH_WORK AS W
    LEFT JOIN tmp_insert_files AS I
           ON W.illust_id = I.illust_id
          AND W.suffix    = I.suffix
)
SELECT *
FROM tmp
WHERE keep_file_path IS NOT NULL
  AND file_path <> keep_file_path;

-- 4. フェッチ対象のIDを抽出（author_id = 0 の取得済みを除外）
DROP TABLE IF EXISTS tmp_fetch_ids;
CREATE TEMP TABLE tmp_fetch_ids AS
SELECT DISTINCT illust_id
FROM tmp_insert_files
WHERE illust_id NOT IN (
  SELECT illust_id FROM ILLUST_DETAIL WHERE author_id = 0
);
