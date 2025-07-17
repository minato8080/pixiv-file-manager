-- 一時テーブルの削除
DROP TABLE IF EXISTS temp.valid_character_tags;

-- 一時テーブルの作成
CREATE TEMP TABLE valid_character_tags AS
SELECT
    D.illust_id,
    D.control_num,
    CU.character,
    CU.collect_dir
FROM COLLECT_UI_WORK CU
JOIN TAG_INFO T
    ON T.tag = CU.character
JOIN ILLUST_DETAIL D
    ON D.illust_id = T.illust_id AND D.control_num = T.control_num;

-- 候補キャラクターが複数存在するイラストの除外
DELETE FROM COLLECT_FILTER_WORK;

INSERT INTO COLLECT_FILTER_WORK (
    illust_id,
    control_num,
    character,
    save_dir,
    collect_dir
)
SELECT
    V.illust_id,
    V.control_num,
    V.character,
    I.save_dir,
    V.collect_dir
FROM valid_character_tags V
JOIN ILLUST_INFO I
    ON I.illust_id = V.illust_id AND I.control_num = V.control_num
GROUP BY
    V.illust_id,
    V.control_num
HAVING COUNT(*) = 1;