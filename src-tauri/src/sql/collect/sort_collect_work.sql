-- ① 一時テーブルを作る（またはCTEを使ってSELECT）
DROP TABLE IF EXISTS tmp_sorted;
CREATE TEMP TABLE tmp_sorted AS
SELECT
    entity_key,
    ROW_NUMBER() OVER (
        ORDER BY (series IS NULL) DESC, series, (character IS NULL) DESC, character
    ) AS new_id
FROM COLLECT_UI_WORK
WHERE collect_type > 0;

-- ② JOINしてUPDATEする
UPDATE COLLECT_UI_WORK
SET id = (
    SELECT new_id FROM tmp_sorted ts
    WHERE
        ts.entity_key = COLLECT_UI_WORK.entity_key
)
WHERE EXISTS (
    SELECT 1 FROM tmp_sorted ts
    WHERE
        ts.entity_key = COLLECT_UI_WORK.entity_key
);
