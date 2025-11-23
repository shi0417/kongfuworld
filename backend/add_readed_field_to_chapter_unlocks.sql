-- 为 chapter_unlocks 表添加 readed 字段
-- 用于标记时间解锁记录是否已被用户阅读

ALTER TABLE chapter_unlocks 
ADD COLUMN readed TINYINT(1) DEFAULT 0 COMMENT '是否已阅读：0-未读，1-已读';

-- 为现有记录设置默认值
UPDATE chapter_unlocks SET readed = 0 WHERE readed IS NULL;
