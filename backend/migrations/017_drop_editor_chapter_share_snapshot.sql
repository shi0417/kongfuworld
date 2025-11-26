-- 删除 editor_chapter_share_snapshot 表
-- 章节归属统一以 chapter.editor_admin_id 为准，不再需要快照表

DROP TABLE IF EXISTS `editor_chapter_share_snapshot`;

