WITH filtered_illusts AS (
    SELECT illust_id, cnum
    FROM TAG_INFO
    WHERE tag = ?1
),
candidate_tags AS (
    SELECT T.tag, T.illust_id, T.cnum
    FROM TAG_INFO T
    JOIN filtered_illusts fi
      ON T.illust_id = fi.illust_id AND T.cnum = fi.cnum
    WHERE T.tag != ?1
),
filtered_tags AS (
    SELECT ct.tag, ct.illust_id, ct.cnum
    FROM candidate_tags ct
    LEFT JOIN CHARACTER_INFO c
      ON ct.tag = c.character OR ct.tag = c.series
    LEFT JOIN COLLECT_UI_WORK cu
      ON ct.tag = cu.entity_key AND cu.collect_type = 3
    WHERE c.character IS NULL OR cu.collect_type = 3
)
SELECT 
    tag,
    COUNT(DISTINCT illust_id || '-' || cnum) AS count
FROM filtered_tags
GROUP BY tag
ORDER BY count DESC, tag COLLATE NOCASE;
