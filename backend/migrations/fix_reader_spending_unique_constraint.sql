-- 修复 reader_spending 表的唯一约束
-- 问题：原来的 uniq_source (source_type, source_id) 不允许同一个订阅记录跨月拆分
-- 解决：将 settlement_month 也包含到唯一约束中

-- 1. 删除旧的唯一约束
ALTER TABLE reader_spending DROP INDEX uniq_source;

-- 2. 添加新的唯一约束（包含 settlement_month）
ALTER TABLE reader_spending 
ADD UNIQUE KEY `uniq_source_month` (`source_type`, `source_id`, `settlement_month`);

-- 注意：这样同一个 source_id 可以在不同月份有多条记录，支持订阅跨月拆分

