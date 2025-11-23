-- 用户结算系统数据库表结构（统一支持作者+推广者）
-- 执行此脚本创建所有必要的表

-- 1. 用户月度收入汇总表（结算层）
CREATE TABLE IF NOT EXISTS `user_income_monthly` (
  `id` BIGINT PRIMARY KEY AUTO_INCREMENT,
  `user_id` BIGINT NOT NULL COMMENT '用户ID（可以是作者、推广者或两者兼具）',
  `month` DATE NOT NULL COMMENT '月份，例如 2025-10-01 代表2025年10月',
  
  `author_base_income_usd` DECIMAL(10,6) NOT NULL DEFAULT 0 COMMENT '作者基础稿费',
  `reader_referral_income_usd` DECIMAL(10,6) NOT NULL DEFAULT 0 COMMENT '读者推广收入',
  `author_referral_income_usd` DECIMAL(10,6) NOT NULL DEFAULT 0 COMMENT '作者推广收入',
  `total_income_usd` DECIMAL(10,6) NOT NULL DEFAULT 0 COMMENT '三者之和',
  
  `paid_amount_usd` DECIMAL(10,6) NOT NULL DEFAULT 0 COMMENT '已支付金额',
  -- 未支付 = total_income_usd - paid_amount_usd
  
  `payout_status` ENUM('unpaid','partially_paid','paid') NOT NULL DEFAULT 'unpaid' COMMENT '支付状态',
  
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  UNIQUE KEY `uniq_user_month` (`user_id`, `month`),
  KEY `idx_user` (`user_id`),
  KEY `idx_month` (`month`),
  KEY `idx_status` (`payout_status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户月度收入汇总表（支持作者+推广者）';

-- 2. 用户支付单主表（提现/支付层）
CREATE TABLE IF NOT EXISTS `user_payout` (
  `id` BIGINT PRIMARY KEY AUTO_INCREMENT,
  `user_id` BIGINT NOT NULL COMMENT '用户ID',
  `amount_usd` DECIMAL(10,6) NOT NULL COMMENT '本次计划/实际支付金额（正数）',
  
  `currency` CHAR(3) NOT NULL DEFAULT 'USD' COMMENT '货币',
  
  `status` ENUM('pending','approved','paid','rejected','cancelled') NOT NULL DEFAULT 'pending' COMMENT '状态',
  -- pending: 用户申请/系统生成，待审核
  -- approved: 财务审核通过，待打款
  -- paid: 已打款成功
  -- rejected: 审核拒绝
  -- cancelled: 取消
  
  `method` ENUM('paypal','bank_transfer','alipay','wechat','manual') NOT NULL COMMENT '支付方式',
  `account_info` JSON NULL COMMENT '该笔支付使用的收款账号快照（避免用户改账号后影响历史）',
  
  `threshold_flag` TINYINT NOT NULL DEFAULT 0 COMMENT '是否满足门槛自动生成（1）还是手动（0）',
  
  `requested_at` DATETIME NOT NULL COMMENT '用户申请时间/系统生成时间',
  `approved_at` DATETIME NULL COMMENT '审核通过时间',
  `paid_at` DATETIME NULL COMMENT '支付完成时间',
  `admin_id` BIGINT NULL COMMENT '审核/打款管理员ID',
  `note` VARCHAR(255) NULL COMMENT '备注，比如"结算2025年1-3月收入"',
  
  `gateway_tx_id` BIGINT NULL COMMENT '对应支付网关交易记录ID',
  
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  KEY `idx_user` (`user_id`),
  KEY `idx_status` (`status`),
  KEY `idx_method` (`method`),
  KEY `idx_gateway_tx` (`gateway_tx_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户支付单主表';

-- 3. 支付单涉及的月份
CREATE TABLE IF NOT EXISTS `user_payout_item` (
  `id` BIGINT PRIMARY KEY AUTO_INCREMENT,
  `payout_id` BIGINT NOT NULL COMMENT '支付单ID',
  `user_id` BIGINT NOT NULL COMMENT '用户ID',
  `month` DATE NOT NULL COMMENT '对应 user_income_monthly.month',
  `amount_usd` DECIMAL(10,6) NOT NULL COMMENT '本次支付中分配到该月的金额',
  
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT `fk_user_item_payout` FOREIGN KEY (`payout_id`) REFERENCES `user_payout`(`id`) ON DELETE CASCADE,
  UNIQUE KEY `uniq_payout_month` (`payout_id`, `month`),
  KEY `idx_user_month` (`user_id`, `month`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='支付单涉及的月份';

-- 4. 用户收款账户配置
CREATE TABLE IF NOT EXISTS `user_payout_account` (
  `id` BIGINT PRIMARY KEY AUTO_INCREMENT,
  `user_id` BIGINT NOT NULL COMMENT '用户ID',
  `method` ENUM('paypal','bank_transfer','alipay','wechat') NOT NULL COMMENT '支付方式',
  `is_default` TINYINT NOT NULL DEFAULT 0 COMMENT '是否默认账户',
  
  `account_label` VARCHAR(100) NULL COMMENT '显示名：如 "我的PayPal"',
  `account_data` JSON NOT NULL COMMENT '具体信息，例：PayPal: {"email":"xxx@gmail.com"}, bank: {"bank_name":"ICBC","account_no":"***","holder":"张三"}, alipay: {"login_id":"xxx@alipay.com"}, wechat: {"openid":"xxx", "real_name":"张三"}',
  
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  KEY `idx_user` (`user_id`),
  KEY `idx_method` (`method`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户收款账户配置';

-- 5. 支付网关交易表（银行/PayPal返回数据）（保持不变）
CREATE TABLE IF NOT EXISTS `payout_gateway_transaction` (
  `id` BIGINT PRIMARY KEY AUTO_INCREMENT,
  `provider` ENUM('paypal','stripe','alipay','wechat','bank_manual') NOT NULL COMMENT '支付渠道',
  `provider_tx_id` VARCHAR(128) NULL COMMENT '第三方返回的交易号',
  `provider_batch_id` VARCHAR(128) NULL COMMENT '批次号（比如PayPal Payouts batch id）',
  `status` ENUM('created','processing','succeeded','failed') NOT NULL DEFAULT 'created' COMMENT '状态',
  `amount_usd` DECIMAL(10,6) NOT NULL COMMENT '金额',
  `currency` CHAR(3) NOT NULL DEFAULT 'USD' COMMENT '货币',
  
  `request_payload` JSON NULL COMMENT '请求报文快照（可选）',
  `response_payload` JSON NULL COMMENT '第一次响应',
  `callback_payload` JSON NULL COMMENT 'webhook 回调（若有）',
  
  `error_code` VARCHAR(64) NULL COMMENT '错误码',
  `error_message` VARCHAR(255) NULL COMMENT '错误信息',
  
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  KEY `idx_provider` (`provider`),
  KEY `idx_provider_tx` (`provider_tx_id`),
  KEY `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='支付网关交易表';

