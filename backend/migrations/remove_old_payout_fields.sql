-- 迁移脚本：删除 user_payout 表中的旧字段
-- 执行日期：2025-01-XX
-- 说明：删除 amount_usd, currency, threshold_flag, approved_at 字段

-- ============================================
-- 删除 user_payout 表中的旧字段
-- ============================================

-- 1. 删除 amount_usd 字段（已被 base_amount_usd 替代）
ALTER TABLE `user_payout` DROP COLUMN `amount_usd`;

-- 2. 删除 currency 字段（已被 payout_currency 替代）
ALTER TABLE `user_payout` DROP COLUMN `currency`;

-- 3. 删除 threshold_flag 字段（不再需要）
ALTER TABLE `user_payout` DROP COLUMN `threshold_flag`;

-- 4. 删除 approved_at 字段（不再需要审核流程）
ALTER TABLE `user_payout` DROP COLUMN `approved_at`;

-- 完成
SELECT 'Migration completed: Removed amount_usd, currency, threshold_flag, approved_at from user_payout table' AS result;

