WITH root_value AS (
    SELECT value as root FROM COMMON_MST WHERE key = :collect_root
),
work_with_path AS (
    SELECT
        CU.character,
        CU.series,
        CASE
            WHEN rv.root IS NULL THEN NULL
            WHEN CU.series = '-' THEN rv.root || '\' || CU.character
            WHEN CU.character = '-' THEN rv.root || '\' || CU.series
            ELSE rv.root || '\' || CU.series || '\' || CU.character
        END AS collect_dir
    FROM COLLECT_UI_WORK CU
    CROSS JOIN root_value rv
)
INSERT OR REPLACE INTO CHARACTER_INFO (character, series, collect_dir)
SELECT
    character,
    series,
    collect_dir
FROM work_with_path;
