SELECT T.tag, COUNT(DISTINCT I.illust_id || '-' || I.suffix) AS count
FROM TAG_INFO T
JOIN ILLUST_INFO I
ON T.illust_id = I.illust_id AND T.control_num = I.control_num
GROUP BY T.tag
ORDER BY count DESC, T.tag ASC;