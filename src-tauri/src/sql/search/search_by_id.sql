SELECT 
    i.illust_id,
    i.suffix,
    i.extension,
    i.save_dir,
    d.character,
    a.author_name,
    GROUP_CONCAT(t.tag, ',') AS tags
FROM ILLUST_INFO i
LEFT JOIN ILLUST_DETAIL d
    ON i.illust_id = d.illust_id AND i.cnum = d.cnum
LEFT JOIN AUTHOR_INFO a
    ON d.author_id = a.author_id
LEFT JOIN TAG_INFO t
    ON i.illust_id = t.illust_id AND i.cnum = t.cnum
WHERE i.illust_id = ?
GROUP BY 
    i.illust_id,
    i.suffix
ORDER BY i.suffix ASC
LIMIT 500;