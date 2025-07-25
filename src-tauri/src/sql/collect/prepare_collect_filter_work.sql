-- 一時テーブルの削除
DROP TABLE IF EXISTS temp.valid_characters;

-- 一時テーブルの作成
CREATE TEMP TABLE valid_characters AS
SELECT
    D.illust_id,
    D.control_num,
    CU.series,
    CU.character,
    CU.collect_dir
FROM COLLECT_UI_WORK CU
JOIN TAG_INFO T
    ON T.tag = CU.character
JOIN ILLUST_DETAIL D
    ON D.illust_id = T.illust_id AND D.control_num = T.control_num;

-- 候補キャラクターが複数存在するイラストの除外
DELETE FROM COLLECT_FILTER_WORK;

WITH ranked AS (
  SELECT
    V.illust_id,
    V.control_num,
    V.series,
    V.character,
    I.save_dir,
    V.collect_dir,
    ROW_NUMBER() OVER (
      PARTITION BY V.illust_id, V.control_num
      ORDER BY V.character
    ) AS row_num
  FROM valid_characters V
  JOIN ILLUST_INFO I
    ON I.illust_id = V.illust_id AND I.control_num = V.control_num
  WHERE (V.illust_id, V.control_num) IN (
    SELECT illust_id, control_num
    FROM valid_characters
    GROUP BY illust_id, control_num
    HAVING COUNT(DISTINCT character) = 1
  )
)
INSERT INTO COLLECT_FILTER_WORK (
  illust_id,
  control_num,
  series,
  character,
  save_dir,
  collect_dir,
  collect_type
)
SELECT
  illust_id,
  control_num,
  series,
  character,
  save_dir,
  collect_dir,
  2
FROM ranked
WHERE row_num = 1;

DROP TABLE IF EXISTS temp.valid_series;

-- 一時テーブルの作成
CREATE TEMP TABLE valid_series AS
-- 通常のシリーズ（'-'以外）
SELECT
    D.illust_id,
    D.control_num,
    CU.series,
    CU.character,
    CU.collect_dir
FROM COLLECT_UI_WORK CU
JOIN TAG_INFO T
    ON T.tag = CU.series
JOIN ILLUST_DETAIL D
    ON D.illust_id = T.illust_id AND D.control_num = T.control_num
WHERE NOT EXISTS (
    SELECT 1
    FROM COLLECT_UI_WORK C2
    WHERE C2.character = CU.series
);

WITH ranked AS (
  SELECT
    V.illust_id,
    V.control_num,
    V.series,
    V.character,
    I.save_dir,
    V.collect_dir,
    ROW_NUMBER() OVER (
      PARTITION BY V.illust_id, V.control_num
      ORDER BY V.series
    ) AS row_num
  FROM valid_series V
  JOIN ILLUST_INFO I
    ON I.illust_id = V.illust_id AND I.control_num = V.control_num
  WHERE (V.illust_id, V.control_num) IN (
    SELECT illust_id, control_num
    FROM valid_series
    GROUP BY illust_id, control_num
    HAVING COUNT(DISTINCT series) = 1
  )
)
INSERT INTO COLLECT_FILTER_WORK (
  illust_id,
  control_num,
  series,
  character,
  save_dir,
  collect_dir,
  collect_type
)
SELECT
  illust_id,
  control_num,
  series,
  character,
  save_dir,
  collect_dir,
  1
FROM ranked
WHERE row_num = 1;

DELETE FROM COLLECT_FILTER_WORK
WHERE collect_type = 1
  AND EXISTS (
    SELECT 1
    FROM COLLECT_FILTER_WORK AS CF2
    WHERE CF2.illust_id = COLLECT_FILTER_WORK.illust_id
      AND CF2.control_num = COLLECT_FILTER_WORK.control_num
      AND CF2.collect_type = 2
  );