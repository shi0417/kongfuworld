-- 迁移脚本：创建作品数据评价系统的统计表
-- 执行时间: 2025-01-XX
-- 说明：创建 novel_advanced_stats_daily 和 novel_overall_scores 两张表

-- 1. 创建 novel_advanced_stats_daily 表（每日高级统计表）
CREATE TABLE IF NOT EXISTS `novel_advanced_stats_daily` (
  `id` int NOT NULL AUTO_INCREMENT,
  `novel_id` int NOT NULL COMMENT '小说ID',
  `stat_date` date NOT NULL COMMENT '统计日期',
  -- 基础访问指标
  `views` int DEFAULT 0 COMMENT '当日浏览量',
  `unique_readers` int DEFAULT 0 COMMENT '当日唯一读者数',
  `views_24h` int DEFAULT 0 COMMENT '24小时浏览量',
  `views_7d` int DEFAULT 0 COMMENT '7天浏览量',
  -- 阅读深度指标
  `effective_reads` int DEFAULT 0 COMMENT '有效阅读数（停留时间>阈值）',
  `avg_stay_duration_sec` decimal(10,2) DEFAULT 0 COMMENT '平均停留时长（秒）',
  `finish_rate` decimal(5,4) DEFAULT 0 COMMENT '完成率（阅读完整章节的用户比例）',
  `avg_read_chapters_per_user` decimal(10,2) DEFAULT 0 COMMENT '平均每用户阅读章节数',
  -- 解锁相关指标
  `paid_unlock_count` int DEFAULT 0 COMMENT '付费解锁次数（钥匙/业力）',
  `time_unlock_count` int DEFAULT 0 COMMENT '时间解锁次数',
  `paid_reader_count` int DEFAULT 0 COMMENT '付费读者数（至少解锁一章付费章节的用户数）',
  -- 收入指标
  `chapter_revenue` decimal(10,2) DEFAULT 0 COMMENT '章节解锁收入（钥匙/业力）',
  `champion_revenue` decimal(10,2) DEFAULT 0 COMMENT 'Champion订阅收入',
  `champion_active_count` int DEFAULT 0 COMMENT '活跃Champion订阅用户数',
  -- 评价指标
  `rating_count` int DEFAULT 0 COMMENT '当日新增评价数',
  `rating_sum` int DEFAULT 0 COMMENT '当日新增评价总分',
  `avg_rating_snapshot` decimal(3,2) DEFAULT 0 COMMENT '当日平均评分快照',
  -- 社区互动指标
  `new_comments` int DEFAULT 0 COMMENT '当日新增评论数',
  `new_paragraph_comments` int DEFAULT 0 COMMENT '当日新增段落评论数',
  `new_comment_likes` int DEFAULT 0 COMMENT '当日新增评论点赞数',
  `new_comment_dislikes` int DEFAULT 0 COMMENT '当日新增评论点踩数',
  `new_chapter_likes` int NOT NULL DEFAULT 0 COMMENT '当日新增章节点赞数（动作发生且最终态为赞）',
  `new_chapter_dislikes` int NOT NULL DEFAULT 0 COMMENT '当日新增章节点踩数（动作发生且最终态为踩）',
  -- 时间戳
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_novel_date` (`novel_id`, `stat_date`),
  KEY `idx_stat_date` (`stat_date`),
  KEY `idx_novel_id` (`novel_id`),
  CONSTRAINT `novel_advanced_stats_daily_ibfk_1` FOREIGN KEY (`novel_id`) REFERENCES `novel` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. 创建 novel_overall_scores 表（综合评分表）
CREATE TABLE IF NOT EXISTS `novel_overall_scores` (
  `novel_id` int NOT NULL COMMENT '小说ID',
  -- 累计基础数据
  `total_views` int DEFAULT 0 COMMENT '累计浏览量',
  `total_unique_readers` int DEFAULT 0 COMMENT '累计唯一读者数',
  `total_chapter_revenue` decimal(10,2) DEFAULT 0 COMMENT '累计章节解锁收入',
  `total_champion_revenue` decimal(10,2) DEFAULT 0 COMMENT '累计Champion订阅收入',
  `total_comments` int DEFAULT 0 COMMENT '累计评论数',
  `total_paragraph_comments` int DEFAULT 0 COMMENT '累计段落评论数',
  -- 评价数据
  `avg_rating` decimal(3,2) DEFAULT 0 COMMENT '平均评分',
  `rating_count` int DEFAULT 0 COMMENT '评价总数',
  -- 维度评分（0-100分）
  `popularity_score` decimal(5,2) DEFAULT 0 COMMENT '热度评分',
  `engagement_score` decimal(5,2) DEFAULT 0 COMMENT '参与度评分',
  `monetization_score` decimal(5,2) DEFAULT 0 COMMENT '变现能力评分',
  `reputation_score` decimal(5,2) DEFAULT 0 COMMENT '口碑评分',
  `community_score` decimal(5,2) DEFAULT 0 COMMENT '社区活跃度评分',
  -- 综合评分
  `final_score` decimal(5,2) DEFAULT 0 COMMENT '综合评分（加权平均）',
  -- 时间戳
  `last_calculated_at` datetime DEFAULT NULL COMMENT '最后计算时间',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`novel_id`),
  CONSTRAINT `novel_overall_scores_ibfk_1` FOREIGN KEY (`novel_id`) REFERENCES `novel` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

