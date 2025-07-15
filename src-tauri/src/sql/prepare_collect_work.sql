-- truncate COLLECT_WORK
DELETE FROM COLLECT_WORK;

-- キャラクター単位で件数集計し、COLLECT_WORKへ挿入
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
            WHEN C.series IS NULL THEN R.root || '\' || C.character
            ELSE R.root || '\' || C.series || '\' || C.character
        END AS new_path,
        COUNT(I.illust_id) AS count
    FROM CHARACTER_INFO C
    CROSS JOIN root_value R
    LEFT JOIN ILLUST_DETAIL D ON C.character = D.character
    LEFT JOIN ILLUST_INFO I 
        ON I.illust_id = D.illust_id
        AND I.save_dir = (
            CASE
                WHEN R.root IS NULL THEN NULL
                WHEN C.series IS NULL THEN R.root || '\' || C.character
                ELSE R.root || '\' || C.series || '\' || C.character
            END
        )
    GROUP BY C.series, C.character
    ORDER BY C.series, C.character
)
INSERT INTO COLLECT_WORK (
    id, series, character, collect_dir, before_count, after_count, unsave
)
SELECT
    row_num,
    series,
    character,
    new_path,
    count,
    count,
    0
FROM character_summary;

-- 未割り当て件数の集計と挿入
INSERT INTO COLLECT_WORK (
    id, series, character, collect_dir, before_count, after_count, unsave
)
SELECT
    -1,
    NULL,
    '',
    NULL,
    (I.total_illust_count - T.total_after_count),
    (I.total_illust_count - T.total_after_count),
    0
FROM (
    SELECT SUM(after_count) AS total_after_count
    FROM COLLECT_WORK
) T,
(
    SELECT COUNT(DISTINCT illust_id || '-' || suffix) AS total_illust_count
    FROM ILLUST_INFO
) I;
