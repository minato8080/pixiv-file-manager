-- truncate COLLECT_UI_WORK
DELETE FROM COLLECT_UI_WORK;

-- キャラクター単位で件数集計し、COLLECT_UI_WORKへ挿入
WITH root_value AS (
    SELECT root FROM DB_INFO LIMIT 1
),
character_summary AS (
    SELECT 
        ROW_NUMBER() OVER (ORDER BY C.series, C.character) AS row_num,
        C.series,
        C.character,
        CASE
            WHEN R.root IS NULL THEN NULL
            WHEN C.series = '-' THEN R.root || '\' || C.character
            WHEN C.character = '-' THEN R.root || '\' || C.series
            ELSE R.root || '\' || C.series || '\' || C.character
        END AS new_path,
        CASE
            WHEN C.character = '-' THEN 1
            ELSE 2
        END AS collect_type,
        COUNT(I.illust_id) AS count
    FROM CHARACTER_INFO C
    CROSS JOIN root_value R
    LEFT JOIN ILLUST_DETAIL D ON C.character = D.character
    LEFT JOIN ILLUST_INFO I 
        ON I.illust_id = D.illust_id
        AND I.save_dir = (
            CASE
                WHEN R.root IS NULL THEN NULL
                WHEN C.series = '-' THEN R.root || '\' || C.character
                WHEN C.character = '-' THEN R.root || '\' || C.series
                ELSE R.root || '\' || C.series || '\' || C.character
            END
        )
    GROUP BY C.series, C.character
    ORDER BY C.series, C.character
)
INSERT INTO COLLECT_UI_WORK (
    id, series, character, collect_dir, before_count, after_count, unsave, collect_type
)
SELECT
    row_num,
    series,
    character,
    new_path,
    count,
    0,
    0,
    collect_type
FROM character_summary;

-- シリーズの事前カウント
WITH root_value AS (
  SELECT root FROM DB_INFO LIMIT 1
),
series_paths AS (
  SELECT
    CI.series,
    (RV.root || '\' || CI.series) AS save_path
  FROM CHARACTER_INFO CI
  JOIN root_value RV
  WHERE CI.character = '-'
),
series_counts AS (
  SELECT
    SP.series,
    COUNT(DISTINCT I.illust_id || '-' || I.suffix) AS count
  FROM series_paths SP
  JOIN ILLUST_INFO I ON I.save_dir = SP.save_path
  GROUP BY SP.series
)
UPDATE COLLECT_UI_WORK
SET before_count = (
  SELECT count FROM series_counts SC WHERE SC.series = COLLECT_UI_WORK.series
)
WHERE character = '-' AND series IN (SELECT series FROM series_counts);

-- 未割り当て件数の集計と挿入
INSERT INTO COLLECT_UI_WORK (
    id, series, character, collect_dir, before_count, after_count, unsave, collect_type
)
SELECT
    -1,
    '-',
    '-',
    NULL,
    (I.total_illust_count - COALESCE(T.total_after_count, 0)),
    0,
    0,
    0
FROM (
    SELECT SUM(after_count) AS total_after_count
    FROM COLLECT_UI_WORK
) T,
(
    SELECT COUNT(DISTINCT illust_id || '-' || suffix) AS total_illust_count
    FROM ILLUST_INFO
) I;
