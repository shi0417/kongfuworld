-- 创建举报表（report）
-- 用于存储用户举报的评论信息
-- 创建时间: 2025-01-XX

CREATE TABLE IF NOT EXISTS `report` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT '主键，自增',
  `user_id` int NOT NULL COMMENT '举报用户的ID',
  `type` enum('review','comment','paragraph_comment') NOT NULL COMMENT '举报类型：review=评价, comment=评论, paragraph_comment=段落评论',
  `remark_id` int NOT NULL COMMENT '被举报内容的ID（根据type对应review.id、comment.id或paragraph_comment.id）',
  `report` enum('Spoilers','Abuse or harassment','Spam','Copyright infringement','Discrimination (racism, sexism, etc.)','Request to delete a comment that you created') NOT NULL COMMENT '举报原因',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_type_remark_id` (`type`, `remark_id`),
  KEY `idx_created_at` (`created_at`),
  CONSTRAINT `report_ibfk_user` FOREIGN KEY (`user_id`) REFERENCES `user` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户举报表';

