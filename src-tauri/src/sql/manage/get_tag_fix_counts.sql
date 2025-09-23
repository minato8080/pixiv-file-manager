SELECT replaced, deleted, added,
       replaced + deleted + added AS total_updated
FROM tmp_tag_fix_counts
LIMIT 1;