-- ① 一時テーブルを作る（またはCTEを使ってSELECT）
DROP TABLE IF EXISTS tmp_sorted;
CREATE TEMP TABLE tmp_sorted AS
SELECT
    character,
    series,
    ROW_NUMBER() OVER (
        ORDER BY (series = '-') DESC, series, (character = '-') DESC, character
    ) AS new_id
FROM COLLECT_UI_WORK
WHERE id >= 0;

-- ② JOINしてUPDATEする
UPDATE COLLECT_UI_WORK
SET id = (
    SELECT new_id FROM tmp_sorted ts
    WHERE
        ts.series = COLLECT_UI_WORK.series AND
        ts.character = COLLECT_UI_WORK.character
)
WHERE EXISTS (
    SELECT 1 FROM tmp_sorted ts
    WHERE
        ts.series = COLLECT_UI_WORK.series AND
        ts.character = COLLECT_UI_WORK.character
);
