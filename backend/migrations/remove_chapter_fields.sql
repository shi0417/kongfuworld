-- 迁移脚本：删除 chapter 表中的冗余字段
-- 执行日期：2025-01-XX
-- 
-- 删除的字段：
-- 1. is_locked - 用 unlock_price > 0 代替
-- 2. is_premium - 用 unlock_price > 0 代替
-- 3. is_visible - 用 review_status = 'approved' 代替
-- 4. is_vip_only - 未使用，删除
-- 5. prev_chapter_id - 未使用，可通过查询获取

-- 注意：在执行此脚本前，请确保：
-- 1. 已备份数据库
-- 2. 所有相关代码已更新为使用新的判断逻辑

-- 删除字段
ALTER TABLE `chapter` 
  DROP COLUMN `is_locked`,
  DROP COLUMN `is_premium`,
  DROP COLUMN `is_visible`,
  DROP COLUMN `is_vip_only`,
  DROP COLUMN `prev_chapter_id`;

-- 验证：检查是否还有数据需要迁移（可选）
-- SELECT COUNT(*) as locked_count FROM chapter WHERE unlock_price > 0;
-- SELECT COUNT(*) as visible_count FROM chapter WHERE review_status = 'approved';

