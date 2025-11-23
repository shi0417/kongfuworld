-- 为实名认证表添加脱敏身份证号字段
-- 用于显示，避免对加密字符串进行脱敏

ALTER TABLE `user_identity_verifications` 
ADD COLUMN `masked_id_card` VARCHAR(20) DEFAULT NULL COMMENT '脱敏后的身份证号（用于显示' AFTER `id_card_number`;

