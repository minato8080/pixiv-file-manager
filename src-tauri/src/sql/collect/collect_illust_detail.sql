UPDATE ILLUST_DETAIL
SET character = (
  SELECT CF.character
  FROM COLLECT_FILTER_WORK CF
  WHERE CF.illust_id = ILLUST_DETAIL.illust_id
    AND CF.cnum = ILLUST_DETAIL.cnum
    AND CF.collect_type = 2
)
WHERE EXISTS (
  SELECT 1 FROM COLLECT_FILTER_WORK CF
  WHERE CF.illust_id = ILLUST_DETAIL.illust_id
    AND CF.cnum = ILLUST_DETAIL.cnum
);

