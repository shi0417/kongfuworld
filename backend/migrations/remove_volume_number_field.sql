-- 删除volume表中的volume_number字段
-- 该字段未被使用，实际使用的是volume_id字段

ALTER TABLE `volume` DROP COLUMN `volume_number`;

