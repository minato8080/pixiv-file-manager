UPDATE ILLUST_DETAIL
SET 
    character = CF.character,
    series    = CF.series
FROM COLLECT_FILTER_WORK CF
WHERE ILLUST_DETAIL.illust_id = CF.illust_id
  AND ILLUST_DETAIL.cnum = CF.cnum
  AND CF.collect_type <= 2;