DELETE FROM ILLUST_INFO
WHERE illust_id = :illust_id AND suffix = :suffix;

DELETE FROM TAG_INFO
WHERE illust_id = :illust_id AND cnum = :cnum
  AND NOT EXISTS (
    SELECT 1 FROM ILLUST_INFO WHERE illust_id = :illust_id AND cnum = :cnum
  );

DELETE FROM ILLUST_DETAIL
WHERE illust_id = :illust_id AND cnum = :cnum
  AND NOT EXISTS (
    SELECT 1 FROM ILLUST_INFO WHERE illust_id = :illust_id AND cnum = :cnum
  );
