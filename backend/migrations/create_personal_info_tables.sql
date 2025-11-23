-- 创建个人信息相关表
-- 执行时间: 2025-01-XX

-- 1. 在user表中添加基础信息字段
ALTER TABLE `user` 
ADD COLUMN `qq_number` VARCHAR(50) DEFAULT NULL COMMENT 'QQ号码' AFTER `email`,
ADD COLUMN `wechat_number` VARCHAR(50) DEFAULT NULL COMMENT '微信号码' AFTER `qq_number`,
ADD COLUMN `emergency_contact_relationship` VARCHAR(20) DEFAULT NULL COMMENT '紧急联系人关系' AFTER `wechat_number`,
ADD COLUMN `emergency_contact_phone` VARCHAR(20) DEFAULT NULL COMMENT '紧急联系人电话' AFTER `emergency_contact_relationship`,
ADD COLUMN `is_real_name_verified` TINYINT(1) DEFAULT 0 COMMENT '是否已实名认证' AFTER `emergency_contact_phone`,
ADD COLUMN `phone_number` VARCHAR(20) DEFAULT NULL COMMENT '手机号码' AFTER `is_real_name_verified`;

-- 为QQ和微信添加唯一索引
ALTER TABLE `user` 
ADD UNIQUE KEY `unique_qq_number` (`qq_number`),
ADD UNIQUE KEY `unique_wechat_number` (`wechat_number`);

-- 2. 创建收货地址表
CREATE TABLE IF NOT EXISTS `user_addresses` (
  `address_id` INT NOT NULL AUTO_INCREMENT COMMENT '地址ID',
  `user_id` INT NOT NULL COMMENT '用户ID',
  `address_details` TEXT NOT NULL COMMENT '完整地址',
  `recipient_name` VARCHAR(100) DEFAULT NULL COMMENT '收货人姓名',
  `recipient_phone` VARCHAR(20) DEFAULT NULL COMMENT '收货人电话',
  `is_default` TINYINT(1) DEFAULT 0 COMMENT '是否默认地址',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`address_id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_is_default` (`is_default`),
  CONSTRAINT `user_addresses_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `user` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户收货地址表';

-- 3. 创建实名认证表
CREATE TABLE IF NOT EXISTS `user_identity_verifications` (
  `verification_id` INT NOT NULL AUTO_INCREMENT COMMENT '认证ID',
  `user_id` INT NOT NULL COMMENT '用户ID',
  `id_card_number` VARCHAR(50) DEFAULT NULL COMMENT '身份证号（加密存储）',
  `real_name` VARCHAR(100) DEFAULT NULL COMMENT '真实姓名',
  `verification_status` ENUM('pending', 'verified', 'rejected') DEFAULT 'pending' COMMENT '认证状态',
  `verified_at` DATETIME DEFAULT NULL COMMENT '认证通过时间',
  `rejected_reason` TEXT DEFAULT NULL COMMENT '拒绝原因',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`verification_id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_verification_status` (`verification_status`),
  CONSTRAINT `user_identity_verifications_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `user` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户实名认证表';

-- 4. 创建银行卡绑定表
CREATE TABLE IF NOT EXISTS `user_bank_card_bindings` (
  `binding_id` INT NOT NULL AUTO_INCREMENT COMMENT '绑定ID',
  `user_id` INT NOT NULL COMMENT '用户ID',
  `platform_name` VARCHAR(100) NOT NULL COMMENT '平台名称（如：七猫中文网、奇妙小说网等）',
  `masked_card_number` VARCHAR(50) DEFAULT NULL COMMENT '脱敏卡号（用于显示）',
  `full_card_number` VARCHAR(50) DEFAULT NULL COMMENT '完整卡号（加密存储）',
  `bank_name` VARCHAR(100) DEFAULT NULL COMMENT '银行名称',
  `cardholder_name` VARCHAR(100) DEFAULT NULL COMMENT '持卡人姓名',
  `is_active` TINYINT(1) DEFAULT 1 COMMENT '是否激活',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`binding_id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_platform_name` (`platform_name`),
  KEY `idx_is_active` (`is_active`),
  UNIQUE KEY `unique_user_platform` (`user_id`, `platform_name`),
  CONSTRAINT `user_bank_card_bindings_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `user` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户银行卡绑定表';

-- 5. 创建银行卡变更记录表（可选，用于记录历史）
CREATE TABLE IF NOT EXISTS `user_bank_card_change_logs` (
  `log_id` INT NOT NULL AUTO_INCREMENT COMMENT '日志ID',
  `user_id` INT NOT NULL COMMENT '用户ID',
  `platform_name` VARCHAR(100) NOT NULL COMMENT '平台名称',
  `old_masked_card_number` VARCHAR(50) DEFAULT NULL COMMENT '旧卡号（脱敏）',
  `new_masked_card_number` VARCHAR(50) DEFAULT NULL COMMENT '新卡号（脱敏）',
  `change_reason` VARCHAR(255) DEFAULT NULL COMMENT '变更原因',
  `changed_at` DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '变更时间',
  PRIMARY KEY (`log_id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_changed_at` (`changed_at`),
  CONSTRAINT `user_bank_card_change_logs_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `user` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='银行卡变更记录表';

