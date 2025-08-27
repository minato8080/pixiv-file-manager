SELECT T.tag, COUNT(DISTINCT I.illust_id || '-' || I.suffix) AS count
FROM TAG_INFO T
JOIN ILLUST_INFO I
  ON T.illust_id = I.illust_id AND T.cnum = I.cnum
WHERE T.tag NOT IN (
  SELECT entity_key FROM CHARACTER_INFO
)
GROUP BY T.tag
ORDER BY count DESC, T.tag ASC;