-- 有効なキャラクター×タグの紐付けテーブルの作成
DROP TABLE IF EXISTS temp.valid_character_tags;
CREATE TEMP TABLE valid_character_tags AS
SELECT
  D.illust_id,
  D.control_num,
  C.character
FROM COLLECT_WORK C
JOIN TAG_INFO T ON T.tag = C.character
JOIN ILLUST_DETAIL D ON D.illust_id = T.illust_id AND D.control_num = T.control_num;

-- 候補キャラクターが複数存在するイラストの除外成
DROP TABLE IF EXISTS temp.unique_character_illusts;
CREATE TEMP TABLE unique_character_illusts AS
SELECT
  illust_id,
  control_num,
  character
FROM valid_character_tags
GROUP BY illust_id, control_num
HAVING COUNT(*) = 1;

UPDATE ILLUST_DETAIL
SET character = (
  SELECT U.character
  FROM unique_character_illusts U
  WHERE U.illust_id = ILLUST_DETAIL.illust_id AND U.control_num = ILLUST_DETAIL.control_num
)
WHERE EXISTS (
  SELECT 1 FROM unique_character_illusts U
  WHERE U.illust_id = ILLUST_DETAIL.illust_id AND U.control_num = ILLUST_DETAIL.control_num
);

