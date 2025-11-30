-- 迁移脚本：创建编辑结算相关表
-- 执行时间：2025-12-01
-- 说明：为"编辑每月结算"功能添加 editor_settlement_monthly 和 editor_payout 表

-- 1. 创建 editor_settlement_monthly（编辑月度结算汇总表）
CREATE TABLE IF NOT EXISTS `editor_settlement_monthly` (
  `id` BIGINT PRIMARY KEY AUTO_INCREMENT,
  `editor_admin_id` INT NOT NULL COMMENT '编辑/主编管理员ID，对应 admin.id',
  `role` ENUM('chief_editor', 'editor', 'proofreader') NOT NULL COMMENT '角色',
  `month` DATE NOT NULL COMMENT '结算月份，比如 2025-10-01',
  `total_income_usd` DECIMAL(18,6) NOT NULL DEFAULT 0 COMMENT '该月编辑总收入 USD，来自 editor_income_monthly 汇总',
  `novel_count` INT NOT NULL DEFAULT 0 COMMENT '该月参与分成的小说数量',
  `record_count` INT NOT NULL DEFAULT 0 COMMENT '该月 editor_income_monthly 记录条数',
  `payout_status` ENUM('unpaid','paid') NOT NULL DEFAULT 'unpaid' COMMENT '支付状态',
  `payout_id` BIGINT NULL COMMENT '指向 editor_payout.id',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `uniq_editor_role_month` (`editor_admin_id`, `role`, `month`),
  KEY `idx_editor` (`editor_admin_id`),
  KEY `idx_month` (`month`),
  KEY `idx_status` (`payout_status`),
  CONSTRAINT `fk_editor_settlement_admin` FOREIGN KEY (`editor_admin_id`) REFERENCES `admin`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='编辑月度结算汇总表';

-- 2. 创建 editor_payout（编辑支付单表）
CREATE TABLE IF NOT EXISTS `editor_payout` (
  `id` BIGINT PRIMARY KEY AUTO_INCREMENT,
  `editor_admin_id` INT NOT NULL COMMENT '编辑/主编管理员ID',
  `role` ENUM('chief_editor', 'editor', 'proofreader') NOT NULL COMMENT '角色',
  `month` DATE NOT NULL COMMENT '结算月份',
  `settlement_monthly_id` BIGINT NOT NULL COMMENT '指向 editor_settlement_monthly.id',
  `base_amount_usd` DECIMAL(18,6) NOT NULL COMMENT '该月应结算美元收入（记账基准）',
  `payout_currency` CHAR(3) NOT NULL COMMENT '实际支付币种，比如 USD / CNY',
  `payout_amount` DECIMAL(10,2) NOT NULL COMMENT '实际支付金额',
  `fx_rate` DECIMAL(12,6) NOT NULL COMMENT '汇率：1 USD = fx_rate * payout_currency',
  `method` ENUM('paypal', 'bank_transfer', 'alipay', 'wechat', 'manual') NOT NULL COMMENT '支付方式',
  `status` ENUM('pending','processing','paid','failed','cancelled') NOT NULL DEFAULT 'pending' COMMENT '支付状态',
  `account_info` JSON NULL COMMENT '收款账号快照，结构和 user_payout_account/account_data、admin_payout_account/account_data 保持一致',
  `gateway_tx_id` BIGINT NULL COMMENT '指向 payout_gateway_transaction.id',
  `requested_at` DATETIME NOT NULL COMMENT '发起时间',
  `paid_at` DATETIME NULL COMMENT '支付完成时间',
  `admin_id` BIGINT NULL COMMENT '操作管理员ID',
  `note` VARCHAR(255) NULL COMMENT '备注',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `uniq_editor_role_month_payout` (`editor_admin_id`, `role`, `month`),
  KEY `idx_editor` (`editor_admin_id`),
  KEY `idx_status` (`status`),
  KEY `idx_method` (`method`),
  KEY `idx_gateway_tx` (`gateway_tx_id`),
  CONSTRAINT `fk_editor_payout_admin` FOREIGN KEY (`editor_admin_id`) REFERENCES `admin`(`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_editor_payout_settlement` FOREIGN KEY (`settlement_monthly_id`) REFERENCES `editor_settlement_monthly`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='编辑支付单表';

