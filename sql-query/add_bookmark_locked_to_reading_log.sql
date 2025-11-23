-- 为reading_log表添加bookmark_locked字段
-- 执行时间: 2024年

-- 添加bookmark_locked字段
ALTER TABLE reading_log ADD COLUMN bookmark_locked TINYINT(1) DEFAULT 0 COMMENT '书签锁定状态：0-未锁定，1-已锁定';

-- 为现有记录设置默认值
UPDATE reading_log SET bookmark_locked = 0 WHERE bookmark_locked IS NULL;

-- 验证字段添加成功
DESCRIBE reading_log;

-- 查看示例数据
SELECT id, user_id, chapter_id, read_at, bookmark_locked FROM reading_log LIMIT 5;
