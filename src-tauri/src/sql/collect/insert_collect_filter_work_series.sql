WITH valid_series AS (
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
      ON D.illust_id = T.illust_id
     AND D.cnum     = T.cnum
    WHERE CU.collect_type <> 3
      AND NOT EXISTS (
          SELECT 1
          FROM COLLECT_UI_WORK C2
          WHERE C2.character = CU.series
      )
),
series_count AS (
    SELECT illust_id, cnum, COUNT(DISTINCT series) AS series_cnt
    FROM valid_series
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
    vs.illust_id,
    vs.cnum,
    CASE WHEN sc.series_cnt = 1 THEN vs.series ELSE NULL END AS series,
    NULL,
    CASE WHEN sc.series_cnt = 1 THEN vs.collect_dir ELSE ud.dir END AS collect_dir,
    CASE WHEN sc.series_cnt = 1 THEN 1 ELSE 4 END AS collect_type
FROM valid_series vs
JOIN series_count sc
  ON vs.illust_id = sc.illust_id
 AND vs.cnum     = sc.cnum
CROSS JOIN uncategorized_dir ud
WHERE sc.series_cnt = 1
GROUP BY vs.illust_id, vs.cnum;