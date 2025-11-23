-- 迁移脚本：删除 payout_gateway_transaction 表中的旧字段
-- 执行日期：2025-01-XX
-- 说明：删除 provider_batch_id, amount_usd, currency, callback_payload 字段

-- ============================================
-- 删除 payout_gateway_transaction 表中的旧字段
-- ============================================

-- 1. 删除 provider_batch_id 字段
ALTER TABLE `payout_gateway_transaction` DROP COLUMN `provider_batch_id`;

-- 2. 删除 amount_usd 字段（已被 base_amount_usd 替代）
ALTER TABLE `payout_gateway_transaction` DROP COLUMN `amount_usd`;

-- 3. 删除 currency 字段（已被 payout_currency 替代）
ALTER TABLE `payout_gateway_transaction` DROP COLUMN `currency`;

-- 4. 删除 callback_payload 字段（不再需要）
ALTER TABLE `payout_gateway_transaction` DROP COLUMN `callback_payload`;

-- 完成
SELECT 'Migration completed: Removed provider_batch_id, amount_usd, currency, callback_payload from payout_gateway_transaction table' AS result;

