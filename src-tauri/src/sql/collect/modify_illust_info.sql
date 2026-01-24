UPDATE ILLUST_INFO
SET save_dir = m.dest_dir
FROM tmp_move_by_author AS m
WHERE ILLUST_INFO.illust_id = m.illust_id
  AND ILLUST_INFO.suffix   = m.suffix
  AND ILLUST_INFO.illust_id = :illust_id
  AND ILLUST_INFO.suffix   = :suffix;
