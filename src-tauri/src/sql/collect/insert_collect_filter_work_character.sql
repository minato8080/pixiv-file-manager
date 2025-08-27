-- 有効キャラクターを抽出
DROP TABLE IF EXISTS tmp_valid_characters;
CREATE TEMP TABLE tmp_valid_characters AS
SELECT
    D.illust_id,
    D.cnum,
    CU.entity_key,
    CU.series,
    CU.character,
    CU.collect_dir
FROM COLLECT_UI_WORK CU
JOIN TAG_INFO T
    ON T.tag = CU.character
JOIN ILLUST_DETAIL D
    ON D.illust_id = T.illust_id AND D.cnum = T.cnum
WHERE collect_type <> 3;
CREATE INDEX idx_valid_characters_ic ON tmp_valid_characters(illust_id, cnum);

-- 1キャラだけの illust/cnum を事前抽出
DROP TABLE IF EXISTS tmp_single_character_illusts;
CREATE TEMP TABLE tmp_single_character_illusts AS
SELECT illust_id, cnum
FROM tmp_valid_characters
GROUP BY illust_id, cnum
HAVING COUNT(DISTINCT character) = 1;
CREATE INDEX idx_single_character_illusts_ic ON tmp_single_character_illusts(illust_id, cnum);

-- 候補キャラクターが複数存在するイラストの除外
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
  vc.illust_id,
  vc.cnum,
  vc.entity_key,
  vc.series,
  vc.character,
  ms.save_dir,
  vc.collect_dir,
  2
FROM tmp_valid_characters vc
JOIN tmp_single_character_illusts sci
  ON vc.illust_id = sci.illust_id AND vc.cnum = sci.cnum
JOIN min_suffix ms
  ON ms.illust_id = vc.illust_id AND ms.cnum = vc.cnum
GROUP BY vc.illust_id, vc.cnum;