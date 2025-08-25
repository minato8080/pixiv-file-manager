-- missing_files.sql
SELECT d.illust_id,
       i.suffix,
       i.extension,
       i.save_dir
FROM ILLUST_DETAIL d
JOIN TAG_INFO t
  ON d.illust_id = t.illust_id AND d.cnum = t.cnum
JOIN ILLUST_INFO i
  ON d.illust_id = i.illust_id
WHERE d.author_id = 0
GROUP BY d.illust_id, d.cnum
HAVING COUNT(*) = 1
   AND SUM(CASE WHEN t.tag = 'Missing' THEN 1 ELSE 0 END) = 1;
