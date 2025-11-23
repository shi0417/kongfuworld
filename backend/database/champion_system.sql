-- Champion会员系统数据库设计
-- 创建时间: 2025-01-27

-- 1. 小说Champion基础配置表
CREATE TABLE `novel_champion_config` (
  `id` int NOT NULL AUTO_INCREMENT,
  `novel_id` int NOT NULL,
  `max_advance_chapters` int DEFAULT 65,        -- 最大预读章节数
  `total_chapters` int DEFAULT 0,               -- 总章节数
  `published_chapters` int DEFAULT 0,           -- 已发布章节数
  `free_chapters_per_day` int DEFAULT 2,        -- 每日免费章节数
  `unlock_interval_hours` int DEFAULT 23,      -- 解锁间隔（小时）
  `champion_theme` varchar(50) DEFAULT 'martial', -- 主题风格
  `is_active` tinyint(1) DEFAULT 1,             -- 是否启用Champion功能
  `is_customized` tinyint(1) DEFAULT 0,         -- 是否已自定义配置（0=使用默认，1=已自定义）
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_novel` (`novel_id`),
  FOREIGN KEY (`novel_id`) REFERENCES `novel`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Champion等级配置表
CREATE TABLE `novel_champion_tiers` (
  `id` int NOT NULL AUTO_INCREMENT,
  `novel_id` int NOT NULL,
  `tier_level` int NOT NULL,                    -- 等级序号（1-13）
  `tier_name` varchar(100) NOT NULL,           -- 等级名称
  `monthly_price` decimal(10,2) NOT NULL,      -- 月费
  `advance_chapters` int NOT NULL,             -- 预读章节数
  `description` text,                          -- 描述
  `is_active` tinyint(1) DEFAULT 1,            -- 是否启用
  `sort_order` int DEFAULT 0,                  -- 排序
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_novel_tier` (`novel_id`, `tier_level`),
  FOREIGN KEY (`novel_id`) REFERENCES `novel`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. 用户Champion订阅表
CREATE TABLE `user_champion_subscription` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `novel_id` int NOT NULL,
  `tier_level` int NOT NULL,                   -- Champion等级
  `tier_name` varchar(100) NOT NULL,           -- 等级名称
  `monthly_price` decimal(10,2) NOT NULL,      -- 月费
  `start_date` datetime NOT NULL,              -- 订阅开始时间
  `end_date` datetime NOT NULL,                -- 订阅结束时间
  `is_active` tinyint(1) DEFAULT 1,           -- 是否激活
  `payment_method` varchar(50),                -- 支付方式
  `auto_renew` tinyint(1) DEFAULT 1,           -- 是否自动续费
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_user_novel` (`user_id`, `novel_id`),
  FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`novel_id`) REFERENCES `novel`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. 章节发布计划表
CREATE TABLE `chapter_release_schedule` (
  `id` int NOT NULL AUTO_INCREMENT,
  `novel_id` int NOT NULL,
  `chapter_number` int NOT NULL,               -- 章节号
  `chapter_id` int,                            -- 章节ID（如果已创建）
  `release_date` datetime NOT NULL,            -- 计划发布时间
  `is_advance` tinyint(1) DEFAULT 0,           -- 是否为预读章节
  `advance_tier` int DEFAULT NULL,              -- 预读章节等级
  `is_published` tinyint(1) DEFAULT 0,          -- 是否已发布
  `published_at` datetime NULL,                 -- 实际发布时间
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_novel_chapter` (`novel_id`, `chapter_number`),
  FOREIGN KEY (`novel_id`) REFERENCES `novel`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. 默认Champion等级配置表（系统级配置）
CREATE TABLE `default_champion_tiers` (
  `id` int NOT NULL AUTO_INCREMENT,
  `tier_level` int NOT NULL,
  `tier_name` varchar(100) NOT NULL,
  `monthly_price` decimal(10,2) NOT NULL,
  `advance_chapters` int NOT NULL,
  `description` text,
  `is_active` tinyint(1) DEFAULT 1,
  `sort_order` int DEFAULT 0,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_tier_level` (`tier_level`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 插入默认Champion等级配置
INSERT INTO `default_champion_tiers` VALUES
(1, 1, 'Martial Cultivator', 1.00, 1, 'ONE advance chapter', 1, 1, NOW()),
(2, 2, 'Profound Realm', 3.00, 2, 'TWO advance chapters', 1, 2, NOW()),
(3, 3, 'Martial Lord', 5.00, 3, 'THREE advance chapters', 1, 3, NOW()),
(4, 4, 'Martial King', 10.00, 5, 'FIVE advance chapters', 1, 4, NOW()),
(5, 5, 'Half Martial Emperor', 15.00, 8, 'EIGHT advance chapters', 1, 5, NOW()),
(6, 6, 'Martial Emperor', 20.00, 10, 'TEN advance chapters', 1, 6, NOW()),
(7, 7, 'Half Martial Ancestor', 25.00, 15, 'FIFTEEN advance chapters', 1, 7, NOW()),
(8, 8, 'Martial Ancestor', 40.00, 20, 'TWENTY advance chapters', 1, 8, NOW()),
(9, 9, 'True Immortal', 55.00, 25, 'TWENTY-FIVE advance chapters', 1, 9, NOW()),
(10, 10, 'Heavenly Immortal', 70.00, 30, 'THIRTY advance chapters', 1, 10, NOW()),
(11, 11, 'Martial Immortal', 100.00, 40, 'FORTY advance chapters', 1, 11, NOW()),
(12, 12, 'Exalted', 125.00, 50, 'FIFTY advance chapters', 1, 12, NOW()),
(13, 13, 'Utmost Exalted', 160.00, 65, 'SIXTY-FIVE advance chapters', 1, 13, NOW());
