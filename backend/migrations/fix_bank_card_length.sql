-- 修复银行卡号字段长度问题
-- 将 full_card_number 从 VARCHAR(50) 改为 TEXT，因为加密后的银行卡号会超过50个字符

ALTER TABLE `user_bank_card_bindings`
MODIFY COLUMN `full_card_number` TEXT DEFAULT NULL COMMENT '完整卡号（加密存储）';

