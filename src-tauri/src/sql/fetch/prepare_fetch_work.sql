-- 不要な TEMP テーブルがあれば削除
DROP TABLE IF EXISTS temp.insert_files;
DROP TABLE IF EXISTS temp.delete_files;
DROP TABLE IF EXISTS temp.fetch_ids;

-- 1. 優先度の高いファイルを抽出（suffixごとに1件だけ）
CREATE TEMP TABLE insert_files AS
SELECT *
FROM (
  SELECT *,
         ROW_NUMBER() OVER (
           PARTITION BY illust_id, suffix
           ORDER BY file_size ASC, created_time ASC
         ) AS rn
  FROM ILLUST_FETCH_WORK
) AS ranked
WHERE rn = 1;

-- 2. ILLUST_INFO（= 登録済み）と一致する (illust_id, suffix) を除外
DELETE FROM insert_files
WHERE (illust_id, suffix) IN (
  SELECT I.illust_id, I.suffix
  FROM ILLUST_INFO I
  JOIN ILLUST_DETAIL D ON I.illust_id = D.illust_id
  WHERE D.author_id != 0
);

-- 3. 削除対象を作成（insert対象以外すべて）
CREATE TEMP TABLE delete_files AS
SELECT save_dir || '\' || illust_id || '_p' || suffix || '.' || extension AS file_path
FROM ILLUST_FETCH_WORK
WHERE (illust_id, suffix) NOT IN (
  SELECT illust_id, suffix FROM insert_files
);

-- 4. フェッチ対象のIDを抽出（author_id != 0 の取得済みを除外）
CREATE TEMP TABLE fetch_ids AS
SELECT DISTINCT illust_id
FROM insert_files
WHERE illust_id NOT IN (
  SELECT illust_id FROM ILLUST_DETAIL WHERE author_id != 0
);
