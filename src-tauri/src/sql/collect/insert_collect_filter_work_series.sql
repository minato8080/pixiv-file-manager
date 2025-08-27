-- 有効シリーズを抽出
DROP TABLE IF EXISTS tmp_valid_series;
CREATE TEMP TABLE tmp_valid_series AS
SELECT
    D.illust_id,
    D.cnum,
    CU.entity_key,
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
) AND collect_type <> 3;
CREATE INDEX idx_valid_series_ic ON tmp_valid_series(illust_id, cnum);

-- 1シリーズだけの illust/cnum を事前抽出
DROP TABLE IF EXISTS tmp_single_series_illusts;
CREATE TEMP TABLE tmp_single_series_illusts AS
SELECT illust_id, cnum
FROM tmp_valid_series
GROUP BY illust_id, cnum
HAVING COUNT(DISTINCT series) = 1;
CREATE INDEX idx_single_series_illusts_ic ON tmp_single_series_illusts(illust_id, cnum);

WITH min_suffix AS (
  SELECT illust_id, cnum, MIN(suffix) AS suffix, save_dir
  FROM ILLUST_INFO
  GROUP BY illust_id, cnum
)
INSERT INTO COLLECT_FILTER_WORK (
  illust_id,
  cnum,
  entity_key,
  series,
  character,
  save_dir,
  collect_dir,
  collect_type
)
SELECT
  vs.illust_id,
  vs.cnum,
  vs.entity_key,
  vs.series,
  vs.character,
  ms.save_dir,
  vs.collect_dir,
  1
FROM tmp_valid_series vs
JOIN tmp_single_series_illusts ssi
  ON vs.illust_id = ssi.illust_id AND vs.cnum = ssi.cnum
JOIN min_suffix ms
  ON ms.illust_id = vs.illust_id AND ms.cnum = vs.cnum
GROUP BY vs.illust_id, vs.cnum;

DELETE FROM COLLECT_FILTER_WORK
WHERE collect_type = 1
  AND EXISTS (
    SELECT 1
    FROM COLLECT_FILTER_WORK AS CF2
    WHERE CF2.illust_id = COLLECT_FILTER_WORK.illust_id
      AND CF2.cnum = COLLECT_FILTER_WORK.cnum
      AND CF2.collect_type = 2
  );