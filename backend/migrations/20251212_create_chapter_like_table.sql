-- 迁移脚本：新增章节点赞/点踩表 chapter_like
-- 执行时间：2025-12-12
-- 说明：created_at 作为“最后一次动作时间”，与现有 like 系统保持一致（update 时会同步更新 created_at=NOW()）

CREATE TABLE IF NOT EXISTS `chapter_like` (
  `id` int NOT NULL AUTO_INCREMENT,
  `chapter_id` int NOT NULL,
  `user_id` int NOT NULL,
  `is_like` tinyint(1) NOT NULL COMMENT '1=like,0=dislike',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '最后一次动作时间（与现有 like 系统一致）',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_chapter_user` (`chapter_id`, `user_id`),
  KEY `idx_chapter_created_at` (`chapter_id`, `created_at`),
  KEY `idx_user_created_at` (`user_id`, `created_at`),
  CONSTRAINT `fk_chapter_like_chapter_id` FOREIGN KEY (`chapter_id`) REFERENCES `chapter` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_chapter_like_user_id` FOREIGN KEY (`user_id`) REFERENCES `user` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='章节点赞/点踩明细表';


