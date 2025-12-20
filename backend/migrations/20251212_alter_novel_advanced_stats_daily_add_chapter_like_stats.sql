-- 迁移脚本：作品数据统计表扩展 - 新增章节点赞/点踩日增量字段
-- 执行时间：2025-12-12
-- 注意：MySQL 5.7 不支持 ADD COLUMN IF NOT EXISTS；若重复执行会报错，请先确认字段不存在再执行。

ALTER TABLE `novel_advanced_stats_daily`
  ADD COLUMN `new_chapter_likes` int NOT NULL DEFAULT 0 COMMENT '当日新增章节点赞数（动作发生且最终态为赞）' AFTER `new_comment_dislikes`,
  ADD COLUMN `new_chapter_dislikes` int NOT NULL DEFAULT 0 COMMENT '当日新增章节点踩数（动作发生且最终态为踩）' AFTER `new_chapter_likes`;


