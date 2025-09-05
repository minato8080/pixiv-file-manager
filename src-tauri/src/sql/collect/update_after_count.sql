-- キャラクターごとのイラスト数を集計
DROP TABLE IF EXISTS tmp_cnt_per_character;
CREATE TEMP TABLE tmp_cnt_per_character AS
SELECT
  CF.character,
  CF.collect_type,
  COUNT(DISTINCT I.illust_id || '-' || I.suffix) AS cnt
FROM COLLECT_FILTER_WORK CF
JOIN ILLUST_INFO I
  ON CF.illust_id = I.illust_id AND CF.cnum = I.cnum
WHERE collect_type = 2
GROUP BY CF.character;

CREATE INDEX IF NOT EXISTS idx_character_illust_counts
  ON tmp_cnt_per_character(character);
  
-- シリーズごとのイラスト数を集計
DROP TABLE IF EXISTS tmp_cnt_per_series;
CREATE TEMP TABLE tmp_cnt_per_series AS
SELECT
  CF.series,
  CF.collect_type,
  COUNT(DISTINCT I.illust_id || '-' || I.suffix) AS cnt
FROM COLLECT_FILTER_WORK CF
JOIN ILLUST_INFO I
  ON CF.illust_id = I.illust_id AND CF.cnum = I.cnum
WHERE collect_type = 1
GROUP BY CF.series;

CREATE INDEX IF NOT EXISTS idx_series_illust
  ON tmp_cnt_per_series(series);

-- キャラクターの after_count を更新
UPDATE COLLECT_UI_WORK
SET after_count = COALESCE((
  SELECT cpc.cnt
  FROM tmp_cnt_per_character cpc
  WHERE cpc.character = COLLECT_UI_WORK.character
  LIMIT 1
), 0)
WHERE collect_type = 2;

-- シリーズ
UPDATE COLLECT_UI_WORK
SET after_count = COALESCE((
  SELECT cps.cnt
  FROM tmp_cnt_per_series cps
  WHERE cps.series = COLLECT_UI_WORK.series
  LIMIT 1
), 0)
WHERE collect_type = 1;


-- Uncategorized の after_count を更新
UPDATE COLLECT_UI_WORK
SET after_count = (
  SELECT
    IFNULL(SUM(before_count), 0) -
    IFNULL((
      SELECT SUM(after_count)
      FROM COLLECT_UI_WORK
      WHERE collect_type > 0
    ), 0)
  FROM COLLECT_UI_WORK
)
WHERE collect_type = 0;