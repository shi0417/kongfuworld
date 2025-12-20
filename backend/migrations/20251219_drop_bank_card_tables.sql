-- 删除银行卡绑定相关表
-- 执行此脚本将删除 user_bank_card_bindings 和 user_bank_card_change_logs 表

-- 删除银行卡变更记录表（先删除，因为可能有外键依赖）
DROP TABLE IF EXISTS `user_bank_card_change_logs`;

-- 删除银行卡绑定表
DROP TABLE IF EXISTS `user_bank_card_bindings`;

