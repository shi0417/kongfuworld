-- 修复实名认证表中id_card_number字段长度
-- 加密后的身份证号长度约为100+字符，需要将字段类型改为TEXT

ALTER TABLE `user_identity_verifications` 
MODIFY COLUMN `id_card_number` TEXT DEFAULT NULL COMMENT '身份证号（加密存储）';

