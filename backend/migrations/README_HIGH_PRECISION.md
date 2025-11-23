# 高精度金额字段迁移说明

## 概述

本次迁移将所有金额相关字段从 `DECIMAL(10,2)` 改为高精度 `DECIMAL(20,8)`，将所有比例字段从 `DECIMAL(5,4)` 改为 `DECIMAL(10,8)`，确保在计算过程中不丢失精度，不进行四舍五入。

## 修改内容

### 1. 数据库字段修改

#### 金额字段（改为 DECIMAL(20,8)）
- `karma_dollars.usd_per_karma`: DECIMAL(10,6) → DECIMAL(20,10)
- `reader_spending.amount_usd`: DECIMAL(10,2) → DECIMAL(20,8)
- `author_royalty.gross_amount_usd`: DECIMAL(10,2) → DECIMAL(20,8)
- `author_royalty.author_amount_usd`: DECIMAL(10,2) → DECIMAL(20,8)
- `commission_transaction.base_amount_usd`: DECIMAL(10,2) → DECIMAL(20,8)
- `commission_transaction.commission_amount_usd`: DECIMAL(10,2) → DECIMAL(20,8)
- `user_champion_subscription_record.payment_amount`: DECIMAL(10,2) → DECIMAL(20,8)

#### 比例字段（改为 DECIMAL(10,8)）
- `commission_plan_level.percent`: DECIMAL(5,4) → DECIMAL(10,8)
- `author_royalty_plan.royalty_percent`: DECIMAL(5,4) → DECIMAL(10,8)

### 2. 程序代码修改

#### 添加依赖
- 在 `package.json` 中添加了 `decimal.js` 高精度计算库

#### 代码逻辑修改
- 所有金额计算使用 `Decimal` 类型，不再使用 `parseFloat()` 和普通乘法
- 所有计算过程不进行四舍五入，直接保存完整精度
- 只在最终对外打款时（如果需要）才进行四舍五入

## 执行步骤

### 1. 安装依赖

```bash
cd backend
npm install
```

### 2. 执行数据库迁移

```bash
mysql -u root -p123456 kongfuworld < backend/migrations/001_high_precision_amount_fields.sql
```

或者直接在 MySQL 客户端中执行 `backend/migrations/001_high_precision_amount_fields.sql` 文件。

### 3. 验证迁移

执行迁移后，可以通过以下 SQL 验证字段类型：

```sql
-- 检查字段类型
DESCRIBE karma_dollars;
DESCRIBE reader_spending;
DESCRIBE author_royalty;
DESCRIBE commission_transaction;
DESCRIBE commission_plan_level;
DESCRIBE author_royalty_plan;
DESCRIBE user_champion_subscription_record;
```

## 重要说明

### 1. 计算精度

- **所有中间计算**：使用 `Decimal` 类型，保留完整精度
- **数据库存储**：使用 `DECIMAL(20,8)` 或 `DECIMAL(10,8)`，保留8位小数
- **不四舍五入**：计算过程中不进行任何四舍五入操作
- **对外打款**：只在真正需要向外部支付渠道打款时，才按需（如2位小数）进行四舍五入

### 2. 示例

#### 之前（会丢失精度）
```javascript
const amountUsd = unlock.karma_amount * usdPerKarma; // 可能丢失精度
```

#### 现在（高精度）
```javascript
const usdPerKarma = new Decimal(rateRows[0].usd_per_karma);
const karmaAmount = new Decimal(unlock.karma_amount);
const amountUsd = karmaAmount.mul(usdPerKarma); // 高精度计算，不四舍五入
```

### 3. 数据兼容性

- 现有数据会自动转换，不会丢失
- 新数据将使用高精度存储
- 建议在迁移后重新计算历史数据以确保精度

## 注意事项

1. **备份数据**：在执行迁移前，请务必备份数据库
2. **测试环境**：建议先在测试环境执行并验证
3. **历史数据**：如果需要，可以重新运行结算脚本以使用高精度重新计算历史数据
4. **显示格式**：前端显示时可以根据需要格式化（如显示2位小数），但数据库存储保持完整精度

## 相关文件

- 迁移SQL: `backend/migrations/001_high_precision_amount_fields.sql`
- 表结构文件: 
  - `backend/create_commission_system_tables.sql`
  - `backend/create_author_royalty_tables.sql`
- 代码文件: `backend/routes/admin.js`

