-- Phase 5: 创建小说月度收入表
-- 用于存储每本小说每月的各种类型收入（如 Champion 收入）

CREATE TABLE IF NOT EXISTS `novel_income_monthly` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `novel_id` INT NOT NULL COMMENT '小说ID',
  `month` DATE NOT NULL COMMENT '月份，格式：2025-11-01',
  `income_type` VARCHAR(50) NOT NULL COMMENT '收入类型，如：champion, subscription, unlock 等',
  `income_usd` DECIMAL(18,6) NOT NULL DEFAULT 0 COMMENT '收入金额（USD）',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `uniq_novel_month_type` (`novel_id`, `month`, `income_type`),
  KEY `idx_novel_id` (`novel_id`),
  KEY `idx_month` (`month`),
  KEY `idx_income_type` (`income_type`),
  CONSTRAINT `fk_novel_income_novel` FOREIGN KEY (`novel_id`) REFERENCES `novel`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='小说月度收入表';

