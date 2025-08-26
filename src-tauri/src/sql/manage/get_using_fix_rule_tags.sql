SELECT
  all_rule.tag,
  IFNULL(tag_usage.count, 0) AS usage_count
FROM (
    SELECT src_tag AS tag FROM TAG_FIX_RULES
    UNION
    SELECT dst_tag AS tag FROM TAG_FIX_RULES
) all_rule
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
  ON all_rule.tag = tag_usage.tag
ORDER BY usage_count DESC, all_rule.tag ASC;
