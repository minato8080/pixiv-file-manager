DELETE FROM COLLECT_FILTER_WORK
WHERE collect_type = 1
  AND EXISTS (
      SELECT 1
      FROM COLLECT_FILTER_WORK CF2
      WHERE CF2.illust_id = COLLECT_FILTER_WORK.illust_id
        AND CF2.cnum      = COLLECT_FILTER_WORK.cnum
        AND CF2.collect_type = 2
  );

DELETE FROM COLLECT_FILTER_WORK
WHERE collect_type = 4
  AND EXISTS (
      SELECT 1
      FROM COLLECT_FILTER_WORK CF2
      WHERE CF2.illust_id = COLLECT_FILTER_WORK.illust_id
        AND CF2.cnum      = COLLECT_FILTER_WORK.cnum
        AND (
          CF2.collect_type = 1
          OR 
          CF2.collect_type = 2
         )
  );
