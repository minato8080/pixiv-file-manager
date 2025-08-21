SELECT
  r.tag,
  IFNULL(tag_usage.count, 0) AS usage_count
FROM (
    SELECT src_tag AS tag FROM TAG_FIX_RULES
    UNION
    SELECT dst_tag AS tag FROM TAG_FIX_RULES
) r
LEFT JOIN (
    SELECT
      T.tag,
      COUNT(DISTINCT I.illust_id || '-' || I.suffix) AS count
    FROM TAG_INFO T
    JOIN ILLUST_INFO I
      ON T.illust_id = I.illust_id
     AND T.cnum = I.cnum
    GROUP BY T.tag
) tag_usage
  ON r.tag = tag_usage.tag
ORDER BY usage_count DESC, r.tag ASC;
