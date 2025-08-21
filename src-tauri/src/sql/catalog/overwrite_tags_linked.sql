DELETE FROM TAG_INFO
WHERE (illust_id, cnum) IN (
    SELECT DISTINCT illust_id, cnum FROM tmp_edit_tags
);

INSERT OR IGNORE INTO TAG_INFO (illust_id, cnum, tag)
SELECT illust_id, cnum, tag
FROM tmp_edit_tags
GROUP BY illust_id, cnum, tag;
