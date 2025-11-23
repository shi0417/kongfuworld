-- 用户支付方式存储表
CREATE TABLE IF NOT EXISTS `user_payment_methods` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL,
  `payment_method_id` varchar(255) NOT NULL COMMENT 'Stripe PaymentMethod ID',
  `card_brand` varchar(50) DEFAULT NULL COMMENT '卡品牌 (visa, mastercard, amex等)',
  `card_last4` varchar(4) DEFAULT NULL COMMENT '卡号后四位',
  `card_exp_month` int(2) DEFAULT NULL COMMENT '过期月份',
  `card_exp_year` int(4) DEFAULT NULL COMMENT '过期年份',
  `is_default` tinyint(1) DEFAULT 0 COMMENT '是否为默认支付方式',
  `is_active` tinyint(1) DEFAULT 1 COMMENT '是否激活',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_payment_method_id` (`payment_method_id`),
  CONSTRAINT `fk_user_payment_methods_user_id` FOREIGN KEY (`user_id`) REFERENCES `user` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户支付方式存储表';
