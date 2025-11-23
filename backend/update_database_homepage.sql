-- 首页功能数据库更新脚本
-- 在现有数据库基础上添加首页相关表
-- 执行时间: 2025/1/16

-- 1. 首页推荐小说表
CREATE TABLE IF NOT EXISTS `homepage_featured_novels` (
  `id` int NOT NULL AUTO_INCREMENT,
  `novel_id` int NOT NULL COMMENT '小说ID',
  `section_type` enum('popular','new_releases','top_series','banner','recommended','trending') NOT NULL COMMENT '展示区块类型',
  `display_order` int NOT NULL DEFAULT 0 COMMENT '显示顺序，数字越小越靠前',
  `is_active` tinyint(1) DEFAULT 1 COMMENT '是否启用',
  `start_date` datetime DEFAULT NULL COMMENT '开始展示时间',
  `end_date` datetime DEFAULT NULL COMMENT '结束展示时间',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_novel_section` (`novel_id`, `section_type`),
  KEY `section_type` (`section_type`),
  KEY `display_order` (`display_order`),
  KEY `is_active` (`is_active`),
  CONSTRAINT `homepage_featured_novels_ibfk_1` FOREIGN KEY (`novel_id`) REFERENCES `novel` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. 首页轮播图管理表
CREATE TABLE IF NOT EXISTS `homepage_banners` (
  `id` int NOT NULL AUTO_INCREMENT,
  `novel_id` int DEFAULT NULL COMMENT '关联的小说ID，可为空',
  `title` varchar(255) NOT NULL COMMENT '轮播图标题',
  `subtitle` varchar(255) DEFAULT NULL COMMENT '副标题',
  `image_url` varchar(500) NOT NULL COMMENT '轮播图图片URL',
  `link_url` varchar(500) DEFAULT NULL COMMENT '点击跳转链接',
  `display_order` int NOT NULL DEFAULT 0 COMMENT '显示顺序',
  `is_active` tinyint(1) DEFAULT 1 COMMENT '是否启用',
  `start_date` datetime DEFAULT NULL COMMENT '开始展示时间',
  `end_date` datetime DEFAULT NULL COMMENT '结束展示时间',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `display_order` (`display_order`),
  KEY `is_active` (`is_active`),
  CONSTRAINT `homepage_banners_ibfk_1` FOREIGN KEY (`novel_id`) REFERENCES `novel` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. 小说统计信息表
CREATE TABLE IF NOT EXISTS `novel_statistics` (
  `id` int NOT NULL AUTO_INCREMENT,
  `novel_id` int NOT NULL,
  `date` date NOT NULL COMMENT '统计日期',
  `views` int DEFAULT 0 COMMENT '当日浏览量',
  `reads` int DEFAULT 0 COMMENT '当日阅读量',
  `favorites` int DEFAULT 0 COMMENT '当日收藏量',
  `comments` int DEFAULT 0 COMMENT '当日评论量',
  `shares` int DEFAULT 0 COMMENT '当日分享量',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_novel_date` (`novel_id`, `date`),
  KEY `date` (`date`),
  KEY `views` (`views`),
  KEY `reads` (`reads`),
  CONSTRAINT `novel_statistics_ibfk_1` FOREIGN KEY (`novel_id`) REFERENCES `novel` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. 首页配置表
CREATE TABLE IF NOT EXISTS `homepage_config` (
  `id` int NOT NULL AUTO_INCREMENT,
  `section_name` varchar(100) NOT NULL COMMENT '区块名称，如popular_this_week',
  `section_title` varchar(255) NOT NULL COMMENT '区块显示标题',
  `display_limit` int DEFAULT 6 COMMENT '显示数量限制',
  `sort_by` enum('manual','views','rating','recent','random','trending') DEFAULT 'manual' COMMENT '排序方式',
  `is_active` tinyint(1) DEFAULT 1 COMMENT '是否启用',
  `description` text COMMENT '区块描述',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `section_name` (`section_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. 小说类型表（如果不存在的话）
CREATE TABLE IF NOT EXISTS `genre` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(100) NOT NULL COMMENT '类型名称',
  `slug` varchar(100) NOT NULL COMMENT 'URL友好的名称',
  `chinese_name` text COMMENT '中文名称',
  `is_active` tinyint(1) DEFAULT 1,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `name` (`name`),
  UNIQUE KEY `slug` (`slug`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. 小说与类型关联表
CREATE TABLE IF NOT EXISTS `novel_genre_relation` (
  `id` int NOT NULL AUTO_INCREMENT,
  `novel_id` int NOT NULL,
  `genre_id_1` int NOT NULL,
  `genre_id_2` int DEFAULT NULL COMMENT '第二类型ID',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_id_novel` (`id`, `novel_id`),
  KEY `novel_id` (`novel_id`),
  KEY `genre_id_1` (`genre_id_1`),
  KEY `genre_id_2` (`genre_id_2`),
  CONSTRAINT `novel_genre_relation_ibfk_1` FOREIGN KEY (`novel_id`) REFERENCES `novel` (`id`) ON DELETE CASCADE,
  CONSTRAINT `novel_genre_relation_ibfk_2` FOREIGN KEY (`genre_id_1`) REFERENCES `genre` (`id`) ON DELETE CASCADE,
  CONSTRAINT `novel_genre_relation_ibfk_3` FOREIGN KEY (`genre_id_2`) REFERENCES `genre` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 插入默认的首页配置数据
INSERT IGNORE INTO `homepage_config` (`section_name`, `section_title`, `display_limit`, `sort_by`, `is_active`, `description`) VALUES
('popular_this_week', 'Popular This Week', 6, 'views', 1, '本周最受欢迎的小说'),
('new_releases', 'New Releases', 6, 'recent', 1, '最新发布的小说'),
('top_series', 'Top Series', 6, 'rating', 1, '评分最高的小说系列'),
('trending', 'Trending Now', 6, 'trending', 1, '当前热门小说'),
('recommended', 'Recommended For You', 6, 'random', 1, '为你推荐');

-- 插入默认的小说类型数据
INSERT IGNORE INTO `genre` (`name`, `slug`, `chinese_name`, `is_active`) VALUES
('Fantasy', 'fantasy', '奇幻小说', 1),
('Romance', 'romance', '言情小说', 1),
('Action', 'action', '动作冒险', 1),
('Comedy', 'comedy', '喜剧小说', 1),
('Drama', 'drama', '戏剧小说', 1),
('Mystery', 'mystery', '悬疑小说', 1),
('Sci-fi', 'sci-fi', '科幻小说', 1),
('Historical', 'historical', '历史小说', 1);

-- 创建索引优化查询性能
CREATE INDEX IF NOT EXISTS idx_homepage_featured_novels_active_order ON homepage_featured_novels (is_active, display_order);
CREATE INDEX IF NOT EXISTS idx_homepage_banners_active_order ON homepage_banners (is_active, display_order);
CREATE INDEX IF NOT EXISTS idx_novel_statistics_date_views ON novel_statistics (date, views DESC);
CREATE INDEX IF NOT EXISTS idx_novel_statistics_date_reads ON novel_statistics (date, reads DESC);

-- 为现有小说添加一些示例数据到首页推荐表
-- 注意：这里假设你已经有一些小说数据，如果没有，可以跳过这部分
INSERT IGNORE INTO `homepage_featured_novels` (`novel_id`, `section_type`, `display_order`, `is_active`) 
SELECT id, 'popular', id, 1 FROM novel WHERE id IN (1, 2, 3) LIMIT 3;

INSERT IGNORE INTO `homepage_featured_novels` (`novel_id`, `section_type`, `display_order`, `is_active`) 
SELECT id, 'new_releases', id, 1 FROM novel WHERE id IN (1, 2, 3) LIMIT 3;

INSERT IGNORE INTO `homepage_featured_novels` (`novel_id`, `section_type`, `display_order`, `is_active`) 
SELECT id, 'top_series', id, 1 FROM novel WHERE id IN (1, 2, 3) LIMIT 3;
