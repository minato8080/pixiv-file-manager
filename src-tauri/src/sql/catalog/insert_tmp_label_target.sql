INSERT INTO tmp_label_target (illust_id, suffix, cnum)
SELECT I.illust_id, I.suffix, I.cnum
FROM ILLUST_INFO I
JOIN (SELECT :illust_id AS illust_id, :suffix AS suffix) input
ON I.illust_id = input.illust_id
AND I.suffix    = input.suffix;