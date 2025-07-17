-- キャラクターごとのイラスト数を集計成
DROP TABLE IF EXISTS temp.character_illust_counts;
CREATE TEMP TABLE character_illust_counts AS
SELECT
  CF.character,
  COUNT(DISTINCT I.illust_id || '-' || I.suffix) AS cnt
FROM COLLECT_FILTER_WORK CF
JOIN ILLUST_INFO I
  ON CF.illust_id = I.illust_id
-- control_numはマッチしている前提なので、suffix単位で数える
GROUP BY CF.character;

-- COLLECT_UI_WORK の after_count を更新
UPDATE COLLECT_UI_WORK
SET after_count = (
  SELECT cnt FROM character_illust_counts V WHERE V.character = COLLECT_UI_WORK.character
)
WHERE character IN (SELECT character FROM character_illust_counts);

-- id = -1 の after_count を更新
UPDATE COLLECT_UI_WORK
SET after_count = (
  SELECT
    IFNULL(SUM(before_count), 0) -
    IFNULL((
      SELECT SUM(after_count)
      FROM COLLECT_UI_WORK
      WHERE id > 0
    ), 0)
  FROM COLLECT_UI_WORK
)
WHERE id = -1;