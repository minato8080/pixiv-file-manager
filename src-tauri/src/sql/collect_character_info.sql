WITH root_value AS (
    SELECT root FROM DB_INFO LIMIT 1
),
work_with_path AS (
    SELECT
        CU.character,
        CU.series,
        CASE
            WHEN R.root IS NULL THEN NULL
            WHEN CU.series = '-' THEN R.root || '\' || CU.character
            WHEN CU.character = '-' THEN R.root || '\' || CI.series
            ELSE R.root || '\' || CU.series || '\' || CU.character
        END AS collect_dir
    FROM COLLECT_UI_WORK CU
    CROSS JOIN root_value R
)
INSERT OR REPLACE INTO CHARACTER_INFO (character, series, collect_dir)
SELECT
    character,
    series,
    collect_dir
FROM work_with_path;
