-- 推广码表
-- 用于记录用户的推广码，支持读者推广和作者推广两种类型

CREATE TABLE IF NOT EXISTS `user_referral_code` (
  `id` BIGINT PRIMARY KEY AUTO_INCREMENT,
  `user_id` INT NOT NULL COMMENT '用户ID',
  `code` VARCHAR(32) NOT NULL COMMENT '推广码，如 ABC123',
  `link_type` ENUM('reader','author') NOT NULL COMMENT '链接类型：读者推广/作者推广',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `uniq_code` (`code`),
  UNIQUE KEY `uniq_user_type` (`user_id`, `link_type`),
  KEY `idx_user_id` (`user_id`),
  CONSTRAINT `fk_urc_user` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户推广码表';

-- 推广点击统计表（可选，用于统计推广链接点击次数）
CREATE TABLE IF NOT EXISTS `referral_clicks` (
  `id` BIGINT PRIMARY KEY AUTO_INCREMENT,
  `referral_code` VARCHAR(32) NOT NULL COMMENT '推广码',
  `ip_address` VARCHAR(45) NULL COMMENT 'IP地址',
  `user_agent` VARCHAR(255) NULL COMMENT '用户代理',
  `clicked_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY `idx_code` (`referral_code`),
  KEY `idx_clicked_at` (`clicked_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='推广点击统计表';

