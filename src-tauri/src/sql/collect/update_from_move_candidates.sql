UPDATE ILLUST_INFO
   SET save_dir = (
       SELECT dest_dir
         FROM tmp_move_candidates mc
        WHERE mc.illust_id = ILLUST_INFO.illust_id
          AND mc.suffix = ILLUST_INFO.suffix
   )
 WHERE EXISTS (
     SELECT 1
       FROM tmp_move_candidates mc
      WHERE mc.illust_id = ILLUST_INFO.illust_id
        AND mc.suffix = ILLUST_INFO.suffix
 );