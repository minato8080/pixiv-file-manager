-- 有効シリーズを抽出
DROP TABLE IF EXISTS temp.valid_series;
CREATE TEMP TABLE valid_series AS
SELECT
    D.illust_id,
    D.cnum,
    CU.series,
    CU.character,
    CU.collect_dir
FROM COLLECT_UI_WORK CU
JOIN TAG_INFO T
    ON T.tag = CU.series
JOIN ILLUST_DETAIL D
    ON D.illust_id = T.illust_id AND D.cnum = T.cnum
WHERE NOT EXISTS (
    SELECT 1
    FROM COLLECT_UI_WORK C2
    WHERE C2.character = CU.series
);
CREATE INDEX idx_valid_series_ic ON valid_series(illust_id, cnum);

-- 1シリーズだけの illust/cnum を事前抽出
DROP TABLE IF EXISTS temp.single_series_illusts;
CREATE TEMP TABLE single_series_illusts AS
SELECT illust_id, cnum
FROM valid_series
GROUP BY illust_id, cnum
HAVING COUNT(DISTINCT series) = 1;
CREATE INDEX idx_single_series_illusts_ic ON single_series_illusts(illust_id, cnum);

WITH min_suffix AS (
  SELECT illust_id, cnum, MIN(suffix) AS suffix, save_dir
  FROM ILLUST_INFO
  GROUP BY illust_id, cnum
)
INSERT INTO COLLECT_FILTER_WORK (
  illust_id,
  cnum,
  series,
  character,
  save_dir,
  collect_dir,
  collect_type
)
SELECT
  V.illust_id,
  V.cnum,
  V.series,
  V.character,
  MS.save_dir,
  V.collect_dir,
  1
FROM valid_series V
JOIN single_series_illusts SC
  ON V.illust_id = SC.illust_id AND V.cnum = SC.cnum
JOIN min_suffix MS
  ON MS.illust_id = V.illust_id AND MS.cnum = V.cnum
GROUP BY V.illust_id, V.cnum;

DELETE FROM COLLECT_FILTER_WORK
WHERE collect_type = 1
  AND EXISTS (
    SELECT 1
    FROM COLLECT_FILTER_WORK AS CF2
    WHERE CF2.illust_id = COLLECT_FILTER_WORK.illust_id
      AND CF2.cnum = COLLECT_FILTER_WORK.cnum
      AND CF2.collect_type = 2
  );