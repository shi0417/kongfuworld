-- 修复comment表的target_type字段，添加'review'类型
ALTER TABLE comment MODIFY COLUMN target_type enum('novel','chapter','paragraph','review') NOT NULL;
