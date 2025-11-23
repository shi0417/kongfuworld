-- 修改 notifications 表结构
-- 删除 unlock_at 字段，添加 updated_at 字段

-- 删除 unlock_at 字段
ALTER TABLE notifications DROP COLUMN unlock_at;

-- 添加 updated_at 字段
ALTER TABLE notifications 
ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间';
