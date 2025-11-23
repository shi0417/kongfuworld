-- 迁移脚本：将支付系统改为"一个用户一个月一笔支付单"模型
-- 执行日期：2025-01-XX
-- 说明：取消100美元门槛，取消user_payout_item表，加入USD/CNY双币支付+汇率记录

-- ============================================
-- 第一步：修改 user_income_monthly 表
-- ============================================

-- 1.1 修改 payout_status 枚举值（移除 partially_paid）
ALTER TABLE `user_income_monthly` 
MODIFY COLUMN `payout_status` ENUM('unpaid','paid') NOT NULL DEFAULT 'unpaid' COMMENT '支付状态';

-- 1.2 添加 payout_id 字段（指向 user_payout.id）
ALTER TABLE `user_income_monthly` 
ADD COLUMN `payout_id` BIGINT NULL COMMENT '对应 user_payout.id' AFTER `payout_status`;

-- 1.3 移除 paid_amount_usd 字段（不再需要，因为一个月只有一笔支付单）
-- 注意：如果表中有数据，先备份再删除
-- ALTER TABLE `user_income_monthly` DROP COLUMN `paid_amount_usd`;

-- ============================================
-- 第二步：修改 user_payout 表
-- ============================================

-- 2.1 添加新字段
ALTER TABLE `user_payout`
ADD COLUMN `month` DATE NULL COMMENT '对应哪个月份' AFTER `user_id`,
ADD COLUMN `income_monthly_id` BIGINT NULL COMMENT '指向 user_income_monthly.id' AFTER `month`,
ADD COLUMN `base_amount_usd` DECIMAL(10,6) NULL COMMENT '该月美元收入 total_income_usd（记账基准）' AFTER `income_monthly_id`,
ADD COLUMN `payout_currency` CHAR(3) NULL COMMENT '实际支付币种：USD 或 CNY' AFTER `base_amount_usd`,
ADD COLUMN `payout_amount` DECIMAL(10,2) NULL COMMENT '实际支付金额（按 fx_rate 换算后，2位小数）' AFTER `payout_currency`,
ADD COLUMN `fx_rate` DECIMAL(12,6) NULL COMMENT '1 USD = fx_rate * payout_currency' AFTER `payout_amount`;

-- 2.2 修改 status 枚举值（改为新的状态）
ALTER TABLE `user_payout`
MODIFY COLUMN `status` ENUM('pending','processing','paid','failed','cancelled') NOT NULL DEFAULT 'pending' COMMENT '状态';

-- 2.3 修改 method 枚举值（移除 manual，改为 bank_transfer）
ALTER TABLE `user_payout`
MODIFY COLUMN `method` ENUM('paypal','bank_transfer','alipay','wechat','manual') NOT NULL COMMENT '支付方式';

-- 2.4 迁移现有数据：将 amount_usd 复制到 base_amount_usd，currency 复制到 payout_currency
-- 注意：需要根据实际情况调整
UPDATE `user_payout` 
SET `base_amount_usd` = `amount_usd`,
    `payout_currency` = `currency`,
    `payout_amount` = `amount_usd`,
    `fx_rate` = CASE WHEN `currency` = 'USD' THEN 1.000000 ELSE NULL END
WHERE `base_amount_usd` IS NULL;

-- 2.5 添加唯一索引：一个用户一个月只能有一笔支付单
ALTER TABLE `user_payout`
ADD UNIQUE KEY `uniq_user_month_payout` (`user_id`, `month`);

-- 2.6 将新字段设为 NOT NULL（在数据迁移完成后）
-- ALTER TABLE `user_payout`
-- MODIFY COLUMN `month` DATE NOT NULL,
-- MODIFY COLUMN `income_monthly_id` BIGINT NOT NULL,
-- MODIFY COLUMN `base_amount_usd` DECIMAL(10,6) NOT NULL,
-- MODIFY COLUMN `payout_currency` CHAR(3) NOT NULL,
-- MODIFY COLUMN `payout_amount` DECIMAL(10,2) NOT NULL,
-- MODIFY COLUMN `fx_rate` DECIMAL(12,6) NOT NULL;

-- ============================================
-- 第三步：修改 payout_gateway_transaction 表
-- ============================================

-- 3.1 添加汇率相关字段
ALTER TABLE `payout_gateway_transaction`
ADD COLUMN `base_amount_usd` DECIMAL(10,6) NULL COMMENT '记账美元金额' AFTER `status`,
ADD COLUMN `payout_currency` CHAR(3) NULL COMMENT '实际支付币种' AFTER `base_amount_usd`,
ADD COLUMN `payout_amount` DECIMAL(10,2) NULL COMMENT '实际支付金额' AFTER `payout_currency`,
ADD COLUMN `fx_rate` DECIMAL(12,6) NULL COMMENT '汇率：1 USD = fx_rate * payout_currency' AFTER `payout_amount`;

-- 3.2 迁移现有数据
UPDATE `payout_gateway_transaction`
SET `base_amount_usd` = `amount_usd`,
    `payout_currency` = `currency`,
    `payout_amount` = `amount_usd`,
    `fx_rate` = CASE WHEN `currency` = 'USD' THEN 1.000000 ELSE NULL END
WHERE `base_amount_usd` IS NULL;

-- 3.3 修改 provider 枚举值（确保包含 bank_manual）
ALTER TABLE `payout_gateway_transaction`
MODIFY COLUMN `provider` ENUM('paypal','stripe','alipay','wechat','bank_manual') NOT NULL COMMENT '支付渠道';

-- ============================================
-- 第四步：删除 user_payout_item 表（在确认数据迁移完成后）
-- ============================================

-- 注意：执行前请先备份数据！
-- DROP TABLE IF EXISTS `user_payout_item`;

-- ============================================
-- 第五步：清理和验证
-- ============================================

-- 5.1 更新 user_income_monthly.payout_status 和 payout_id（基于现有 user_payout）
-- 这个查询需要根据实际情况调整
-- UPDATE user_income_monthly uim
-- INNER JOIN user_payout up ON uim.user_id = up.user_id 
--   AND uim.month = up.month
-- SET uim.payout_status = CASE WHEN up.status = 'paid' THEN 'paid' ELSE 'unpaid' END,
--     uim.payout_id = up.id
-- WHERE up.status IN ('paid', 'processing');

-- ============================================
-- 验证查询（执行后检查）
-- ============================================

-- 检查 user_payout 表结构
-- DESCRIBE user_payout;

-- 检查是否有重复的 user_id + month
-- SELECT user_id, month, COUNT(*) as cnt 
-- FROM user_payout 
-- GROUP BY user_id, month 
-- HAVING cnt > 1;

-- 检查 payout_gateway_transaction 表结构
-- DESCRIBE payout_gateway_transaction;

