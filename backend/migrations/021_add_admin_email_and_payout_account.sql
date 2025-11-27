-- 迁移021：为 admin 表添加邮箱、手机号、真实姓名字段，并创建 admin_payout_account 表
-- 执行时间：2025-01-XX

-- 1. 为 admin 表添加新字段
ALTER TABLE `admin`
  ADD COLUMN `email` VARCHAR(255) NULL COMMENT '管理员邮箱，用于登录和收验证码' AFTER `name`,
  ADD COLUMN `phone` VARCHAR(50) NULL COMMENT '手机号' AFTER `email`,
  ADD COLUMN `real_name` VARCHAR(100) NULL COMMENT '真实姓名，用于结算实名' AFTER `phone`;

-- 2. 添加 email 唯一索引
CREATE UNIQUE INDEX `uniq_admin_email` ON `admin`(`email`);

-- 3. 创建 admin_payout_account 表（管理员/编辑收款账户配置）
CREATE TABLE IF NOT EXISTS `admin_payout_account` (
  `id` BIGINT PRIMARY KEY AUTO_INCREMENT,
  `admin_id` INT NOT NULL COMMENT '指向 admin.id',
  `method` ENUM('paypal','bank_transfer','alipay','wechat') NOT NULL COMMENT '收款方式',
  `is_default` TINYINT NOT NULL DEFAULT 0 COMMENT '是否默认账户',
  `account_label` VARCHAR(100) NULL COMMENT '显示名：如 "我的PayPal"',
  `account_data` JSON NOT NULL COMMENT '具体账户信息，结构和 user_payout_account.account_data 保持一致',
  `status` ENUM('active','disabled') NOT NULL DEFAULT 'active' COMMENT '状态',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY `idx_admin` (`admin_id`),
  KEY `idx_method` (`method`),
  CONSTRAINT `fk_admin_payout_account_admin` FOREIGN KEY (`admin_id`) REFERENCES `admin`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='管理员/编辑收款账户配置';

