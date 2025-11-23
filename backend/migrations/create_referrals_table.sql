-- 创建推荐人表
-- 用于记录用户推荐关系和推广分成方案

CREATE TABLE IF NOT EXISTS `referrals` (
  `id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '主键，自增',
  `user_id` INT NOT NULL COMMENT '被推荐用户ID，外键关联user表',
  `referrer_id` INT NOT NULL COMMENT '推荐人ID，外键关联user表',
  `promoter_plan_id` BIGINT NULL COMMENT '推广人员分成方案ID',
  `author_plan_id` BIGINT NULL COMMENT '作者推广分成方案ID',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_user_referrer` (`user_id`, `referrer_id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_referrer_id` (`referrer_id`),
  KEY `idx_promoter_plan_id` (`promoter_plan_id`),
  KEY `idx_author_plan_id` (`author_plan_id`),
  KEY `idx_created_at` (`created_at`),
  CONSTRAINT `fk_referrals_user_id` FOREIGN KEY (`user_id`) REFERENCES `user` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_referrals_referrer_id` FOREIGN KEY (`referrer_id`) REFERENCES `user` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='推荐人关系表';

