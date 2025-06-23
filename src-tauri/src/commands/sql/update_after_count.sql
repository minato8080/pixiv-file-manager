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

-- キャラクターごとのイラスト数を集計成
DROP TABLE IF EXISTS temp.character_illust_counts;
CREATE TEMP TABLE character_illust_counts AS
SELECT
  character,
  COUNT(DISTINCT illust_id || '-' || control_num) AS cnt
FROM unique_character_illusts
GROUP BY character;

-- COLLECT_WORK の after_count を更新
UPDATE COLLECT_WORK
SET after_count = (
  SELECT cnt FROM character_illust_counts V WHERE V.character = COLLECT_WORK.character
)
WHERE character IN (SELECT character FROM character_illust_counts);

-- 他キャラクターの after_count の合計を求める
WITH other_counts AS (
  SELECT SUM(after_count) AS total
  FROM COLLECT_WORK
  WHERE id > 0
)
-- id = -1 の after_count を更新（before_count から差し引く）
UPDATE COLLECT_WORK
SET after_count = before_count - (
  SELECT IFNULL(total, 0) FROM other_counts
)
WHERE id = -1;