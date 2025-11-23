-- 高精度金额字段迁移脚本
-- 将所有金额相关字段从 DECIMAL(10,2) 改为高精度 DECIMAL(20,8)
-- 将所有比例字段从 DECIMAL(5,4) 改为 DECIMAL(10,8)
-- 将 Karma 汇率字段从 DECIMAL(10,6) 改为 DECIMAL(20,10)

-- 1. 修改 karma_dollars 表的 usd_per_karma 字段
ALTER TABLE `karma_dollars` 
MODIFY COLUMN `usd_per_karma` DECIMAL(20,10) NOT NULL COMMENT '1 karma = X 美元（高精度）';

-- 2. 修改 reader_spending 表的 amount_usd 字段
ALTER TABLE `reader_spending` 
MODIFY COLUMN `amount_usd` DECIMAL(20,8) NOT NULL COMMENT '换算后的美元金额（高精度）';

-- 3. 修改 author_royalty 表的金额字段
ALTER TABLE `author_royalty` 
MODIFY COLUMN `gross_amount_usd` DECIMAL(20,8) NOT NULL COMMENT '作品总收入（美元，高精度）',
MODIFY COLUMN `author_amount_usd` DECIMAL(20,8) NOT NULL COMMENT '给作者的部分（高精度）';

-- 4. 修改 commission_transaction 表的金额字段
ALTER TABLE `commission_transaction` 
MODIFY COLUMN `base_amount_usd` DECIMAL(20,8) NOT NULL COMMENT '基础金额（美元，高精度）',
MODIFY COLUMN `commission_amount_usd` DECIMAL(20,8) NOT NULL COMMENT '佣金金额（美元，高精度）';

-- 5. 修改 commission_plan_level 表的 percent 字段
ALTER TABLE `commission_plan_level` 
MODIFY COLUMN `percent` DECIMAL(10,8) NOT NULL COMMENT '分成比例（高精度）：0.08000000表示8%';

-- 6. 修改 author_royalty_plan 表的 royalty_percent 字段
ALTER TABLE `author_royalty_plan` 
MODIFY COLUMN `royalty_percent` DECIMAL(10,8) NOT NULL COMMENT '作者分成比例（高精度）：0.50000000表示50%';

-- 7. 修改 user_champion_subscription_record 表的 payment_amount 字段
ALTER TABLE `user_champion_subscription_record` 
MODIFY COLUMN `payment_amount` DECIMAL(20,8) NOT NULL COMMENT '实际支付金额（高精度）';

