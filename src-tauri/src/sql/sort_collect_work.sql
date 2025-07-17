WITH sorted AS (
    SELECT
        character,
        ROW_NUMBER() OVER (ORDER BY series IS NULL, series, character) AS new_id
    FROM COLLECT_UI_WORK
    WHERE id > 0
)
UPDATE COLLECT_UI_WORK
SET id = (
    SELECT new_id FROM sorted WHERE sorted.character = COLLECT_UI_WORK.character
)
WHERE character IN (SELECT character FROM sorted);
