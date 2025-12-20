-- 公告评论系统：newscomment / newscomment_like
-- 约定：
-- - newscomment.target_id = newscomment.homepage_announcements_id（冗余一致，便于复用 chapter comment 模式）
-- - 点赞点踩使用单表 newscomment_like + is_like（1=like,0=dislike）

-- 注意：homepage_announcements.content_format 已有迁移文件：
--   backend/migrations/20251214_add_homepage_announcements_content_format.sql

CREATE TABLE IF NOT EXISTS `newscomment` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `target_id` int NOT NULL COMMENT '冗余：= homepage_announcements_id',
  `homepage_announcements_id` int NOT NULL,
  `parent_comment_id` int DEFAULT NULL,
  `content` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `likes` int NOT NULL DEFAULT 0,
  `dislikes` int NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  KEY `idx_news_id` (`homepage_announcements_id`),
  KEY `idx_parent` (`parent_comment_id`),
  KEY `idx_created_at` (`created_at`),
  CONSTRAINT `fk_newscomment_user` FOREIGN KEY (`user_id`) REFERENCES `user` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_newscomment_announcement` FOREIGN KEY (`homepage_announcements_id`) REFERENCES `homepage_announcements` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='公告评论（楼中楼：parent_comment_id）';

CREATE TABLE IF NOT EXISTS `newscomment_like` (
  `id` int NOT NULL AUTO_INCREMENT,
  `newscomment_id` int NOT NULL,
  `user_id` int NOT NULL,
  `is_like` tinyint(1) NOT NULL COMMENT '1=like,0=dislike',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_newscomment_user` (`newscomment_id`, `user_id`),
  KEY `idx_user_id` (`user_id`),
  CONSTRAINT `fk_newscomment_like_comment` FOREIGN KEY (`newscomment_id`) REFERENCES `newscomment` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_newscomment_like_user` FOREIGN KEY (`user_id`) REFERENCES `user` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='公告评论点赞/点踩（单表 is_like）';


