UPDATE ILLUST_DETAIL
SET character = :character
WHERE EXISTS (
    SELECT 1
    FROM tmp_label_character tmp
    JOIN ILLUST_INFO I ON tmp.illust_id = I.illust_id AND tmp.suffix = I.suffix
    WHERE ILLUST_DETAIL.illust_id = I.illust_id AND ILLUST_DETAIL.cnum = I.cnum
);