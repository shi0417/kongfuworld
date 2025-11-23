-- Karma系统数据库表结构
-- 参考Wuxiaworld.com的设计，实现用户Karma余额管理和交易记录

-- 1. 用户Karma余额表（扩展现有user表）
-- 注意：user表已经有balance和karma字段，这里提供更详细的Karma管理

-- 2. Karma交易记录表
CREATE TABLE IF NOT EXISTS `user_karma_transactions` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL COMMENT '用户ID',
  `transaction_type` enum('purchase', 'consumption', 'reward', 'refund', 'bonus') NOT NULL COMMENT '交易类型：购买、消费、奖励、退款、 bonus',
  `karma_amount` int(11) NOT NULL COMMENT 'Karma数量（正数为获得，负数为消费）',
  `karma_type` enum('golden_karma', 'regular_karma') NOT NULL DEFAULT 'golden_karma' COMMENT 'Karma类型：金币Karma、普通Karma',
  `payment_method` varchar(20) DEFAULT NULL COMMENT '支付方式 (stripe, paypal, free)',
  `payment_record_id` int(11) DEFAULT NULL COMMENT '关联的payment_record表ID（购买时）',
  `novel_id` int(11) DEFAULT NULL COMMENT '关联小说ID（消费时）',
  `chapter_id` int(11) DEFAULT NULL COMMENT '关联章节ID（消费时）',
  `description` varchar(255) DEFAULT NULL COMMENT '交易描述',
  `reason` varchar(100) DEFAULT NULL COMMENT '交易原因',
  `balance_before` int(11) NOT NULL COMMENT '交易前余额',
  `balance_after` int(11) NOT NULL COMMENT '交易后余额',
  `status` enum('pending', 'completed', 'failed', 'cancelled') NOT NULL DEFAULT 'completed' COMMENT '交易状态',
  `transaction_id` varchar(255) DEFAULT NULL COMMENT '第三方交易ID',
  `stripe_payment_intent_id` varchar(255) DEFAULT NULL COMMENT 'Stripe PaymentIntent ID',
  `paypal_order_id` varchar(255) DEFAULT NULL COMMENT 'PayPal Order ID',
  `currency` varchar(3) DEFAULT 'USD' COMMENT '货币类型',
  `amount_paid` decimal(10,2) DEFAULT NULL COMMENT '实际支付金额（购买时）',
  `exchange_rate` decimal(10,6) DEFAULT NULL COMMENT '汇率',
  `local_amount` decimal(10,2) DEFAULT NULL COMMENT '本地货币金额',
  `local_currency` varchar(3) DEFAULT NULL COMMENT '本地货币',
  `discount_amount` decimal(10,2) DEFAULT 0.00 COMMENT '折扣金额',
  `discount_code` varchar(50) DEFAULT NULL COMMENT '折扣码',
  `tax_amount` decimal(10,2) DEFAULT 0.00 COMMENT '税费',
  `fee_amount` decimal(10,2) DEFAULT 0.00 COMMENT '手续费',
  `refund_amount` decimal(10,2) DEFAULT 0.00 COMMENT '退款金额',
  `refund_reason` varchar(255) DEFAULT NULL COMMENT '退款原因',
  `refund_date` datetime DEFAULT NULL COMMENT '退款时间',
  `expires_at` datetime DEFAULT NULL COMMENT 'Karma过期时间（如果有）',
  `notes` text DEFAULT NULL COMMENT '备注信息',
  `ip_address` varchar(45) DEFAULT NULL COMMENT '交易IP地址',
  `user_agent` text DEFAULT NULL COMMENT '用户代理',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_transaction_type` (`transaction_type`),
  KEY `idx_karma_type` (`karma_type`),
  KEY `idx_payment_record_id` (`payment_record_id`),
  KEY `idx_novel_id` (`novel_id`),
  KEY `idx_chapter_id` (`chapter_id`),
  KEY `idx_transaction_id` (`transaction_id`),
  KEY `idx_stripe_payment_intent_id` (`stripe_payment_intent_id`),
  KEY `idx_paypal_order_id` (`paypal_order_id`),
  KEY `idx_status` (`status`),
  KEY `idx_created_at` (`created_at`),
  KEY `idx_expires_at` (`expires_at`),
  CONSTRAINT `fk_user_karma_transactions_user_id` FOREIGN KEY (`user_id`) REFERENCES `user` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_user_karma_transactions_payment_record_id` FOREIGN KEY (`payment_record_id`) REFERENCES `payment_record` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_user_karma_transactions_novel_id` FOREIGN KEY (`novel_id`) REFERENCES `novel` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户Karma交易记录表';

-- 3. Karma套餐配置表
CREATE TABLE IF NOT EXISTS `karma_packages` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `package_name` varchar(100) NOT NULL COMMENT '套餐名称',
  `karma_amount` int(11) NOT NULL COMMENT 'Karma数量',
  `price` decimal(10,2) NOT NULL COMMENT '价格',
  `currency` varchar(3) NOT NULL DEFAULT 'USD' COMMENT '货币类型',
  `karma_type` enum('golden_karma', 'regular_karma') NOT NULL DEFAULT 'golden_karma' COMMENT 'Karma类型',
  `bonus_karma` int(11) DEFAULT 0 COMMENT '奖励Karma数量',
  `bonus_percentage` decimal(5,2) DEFAULT 0.00 COMMENT '奖励百分比',
  `is_active` tinyint(1) NOT NULL DEFAULT 1 COMMENT '是否激活',
  `sort_order` int(11) DEFAULT 0 COMMENT '排序',
  `description` text DEFAULT NULL COMMENT '套餐描述',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_is_active` (`is_active`),
  KEY `idx_sort_order` (`sort_order`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Karma套餐配置表';

-- 4. 插入默认Karma套餐数据
INSERT INTO `karma_packages` (`package_name`, `karma_amount`, `price`, `currency`, `karma_type`, `bonus_karma`, `bonus_percentage`, `is_active`, `sort_order`, `description`) VALUES
('Starter Pack', 1000, 4.99, 'USD', 'golden_karma', 0, 0.00, 1, 1, 'Perfect for new readers'),
('Value Pack', 2000, 9.99, 'USD', 'golden_karma', 200, 10.00, 1, 2, 'Great value with 10% bonus'),
('Popular Pack', 4000, 19.99, 'USD', 'golden_karma', 800, 20.00, 1, 3, 'Most popular choice with 20% bonus'),
('Premium Pack', 10000, 49.99, 'USD', 'golden_karma', 2500, 25.00, 1, 4, 'Best value with 25% bonus'),
('Ultimate Pack', 20000, 99.99, 'USD', 'golden_karma', 6000, 30.00, 1, 5, 'Maximum value with 30% bonus');

-- 6. 创建索引优化查询性能
CREATE INDEX `idx_user_karma_transactions_user_type` ON `user_karma_transactions` (`user_id`, `transaction_type`);
CREATE INDEX `idx_user_karma_transactions_user_karma_type` ON `user_karma_transactions` (`user_id`, `karma_type`);
CREATE INDEX `idx_user_karma_transactions_created_at` ON `user_karma_transactions` (`created_at` DESC);
