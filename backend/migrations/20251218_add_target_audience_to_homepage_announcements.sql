-- 为 homepage_announcements 表添加 target_audience 字段
-- 用途：区分读者端公告和作者端公告
-- 说明：reader=读者端，writer=作者端

ALTER TABLE `homepage_announcements`
ADD COLUMN `target_audience` ENUM('reader','writer') NOT NULL DEFAULT 'reader' COMMENT '目标受众：reader=读者端，writer=作者端' AFTER `content_format`;

-- 添加索引以优化查询
ALTER TABLE `homepage_announcements`
ADD KEY `idx_target_audience_active` (`target_audience`, `is_active`);

-- 更新现有数据：根据标题或内容判断，如果没有明确标识则默认为 reader
-- 注意：这里只是示例，实际应根据业务需求调整
-- 如果现有公告都是读者端的，可以跳过此 UPDATE
-- UPDATE homepage_announcements SET target_audience = 'reader' WHERE target_audience IS NULL;

