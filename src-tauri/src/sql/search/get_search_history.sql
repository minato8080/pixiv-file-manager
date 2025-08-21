SELECT 
    h.tags,
    h.character,
    a.author_id,
    a.author_name,
    a.author_account,
    h.timestamp,
    h.result_count,
    (
        SELECT COUNT(*) 
        FROM ILLUST_DETAIL d 
        WHERE d.author_id = a.author_id
    ) AS author_count
FROM SEARCH_HISTORY h
LEFT JOIN AUTHOR_INFO a
  ON h.author_id = a.author_id
ORDER BY h.timestamp DESC
LIMIT 10;
