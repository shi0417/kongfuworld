-- 删除旧的作者结算表（已被user_*表替代）
-- 执行此脚本删除旧表

-- 注意：删除前请确认新表已创建且数据已迁移（如果需要）

-- 1. 删除 author_payout_item（有外键依赖，先删除）
DROP TABLE IF EXISTS `author_payout_item`;

-- 2. 删除 author_payout（被author_payout_item依赖）
DROP TABLE IF EXISTS `author_payout`;

-- 3. 删除 author_income_monthly
DROP TABLE IF EXISTS `author_income_monthly`;

-- 4. 删除 author_payout_account
DROP TABLE IF EXISTS `author_payout_account`;

