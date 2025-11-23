-- 为银行卡变更记录表添加新旧银行卡的完整信息字段
ALTER TABLE `user_bank_card_change_logs`
ADD COLUMN `old_full_card_number` TEXT DEFAULT NULL COMMENT '旧卡号（加密存储）' AFTER `old_masked_card_number`,
ADD COLUMN `old_bank_name` VARCHAR(100) DEFAULT NULL COMMENT '旧银行名称' AFTER `old_full_card_number`,
ADD COLUMN `old_cardholder_name` VARCHAR(100) DEFAULT NULL COMMENT '旧持卡人姓名' AFTER `old_bank_name`,
ADD COLUMN `new_full_card_number` TEXT DEFAULT NULL COMMENT '新卡号（加密存储）' AFTER `new_masked_card_number`,
ADD COLUMN `new_bank_name` VARCHAR(100) DEFAULT NULL COMMENT '新银行名称' AFTER `new_full_card_number`,
ADD COLUMN `new_cardholder_name` VARCHAR(100) DEFAULT NULL COMMENT '新持卡人姓名' AFTER `new_bank_name`;

