WITH root_value AS (
    SELECT root FROM DB_INFO LIMIT 1
),
work_with_path AS (
    SELECT
        CW.character,
        CW.series,
        CASE
            WHEN R.root IS NULL THEN NULL
            WHEN CW.series IS NULL THEN R.root || '\' || CW.character
            ELSE R.root || '\' || CW.series || '\' || CW.character
        END AS collect_dir
    FROM COLLECT_WORK CW
    CROSS JOIN root_value R
)
INSERT OR REPLACE INTO CHARACTER_INFO (character, series, collect_dir)
SELECT
    character,
    series,
    collect_dir
FROM work_with_path;
