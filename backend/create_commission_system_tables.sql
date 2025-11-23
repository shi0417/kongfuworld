-- 分成系统数据库表结构
-- 用于支持多级推广分成、作者收入统计等功能

-- 1. 推荐关系表（一条链搞定读者+作者）
CREATE TABLE IF NOT EXISTS `referrals` (
  `id` BIGINT PRIMARY KEY AUTO_INCREMENT,
  `user_id` BIGINT NOT NULL COMMENT '下级用户ID',
  `referrer_id` BIGINT NOT NULL COMMENT '直接上线用户ID',
  `promoter_plan_id` BIGINT NULL COMMENT '读者推广方案ID',
  `author_plan_id` BIGINT NULL COMMENT '作者推广方案ID',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `uniq_user` (`user_id`),
  KEY `idx_referrer` (`referrer_id`),
  KEY `idx_promoter_plan` (`promoter_plan_id`),
  KEY `idx_author_plan` (`author_plan_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='推荐关系表';

-- 2. 分成方案主表
CREATE TABLE IF NOT EXISTS `commission_plan` (
  `id` BIGINT PRIMARY KEY AUTO_INCREMENT,
  `name` VARCHAR(100) NOT NULL COMMENT '方案名称，如：2025 Reader 8/3/2',
  `plan_type` ENUM('reader_promoter','author_promoter') NOT NULL COMMENT '方案类型：读者推广/作者推广',
  `max_level` INT NOT NULL DEFAULT 3 COMMENT '支持的最大层级',
  `start_date` DATETIME NOT NULL COMMENT '生效开始时间',
  `end_date` DATETIME NULL COMMENT '结束时间（NULL表示目前仍有效）',
  `is_custom` TINYINT NOT NULL DEFAULT 0 COMMENT '是否定制方案',
  `owner_user_id` BIGINT NULL COMMENT '若定制方案，可填拥有者user_id',
  `remark` VARCHAR(255) NULL COMMENT '备注',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY `idx_plan_type` (`plan_type`),
  KEY `idx_start_date` (`start_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='分成方案主表';

-- 3. 分成方案层级比例表
CREATE TABLE IF NOT EXISTS `commission_plan_level` (
  `id` BIGINT PRIMARY KEY AUTO_INCREMENT,
  `plan_id` BIGINT NOT NULL COMMENT '方案ID',
  `level` INT NOT NULL COMMENT '层级：1,2,3...',
  `percent` DECIMAL(10,8) NOT NULL COMMENT '分成比例（高精度）：0.08000000表示8%',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY `uniq_plan_level` (`plan_id`, `level`),
  CONSTRAINT `fk_cpl_plan` FOREIGN KEY (`plan_id`) REFERENCES `commission_plan`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='分成方案层级比例表';

-- 4. Karma转美元换算表
CREATE TABLE IF NOT EXISTS `karma_dollars` (
  `id` BIGINT PRIMARY KEY AUTO_INCREMENT,
  `usd_per_karma` DECIMAL(20,10) NOT NULL COMMENT '1 karma = X 美元（高精度）',
  `effective_from` DATETIME NOT NULL COMMENT '生效开始时间',
  `effective_to` DATETIME NULL COMMENT '结束时间（NULL表示目前仍有效）',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY `idx_effective` (`effective_from`, `effective_to`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Karma转美元换算表';

-- 5. 读者消费汇总表（统一存美元）
CREATE TABLE IF NOT EXISTS `reader_spending` (
  `id` BIGINT PRIMARY KEY AUTO_INCREMENT,
  `user_id` BIGINT NOT NULL COMMENT '读者用户ID',
  `novel_id` BIGINT NOT NULL COMMENT '小说ID',
  `karma_amount` INT NOT NULL DEFAULT 0 COMMENT '消费使用的karma数量（章节解锁时有）',
  `amount_usd` DECIMAL(20,8) NOT NULL COMMENT '换算后的美元金额（高精度）',
  `source_type` ENUM('chapter_unlock','subscription') NOT NULL COMMENT '来源类型',
  `source_id` BIGINT NOT NULL COMMENT '对应chapter_unlocks.id或subscription_record.id',
  `spend_time` DATETIME NOT NULL COMMENT '消费时间',
  `settlement_month` DATE NULL COMMENT '结算月份，如2025-10-01表示10月份',
  `settled` TINYINT NOT NULL DEFAULT 0 COMMENT '是否已结算',
  `settled_batch_id` BIGINT NULL COMMENT '结算批次ID',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY `uniq_source` (`source_type`, `source_id`),
  KEY `idx_user_month` (`user_id`, `settlement_month`),
  KEY `idx_month_settled` (`settlement_month`, `settled`),
  KEY `idx_spend_time` (`spend_time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='读者消费汇总表';

-- 6. 作者基础收入表
CREATE TABLE IF NOT EXISTS `author_royalty` (
  `id` BIGINT PRIMARY KEY AUTO_INCREMENT,
  `author_id` BIGINT NOT NULL COMMENT '作者用户ID',
  `novel_id` BIGINT NOT NULL COMMENT '小说ID',
  `source_spend_id` BIGINT NOT NULL COMMENT '对应reader_spending.id',
  `gross_amount_usd` DECIMAL(20,8) NOT NULL COMMENT '作品总收入（美元，高精度）',
  `author_amount_usd` DECIMAL(20,8) NOT NULL COMMENT '给作者的部分（高精度）',
  `settlement_month` DATE NOT NULL COMMENT '结算月份',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY `uniq_source_spend` (`source_spend_id`),
  KEY `idx_author_month` (`author_id`, `settlement_month`),
  KEY `idx_novel_month` (`novel_id`, `settlement_month`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='作者基础收入表';

-- 7. 推广佣金明细表
CREATE TABLE IF NOT EXISTS `commission_transaction` (
  `id` BIGINT PRIMARY KEY AUTO_INCREMENT,
  `user_id` BIGINT NOT NULL COMMENT '拿钱的人（上线）',
  `source_user_id` BIGINT NULL COMMENT '下级读者（读者推广用）',
  `source_author_id` BIGINT NULL COMMENT '下级作者（作者推广用）',
  `novel_id` BIGINT NULL COMMENT '小说ID',
  `plan_id` BIGINT NOT NULL COMMENT '使用的方案ID',
  `level` INT NOT NULL COMMENT '第几层',
  `commission_type` ENUM('reader_referral','author_referral') NOT NULL COMMENT '佣金类型',
  `base_amount_usd` DECIMAL(20,8) NOT NULL COMMENT '基础金额（美元，高精度）',
  `commission_amount_usd` DECIMAL(20,8) NOT NULL COMMENT '佣金金额（美元，高精度）',
  `reference_id` BIGINT NULL COMMENT '对应reader_spending.id或author_royalty.id',
  `settlement_month` DATE NOT NULL COMMENT '结算月份',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY `idx_user_month` (`user_id`, `settlement_month`),
  KEY `idx_commission_type` (`commission_type`, `settlement_month`),
  KEY `idx_reference` (`reference_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='推广佣金明细表';

-- 插入默认的Karma汇率（示例：1 karma = 0.01 美元）
INSERT INTO `karma_dollars` (`usd_per_karma`, `effective_from`) 
VALUES (0.01, '2025-01-01 00:00:00')
ON DUPLICATE KEY UPDATE `usd_per_karma`=`usd_per_karma`;

-- 插入默认的读者推广方案（8%/3%/2%）
INSERT INTO `commission_plan` (`name`, `plan_type`, `max_level`, `start_date`, `is_custom`) 
VALUES ('2025 Reader 8/3/2', 'reader_promoter', 3, '2025-01-01 00:00:00', 0)
ON DUPLICATE KEY UPDATE `name`=`name`;

-- 获取刚插入的方案ID并插入层级比例
SET @reader_plan_id = LAST_INSERT_ID();
INSERT INTO `commission_plan_level` (`plan_id`, `level`, `percent`) VALUES
(@reader_plan_id, 1, 0.08),
(@reader_plan_id, 2, 0.03),
(@reader_plan_id, 3, 0.02)
ON DUPLICATE KEY UPDATE `percent`=VALUES(`percent`);

-- 插入默认的作者推广方案（5%/3%/2%）
INSERT INTO `commission_plan` (`name`, `plan_type`, `max_level`, `start_date`, `is_custom`) 
VALUES ('2025 Author 5/3/2', 'author_promoter', 3, '2025-01-01 00:00:00', 0)
ON DUPLICATE KEY UPDATE `name`=`name`;

-- 获取刚插入的方案ID并插入层级比例
SET @author_plan_id = LAST_INSERT_ID();
INSERT INTO `commission_plan_level` (`plan_id`, `level`, `percent`) VALUES
(@author_plan_id, 1, 0.05),
(@author_plan_id, 2, 0.03),
(@author_plan_id, 3, 0.02)
ON DUPLICATE KEY UPDATE `percent`=VALUES(`percent`);

