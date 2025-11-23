-- Karma系统数据库表结构（简化版）

-- 1. Karma交易记录表
CREATE TABLE IF NOT EXISTS `user_karma_transactions` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL,
  `transaction_type` enum('purchase', 'consumption', 'reward', 'refund', 'bonus') NOT NULL,
  `karma_amount` int(11) NOT NULL,
  `karma_type` enum('golden_karma', 'regular_karma') NOT NULL DEFAULT 'golden_karma',
  `payment_method` varchar(20) DEFAULT NULL,
  `payment_record_id` int(11) DEFAULT NULL,
  `novel_id` int(11) DEFAULT NULL,
  `chapter_id` int(11) DEFAULT NULL,
  `description` varchar(255) DEFAULT NULL,
  `reason` varchar(100) DEFAULT NULL,
  `balance_before` int(11) NOT NULL,
  `balance_after` int(11) NOT NULL,
  `status` enum('pending', 'completed', 'failed', 'cancelled') NOT NULL DEFAULT 'completed',
  `transaction_id` varchar(255) DEFAULT NULL,
  `stripe_payment_intent_id` varchar(255) DEFAULT NULL,
  `paypal_order_id` varchar(255) DEFAULT NULL,
  `currency` varchar(3) DEFAULT 'USD',
  `amount_paid` decimal(10,2) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
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
  KEY `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Karma套餐配置表
CREATE TABLE IF NOT EXISTS `karma_packages` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `package_name` varchar(100) NOT NULL,
  `karma_amount` int(11) NOT NULL,
  `price` decimal(10,2) NOT NULL,
  `currency` varchar(3) NOT NULL DEFAULT 'USD',
  `karma_type` enum('golden_karma', 'regular_karma') NOT NULL DEFAULT 'golden_karma',
  `bonus_karma` int(11) DEFAULT 0,
  `bonus_percentage` decimal(5,2) DEFAULT 0.00,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `sort_order` int(11) DEFAULT 0,
  `description` text DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_is_active` (`is_active`),
  KEY `idx_sort_order` (`sort_order`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. 插入默认Karma套餐数据
INSERT INTO `karma_packages` (`package_name`, `karma_amount`, `price`, `currency`, `karma_type`, `bonus_karma`, `bonus_percentage`, `is_active`, `sort_order`, `description`) VALUES
('Starter Pack', 1000, 4.99, 'USD', 'golden_karma', 0, 0.00, 1, 1, 'Perfect for new readers'),
('Value Pack', 2000, 9.99, 'USD', 'golden_karma', 200, 10.00, 1, 2, 'Great value with 10% bonus'),
('Popular Pack', 4000, 19.99, 'USD', 'golden_karma', 800, 20.00, 1, 3, 'Most popular choice with 20% bonus'),
('Premium Pack', 10000, 49.99, 'USD', 'golden_karma', 2500, 25.00, 1, 4, 'Best value with 25% bonus'),
('Ultimate Pack', 20000, 99.99, 'USD', 'golden_karma', 6000, 30.00, 1, 5, 'Maximum value with 30% bonus');
