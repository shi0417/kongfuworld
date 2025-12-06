-- 添加章节唯一约束：同一小说不能有重复的章节号
-- Migration: Add unique constraint on (novel_id, chapter_number) for chapter table

-- 首先检查并删除可能存在的重复数据（保留ID最小的记录）
-- 注意：在生产环境执行前，请先备份数据并检查重复情况

-- 删除重复的章节（保留ID最小的）
DELETE c1 FROM chapter c1
INNER JOIN chapter c2 
WHERE c1.novel_id = c2.novel_id 
  AND c1.chapter_number = c2.chapter_number 
  AND c1.id > c2.id;

-- 添加唯一约束
ALTER TABLE chapter
ADD UNIQUE KEY `unique_novel_chapter` (`novel_id`, `chapter_number`);

