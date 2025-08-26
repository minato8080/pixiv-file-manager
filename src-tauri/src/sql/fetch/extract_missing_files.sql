-- missing_files.sql
SELECT D.illust_id,
       I.suffix,
       I.extension,
       I.save_dir
FROM ILLUST_DETAIL D
JOIN TAG_INFO T
  ON D.illust_id = T.illust_id AND D.cnum = T.cnum
JOIN ILLUST_INFO I
  ON D.illust_id = I.illust_id
WHERE D.author_id = 0
GROUP BY D.illust_id, D.cnum
HAVING COUNT(*) = 1
   AND SUM(CASE WHEN T.tag = 'Missing' THEN 1 ELSE 0 END) = 1;
