UPDATE ILLUST_DETAIL
SET character = :character
WHERE EXISTS (
    SELECT 1
    FROM tmp_label_target lt
    JOIN ILLUST_INFO I ON lt.illust_id = I.illust_id AND lt.suffix = I.suffix
    WHERE ILLUST_DETAIL.illust_id = I.illust_id AND ILLUST_DETAIL.cnum = I.cnum
);