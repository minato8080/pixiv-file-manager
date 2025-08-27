-- truncate COLLECT_UI_WORK
DELETE FROM COLLECT_UI_WORK;

-- キャラクター単位で件数集計し、COLLECT_UI_WORKへ挿入
WITH root_value AS (
    SELECT value as root FROM COMMON_MST WHERE key = :collect_root
),
character_summary AS (
    SELECT 
        ROW_NUMBER() OVER (ORDER BY C.series, C.character) AS row_num,
        C.entity_key,
        C.series,
        C.character,
        CASE
            WHEN rv.root IS NULL THEN NULL
            WHEN C.series IS NULL THEN rv.root || '\' || C.character
            WHEN C.character IS NULL THEN rv.root || '\' || C.series
            ELSE rv.root || '\' || C.series || '\' || C.character
        END AS new_path,
        CASE
            WHEN C.character IS NULL THEN 1
            ELSE 2
        END AS collect_type,
        COUNT(I.illust_id) AS count
    FROM CHARACTER_INFO C
    CROSS JOIN root_value rv
    LEFT JOIN ILLUST_DETAIL D ON C.character = D.character
    LEFT JOIN ILLUST_INFO I 
        ON I.illust_id = D.illust_id
        AND I.save_dir = (
            CASE
                WHEN rv.root IS NULL THEN NULL
                WHEN C.series IS NULL THEN rv.root || '\' || C.character
                WHEN C.character IS NULL THEN rv.root || '\' || C.series
                ELSE rv.root || '\' || C.series || '\' || C.character
            END
        )
    GROUP BY C.series, C.character
    ORDER BY C.series, C.character
)
INSERT OR IGNORE INTO COLLECT_UI_WORK (
    id, entity_key, series, character, collect_dir, before_count, collect_type
)
SELECT
    row_num,
    entity_key,
    series,
    character,
    new_path,
    count,
    collect_type
FROM character_summary;

-- シリーズの事前カウント
WITH root_value AS (
  SELECT value as root FROM COMMON_MST WHERE key = :collect_root
),
series_paths AS (
  SELECT
    C.series,
    (rv.root || '\' || C.series) AS save_path
  FROM CHARACTER_INFO C
  JOIN root_value rv
  WHERE C.character IS NULL
),
series_counts AS (
  SELECT
    sp.series,
    COUNT(DISTINCT I.illust_id || '-' || I.suffix) AS count
  FROM series_paths sp
  JOIN ILLUST_INFO I ON I.save_dir = sp.save_path
  GROUP BY sp.series
)
UPDATE COLLECT_UI_WORK
SET before_count = (
  SELECT count FROM series_counts sc WHERE sc.series = COLLECT_UI_WORK.series
)
WHERE character IS NULL AND series IN (SELECT series FROM series_counts);

-- 未割り当て件数の集計と挿入
INSERT OR IGNORE INTO COLLECT_UI_WORK (
    id, entity_key, series, character, collect_dir, before_count, collect_type
)
SELECT
    -1,
    '-',
    NULL,
    NULL,
    NULL,
    (I.total_illust_count - COALESCE(T.total_after_count, 0)),
    0
FROM (
    SELECT SUM(after_count) AS total_after_count
    FROM COLLECT_UI_WORK
) T,
(
    SELECT COUNT(DISTINCT illust_id || '-' || suffix) AS total_illust_count
    FROM ILLUST_INFO
) I;
