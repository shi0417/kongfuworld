-- 迁移脚本：为review表添加parent_id字段，为paragraph_comment和comment表添加novel_id字段
-- 执行时间: 2025-01-XX

-- 1. 为review表添加parent_id字段，用于存储子评论
ALTER TABLE `review` 
ADD COLUMN `parent_id` int DEFAULT NULL COMMENT '父评论ID，用于存储对该评论的子评论' AFTER `id`,
ADD KEY `idx_parent_id` (`parent_id`);

-- 2. 为paragraph_comment表添加novel_id字段
ALTER TABLE `paragraph_comment` 
ADD COLUMN `novel_id` int DEFAULT NULL COMMENT '小说ID，从chapter表关联获取' AFTER `chapter_id`,
ADD KEY `idx_novel_id` (`novel_id`);

-- 3. 为comment表添加novel_id字段
ALTER TABLE `comment` 
ADD COLUMN `novel_id` int DEFAULT NULL COMMENT '小说ID，从chapter表关联获取（仅当target_type=chapter时）' AFTER `target_id`,
ADD KEY `idx_novel_id` (`novel_id`);

-- 4. 填充paragraph_comment表的novel_id字段
UPDATE `paragraph_comment` pc
INNER JOIN `chapter` c ON pc.chapter_id = c.id
SET pc.novel_id = c.novel_id
WHERE pc.novel_id IS NULL;

-- 5. 填充comment表的novel_id字段（仅target_type=chapter的记录）
UPDATE `comment` com
INNER JOIN `chapter` c ON com.target_id = c.id
SET com.novel_id = c.novel_id
WHERE com.target_type = 'chapter' AND com.novel_id IS NULL;

