-- 为unlockprice表添加唯一约束，确保user_id和novel_id的组合唯一
-- 执行时间：2025-01-XX
-- 说明：此脚本会为unlockprice表添加唯一约束，防止同一用户同一小说的重复记录

-- 1. 检查是否存在重复数据
SELECT user_id, novel_id, COUNT(*) as count
FROM unlockprice
GROUP BY user_id, novel_id
HAVING COUNT(*) > 1;

-- 2. 如果存在重复数据，需要先清理（保留id最小的记录）
-- 注意：执行前请先备份数据！
-- 如果需要清理重复数据，请取消下面的注释并执行：
/*
DELETE t1 FROM unlockprice t1
INNER JOIN unlockprice t2 
WHERE t1.id > t2.id 
  AND t1.user_id = t2.user_id 
  AND t1.novel_id = t2.novel_id;
*/

-- 3. 删除现有的复合索引（如果存在）
-- 注意：如果索引不存在，会报错但可以忽略
DROP INDEX IF EXISTS idx_user_novel ON unlockprice;

-- 4. 添加唯一约束（UNIQUE约束会自动创建唯一索引）
-- 如果唯一约束已存在，会报错但可以忽略
ALTER TABLE unlockprice
ADD UNIQUE KEY uk_user_novel (user_id, novel_id);

-- 5. 验证唯一约束是否创建成功
SHOW CREATE TABLE unlockprice;

-- 6. 验证唯一索引
SHOW INDEX FROM unlockprice WHERE Key_name = 'uk_user_novel';

