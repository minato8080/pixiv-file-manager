WITH valid_characters AS (
    SELECT
        D.illust_id,
        D.cnum,
        CU.series,
        CU.character,
        CU.collect_dir
    FROM COLLECT_UI_WORK CU
    JOIN TAG_INFO T
        ON T.tag = CU.character
    JOIN ILLUST_DETAIL D
        ON D.illust_id = T.illust_id
       AND D.cnum     = T.cnum
    WHERE CU.collect_type <> 3
),
char_count AS (
    SELECT illust_id, cnum, COUNT(DISTINCT character) AS char_cnt
    FROM valid_characters
    GROUP BY illust_id, cnum
),
uncategorized_dir AS (
    SELECT value || :uncategorized_dir AS dir FROM COMMON_MST WHERE key = :collect_root
)
INSERT INTO COLLECT_FILTER_WORK (
    illust_id,
    cnum,
    series,
    character,
    collect_dir,
    collect_type
)
SELECT
    vc.illust_id,
    vc.cnum,
    CASE WHEN cc.char_cnt = 1 THEN vc.series     ELSE NULL END AS series,
    CASE WHEN cc.char_cnt = 1 THEN vc.character  ELSE NULL END AS character,
    CASE WHEN cc.char_cnt = 1 THEN vc.collect_dir ELSE ud.dir END AS collect_dir,
    CASE WHEN cc.char_cnt = 1 THEN 2 ELSE 4 END AS collect_type
FROM valid_characters vc
JOIN char_count cc
  ON vc.illust_id = cc.illust_id
 AND vc.cnum     = cc.cnum
CROSS JOIN uncategorized_dir ud
GROUP BY vc.illust_id, vc.cnum;