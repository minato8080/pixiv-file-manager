-- キャラクターごとのイラスト数を集計
DROP TABLE IF EXISTS temp.character_illust_counts;
CREATE TEMP TABLE character_illust_counts AS
SELECT
  CF.character,
  CF.collect_type,
  COUNT(DISTINCT I.illust_id || '-' || I.suffix) AS cnt
FROM COLLECT_FILTER_WORK CF
JOIN ILLUST_INFO I
  ON CF.illust_id = I.illust_id AND CF.control_num = I.control_num
WHERE collect_type = 2
GROUP BY CF.character;

CREATE INDEX IF NOT EXISTS idx_character_illust_counts
  ON character_illust_counts(character);


-- シリーズごとのイラスト数を集計
DROP TABLE IF EXISTS temp.series_illust_counts;
CREATE TEMP TABLE series_illust_counts AS
SELECT
  CF.series,
  CF.collect_type,
  COUNT(DISTINCT I.illust_id || '-' || I.suffix) AS cnt
FROM COLLECT_FILTER_WORK CF
JOIN ILLUST_INFO I
  ON CF.illust_id = I.illust_id AND CF.control_num = I.control_num
WHERE collect_type = 1
GROUP BY CF.series;

CREATE INDEX IF NOT EXISTS idx_series_illust
  ON series_illust_counts(series);

-- キャラクターの after_count を更新
UPDATE COLLECT_UI_WORK
SET after_count = (
  SELECT cnt FROM character_illust_counts V WHERE V.character = COLLECT_UI_WORK.character
)
WHERE character IN (SELECT character FROM character_illust_counts) AND collect_type = 2;

-- シリーズの after_count を更新
UPDATE COLLECT_UI_WORK
SET after_count = (
  SELECT cnt FROM series_illust_counts V WHERE V.series = COLLECT_UI_WORK.series
)
WHERE series IN (SELECT series FROM series_illust_counts) AND collect_type = 1;

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