-- cnum を取得して tmp_illust_pkeys に保存
DROP TABLE IF EXISTS tmp_illust_pkeys;
CREATE TEMP TABLE tmp_illust_pkeys AS
SELECT I.illust_id, I.suffix, I.cnum
FROM ILLUST_INFO I
JOIN tmp_target_files tf ON I.illust_id = tf.illust_id AND I.suffix = tf.suffix;

-- 関連ファイルを tmp_associated_files に取得
DROP TABLE IF EXISTS tmp_associated_files;
CREATE TEMP TABLE tmp_associated_files AS
SELECT I.illust_id || '_p' || I.suffix || '.' || I.extension AS key,
       COALESCE(D.character, 'None') AS character,
       I.save_dir
FROM ILLUST_INFO I
JOIN tmp_illust_pkeys ip 
  ON I.illust_id = ip.illust_id
 AND I.cnum = ip.cnum
LEFT JOIN ILLUST_DETAIL D 
  ON I.illust_id = D.illust_id 
 AND I.cnum = D.cnum
WHERE NOT EXISTS (
    SELECT 1
    FROM tmp_target_files tf
    WHERE tf.illust_id = I.illust_id 
      AND tf.suffix = I.suffix
);


-- character ごとの集計
SELECT character, COUNT(DISTINCT key) AS count
FROM tmp_associated_files
GROUP BY character;

-- save_dir ごとの集計
SELECT save_dir, COUNT(DISTINCT key) AS count
FROM tmp_associated_files
GROUP BY save_dir;