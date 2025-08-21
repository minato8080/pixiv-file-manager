DELETE FROM TAG_INFO
WHERE (illust_id, control_num) IN (
    SELECT DISTINCT illust_id, control_num FROM tmp_edit_tags
);

INSERT OR IGNORE INTO TAG_INFO (illust_id, control_num, tag)
SELECT illust_id, control_num, tag
FROM tmp_edit_tags
GROUP BY illust_id, control_num, tag;
