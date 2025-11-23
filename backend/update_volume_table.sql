-- 更新volume表结构，添加新字段
ALTER TABLE `volume` 
ADD COLUMN `start_chapter` int DEFAULT NULL COMMENT '起始章节号' AFTER `title`,
ADD COLUMN `end_chapter` int DEFAULT NULL COMMENT '结束章节号' AFTER `start_chapter`,
ADD COLUMN `chapter_count` int DEFAULT 0 COMMENT '章节数量' AFTER `end_chapter`;
