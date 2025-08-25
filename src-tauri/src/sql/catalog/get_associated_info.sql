BEGIN TRANSACTION;

-- tmp_source_files に対象ファイルを登録
DROP TABLE IF EXISTS tmp_source_files;
CREATE TEMP TABLE tmp_source_files (illust_id INTEGER, suffix INTEGER);

INSERT INTO tmp_source_files (illust_id, suffix)
VALUES {{VALUES_PLACEHOLDER}};

-- cnum を取得して tmp_files に保存
DROP TABLE IF EXISTS tmp_files;
CREATE TEMP TABLE tmp_files AS
SELECT I.illust_id, I.suffix, I.cnum
FROM ILLUST_INFO I
JOIN tmp_source_files S ON I.illust_id = S.illust_id AND I.suffix = S.suffix;

-- 関連ファイルを tmp_associated に取得
DROP TABLE IF EXISTS tmp_associated;
CREATE TEMP TABLE tmp_associated AS
SELECT I.illust_id || '_p' || I.suffix || '.' || I.extension AS key,
       COALESCE(D.character, 'None') AS character,
       I.save_dir
FROM ILLUST_INFO I
JOIN tmp_files F 
  ON I.illust_id = F.illust_id
 AND I.cnum = F.cnum
LEFT JOIN ILLUST_DETAIL D 
  ON I.illust_id = D.illust_id 
 AND I.cnum = D.cnum
WHERE NOT EXISTS (
    SELECT 1
    FROM tmp_source_files S
    WHERE S.illust_id = I.illust_id 
      AND S.suffix = I.suffix
);


-- character ごとの集計
SELECT character, COUNT(DISTINCT key) AS count
FROM tmp_associated
GROUP BY character;

-- save_dir ごとの集計
SELECT save_dir, COUNT(DISTINCT key) AS count
FROM tmp_associated
GROUP BY save_dir;

COMMIT;