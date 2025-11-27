-- 迁移022：为 chapter_review_log 表添加唯一约束
-- 目的：确保每个 (chapter_id, admin_id) 组合只有一条记录，记录最终审核结果

-- 1. 清理历史重复数据：保留 created_at 最大的一条，删除其他
-- 注意：执行前请先备份数据
DELETE t1 FROM chapter_review_log t1
INNER JOIN chapter_review_log t2
WHERE t1.chapter_id = t2.chapter_id
  AND t1.admin_id = t2.admin_id
  AND t1.id < t2.id;

-- 2. 添加唯一约束
ALTER TABLE `chapter_review_log`
  ADD UNIQUE KEY `uniq_chapter_admin` (`chapter_id`, `admin_id`);

