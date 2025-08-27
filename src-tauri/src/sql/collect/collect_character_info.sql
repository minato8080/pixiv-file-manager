DELETE FROM CHARACTER_INFO
WHERE entity_key IN (
    SELECT C.entity_key
    FROM CHARACTER_INFO C
    JOIN COLLECT_UI_WORK CU
      ON C.entity_key = CU.entity_key
    WHERE CU.collect_type = 3
);

WITH root_value AS (
    SELECT value AS root FROM COMMON_MST WHERE key = :collect_root
),
work_with_path AS (
    SELECT
        COALESCE(CU.character, CU.series) AS entity_key,
        CU.character,
        CU.series,
        CASE
            WHEN rv.root IS NULL THEN NULL
            WHEN CU.series IS NULL THEN rv.root || '\' || CU.character
            WHEN CU.character IS NULL THEN rv.root || '\' || CU.series
            ELSE rv.root || '\' || CU.series || '\' || CU.character
        END AS collect_dir
    FROM COLLECT_UI_WORK CU
    CROSS JOIN root_value rv
    WHERE CU.character IS NOT NULL OR CU.series IS NOT NULL AND collect_type <> 3
)
INSERT OR REPLACE INTO CHARACTER_INFO (entity_key, character, series, collect_dir)
SELECT
    entity_key,
    character,
    series,
    collect_dir
FROM work_with_path;
