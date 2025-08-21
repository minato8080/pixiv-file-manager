DROP TABLE IF EXISTS tmp_edit_tags;
CREATE TEMP TABLE tmp_edit_tags (
    illust_id   TEXT NOT NULL,
    suffix      TEXT NOT NULL,
    control_num INTEGER NOT NULL,
    tag         TEXT NOT NULL
);
