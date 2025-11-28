-- 迁移025：删除 novel 表中的 requires_chief_edit 字段
-- requires_chief_edit 改为运行时计算字段（基于是否有有效主编合同），删除数据库列

-- 注意：MySQL 不支持 DROP INDEX IF EXISTS 和 DROP COLUMN IF EXISTS 语法
-- 如果索引/字段不存在，执行会报错，但迁移脚本会捕获并忽略这些错误

-- 1. 删除索引（如果存在）
DROP INDEX `idx_requires_chief_edit` ON `novel`;

-- 2. 删除字段
ALTER TABLE `novel`
  DROP COLUMN `requires_chief_edit`;

