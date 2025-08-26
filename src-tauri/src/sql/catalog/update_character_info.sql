-- 1. character 未登録なら INSERT
INSERT INTO CHARACTER_INFO (series, character, collect_dir)
SELECT DISTINCT COALESCE(D.series, '-') AS series, :character, :collect
FROM ILLUST_DETAIL D
JOIN tmp_label_target lt ON D.illust_id = lt.illust_id
WHERE NOT EXISTS (
    SELECT 1 FROM CHARACTER_INFO C WHERE C.character = :character
);

-- 2. character 登録済み & 新しい collect_dir が Some & 既存が NULL なら UPDATE
UPDATE CHARACTER_INFO
SET collect_dir = :collect
WHERE character = :character
  AND collect_dir IS NULL
  AND :collect IS NOT NULL;
