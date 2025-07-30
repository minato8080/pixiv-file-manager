-- 有効キャラクターを抽出
DROP TABLE IF EXISTS temp.valid_characters;
CREATE TEMP TABLE valid_characters AS
SELECT
    D.illust_id,
    D.control_num,
    CU.series,
    CU.character,
    CU.collect_dir
FROM COLLECT_UI_WORK CU
JOIN TAG_INFO T
    ON T.tag = CU.character
JOIN ILLUST_DETAIL D
    ON D.illust_id = T.illust_id AND D.control_num = T.control_num;
CREATE INDEX idx_valid_characters_ic ON valid_characters(illust_id, control_num);

-- 1キャラだけの illust/control_num を事前抽出
DROP TABLE IF EXISTS temp.single_character_illusts;
CREATE TEMP TABLE single_character_illusts AS
SELECT illust_id, control_num
FROM valid_characters
GROUP BY illust_id, control_num
HAVING COUNT(DISTINCT character) = 1;
CREATE INDEX idx_single_character_illusts_ic ON single_character_illusts(illust_id, control_num);

-- 候補キャラクターが複数存在するイラストの除外
WITH min_suffix AS (
  SELECT illust_id, control_num, MIN(suffix) AS suffix, save_dir
  FROM ILLUST_INFO
  GROUP BY illust_id, control_num
)
INSERT INTO COLLECT_FILTER_WORK (
  illust_id,
  control_num,
  series,
  character,
  save_dir,
  collect_dir,
  collect_type
)
SELECT
  V.illust_id,
  V.control_num,
  V.series,
  V.character,
  MS.save_dir,
  V.collect_dir,
  2
FROM valid_characters V
JOIN single_character_illusts SC
  ON V.illust_id = SC.illust_id AND V.control_num = SC.control_num
JOIN min_suffix MS
  ON MS.illust_id = V.illust_id AND MS.control_num = V.control_num
GROUP BY V.illust_id, V.control_num;