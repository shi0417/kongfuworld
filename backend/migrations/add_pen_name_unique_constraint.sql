-- 为pen_name字段添加唯一约束
-- 注意：MySQL的唯一索引允许NULL值，所以多个NULL值不会冲突
-- 如果需要确保笔名不能为空，需要先添加NOT NULL约束

-- 先删除普通索引（如果存在）
ALTER TABLE `user` DROP INDEX `idx_pen_name`;

-- 添加唯一索引
ALTER TABLE `user` ADD UNIQUE KEY `unique_pen_name` (`pen_name`);

