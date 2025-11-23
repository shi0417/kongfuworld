-- 为favorite表添加updated_at字段
-- 执行时间: 2024年

-- 添加updated_at字段
ALTER TABLE favorite ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP;

-- 为现有记录设置updated_at为当前时间
UPDATE favorite SET updated_at = NOW() WHERE updated_at IS NULL;

-- 验证字段添加成功
DESCRIBE favorite;
