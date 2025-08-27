-- キーを決定
DROP VIEW IF EXISTS key_val;
CREATE TEMP VIEW key_val AS
SELECT
    COALESCE(:character, series) AS entity_key
FROM ILLUST_DETAIL D
JOIN tmp_label_target lt ON D.illust_id = lt.illust_id
LIMIT 1;

  -- 1. character 未登録なら INSERT
INSERT INTO CHARACTER_INFO (entity_key, series, character, collect_dir)
SELECT kv.entity_key, D.series, :character, :collect
FROM key_val kv
JOIN ILLUST_DETAIL D ON 1=1
JOIN tmp_label_target lt ON D.illust_id = lt.illust_id
WHERE NOT EXISTS (
    SELECT 1 FROM CHARACTER_INFO C WHERE C.entity_key = kv.entity_key
);

-- 2. character 登録済み & 新しい collect_dir が Some & 既存が NULL なら UPDATE
UPDATE CHARACTER_INFO
SET collect_dir = :collect
WHERE entity_key = (SELECT entity_key FROM key_val)
  AND collect_dir IS NULL
  AND :collect IS NOT NULL;