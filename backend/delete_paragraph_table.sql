-- 删除未使用的 paragraph 表
-- 注意：此表没有数据，也没有其他表依赖它，可以安全删除

-- 1. 删除外键约束
ALTER TABLE `paragraph` DROP FOREIGN KEY IF EXISTS `paragraph_ibfk_1`;

-- 2. 删除表
DROP TABLE IF EXISTS `paragraph`;

