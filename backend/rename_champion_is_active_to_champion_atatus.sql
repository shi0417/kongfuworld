-- 删除 novel 表的 champion_is_active 字段，新增 champion_status 字段
-- champion_status 字段类型为 ENUM，包含4个状态：
-- 1. submitted - 提交中
-- 2. invalid - 无效（默认值）
-- 3. approved - 审核通过
-- 4. rejected - 审核不通过

-- 1. 如果 champion_atatus 字段已存在（之前的拼写错误），先删除它
-- 注意：如果字段不存在，此语句会报错，可以忽略
ALTER TABLE `novel` 
DROP COLUMN `champion_atatus`;

-- 2. 如果 champion_status 字段已存在，先删除它（确保重新创建）
-- 注意：如果字段不存在，此语句会报错，可以忽略
ALTER TABLE `novel` 
DROP COLUMN `champion_status`;

-- 3. 添加新字段 champion_status
ALTER TABLE `novel` 
ADD COLUMN `champion_status` ENUM('submitted', 'invalid', 'approved', 'rejected') 
DEFAULT 'invalid' 
NOT NULL
COMMENT 'Champion会员状态: submitted=提交中, invalid=无效, approved=审核通过, rejected=审核不通过'
AFTER `review_status`;

-- 4. 迁移现有数据：将 champion_is_active 的值转换为新字段
-- 注意：如果 champion_is_active 字段不存在，请先注释掉此段
-- 0 -> invalid, 1 -> approved (假设1表示已启用/审核通过)
UPDATE `novel` 
SET `champion_status` = CASE 
  WHEN `champion_is_active` = 0 OR `champion_is_active` IS NULL THEN 'invalid'
  WHEN `champion_is_active` = 1 THEN 'approved'
  ELSE 'invalid'
END;

-- 5. 确保所有NULL值设置为默认值 'invalid'（双重保险）
UPDATE `novel` 
SET `champion_status` = 'invalid' 
WHERE `champion_status` IS NULL;

-- 6. 删除旧字段 champion_is_active
-- 注意：如果字段不存在，此语句会报错，可以忽略
ALTER TABLE `novel` 
DROP COLUMN `champion_is_active`;

