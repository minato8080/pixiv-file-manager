-- キーを決定
DROP TABLE IF EXISTS key_val;
CREATE TEMP TABLE key_val AS
SELECT
    COALESCE(:character, series) AS entity_key
FROM ILLUST_DETAIL D
JOIN tmp_label_target lt ON D.illust_id = lt.illust_id
LIMIT 1;

INSERT INTO CHARACTER_INFO (entity_key, series, character, collect_dir)
SELECT kv.entity_key, D.series, :character, :collect
FROM key_val kv
JOIN ILLUST_DETAIL D ON 1=1
JOIN tmp_label_target lt ON D.illust_id = lt.illust_id
ON CONFLICT(entity_key) DO UPDATE SET
    collect_dir = CASE
        WHEN CHARACTER_INFO.collect_dir IS NULL AND :collect IS NOT NULL THEN :collect
        ELSE CHARACTER_INFO.collect_dir
    END;
