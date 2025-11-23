# 读者收入统计页面数据来源说明

## 页面位置
- **前端页面**: `frontend/src/pages/AdminPanel.tsx` - "读者收入统计" 选项卡
- **后端API**: `backend/routes/admin.js` - `/api/admin/reader-income-stats` (GET)

## 数据流程

### 1. 前端调用
当用户在页面选择月份并点击"查询"按钮时：
```javascript
// 前端代码位置: frontend/src/pages/AdminPanel.tsx:218
const loadReaderIncomeStats = async () => {
  const response = await fetch(
    `http://localhost:5000/api/admin/reader-income-stats?month=${readerIncomeMonth}`,
    {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    }
  );
  // 获取数据并更新状态
  setReaderIncomeData(data.data);
}
```

### 2. 后端API处理
后端接收到请求后，执行三个SQL查询：

#### 查询1: 读者推广收入汇总
**数据来源**: `commission_transaction` 表

**SQL逻辑**:
```sql
SELECT 
  ct.user_id,                    -- 推广人ID
  u.username,                    -- 推广人用户名
  u.pen_name,                    -- 推广人笔名
  COALESCE(SUM(ct.commission_amount_usd), 0) as total_referral_income_usd,  -- 推广收入总和
  COUNT(DISTINCT ct.source_user_id) as referral_count  -- 推广人数（去重）
FROM commission_transaction ct
LEFT JOIN user u ON ct.user_id = u.id
WHERE ct.commission_type = 'reader_referral'  -- 只查询读者推广类型
  AND ct.settlement_month = ?                  -- 按结算月份筛选
GROUP BY ct.user_id, u.username, u.pen_name
ORDER BY total_referral_income_usd DESC
```

**说明**:
- 从 `commission_transaction` 表中查询所有 `reader_referral` 类型的佣金记录
- 按推广人（`user_id`）分组，汇总每个推广人的总收入和推广人数
- `commission_amount_usd` 字段存储的是高精度金额（DECIMAL(20,8)）
- 前端显示时使用 `.toFixed(2)` 格式化为2位小数

**对应页面表格**: "读者推广收入汇总" 表
- 推广人: `userName` (username 或 pen_name)
- 推广收入: `totalReferralIncome` (所有佣金金额的总和)
- 推广人数: `referralCount` (去重后的 source_user_id 数量)

---

#### 查询2: 读者消费汇总
**数据来源**: `reader_spending` 表

**SQL逻辑**:
```sql
SELECT 
  rs.user_id,                    -- 读者ID
  u.username,                     -- 读者用户名
  u.pen_name,                     -- 读者笔名
  COALESCE(SUM(rs.amount_usd), 0) as total_spending_usd,  -- 消费总额
  COUNT(*) as spending_count      -- 消费次数
FROM reader_spending rs
LEFT JOIN user u ON rs.user_id = u.id
WHERE rs.settlement_month = ?     -- 按结算月份筛选
GROUP BY rs.user_id, u.username, u.pen_name
ORDER BY total_spending_usd DESC
```

**说明**:
- 从 `reader_spending` 表中查询指定月份的所有读者消费记录
- 按读者（`user_id`）分组，汇总每个读者的总消费金额和消费次数
- `amount_usd` 字段存储的是高精度金额（DECIMAL(20,8)）
- 这个表的数据来源于：
  - 章节解锁: 从 `chapter_unlocks` 表转换（karma × 汇率）
  - 订阅: 从 `user_champion_subscription_record` 表转换

**对应页面表格**: "读者消费汇总" 表
- 读者: `userName` (username 或 pen_name)
- 消费总额: `totalSpending` (所有消费金额的总和)
- 消费次数: `spendingCount` (消费记录条数)

---

#### 查询3: 读者推广佣金明细
**数据来源**: `commission_transaction` 表 + 关联表

**SQL逻辑**:
```sql
SELECT 
  ct.*,                           -- 佣金交易的所有字段
  u.username,                     -- 推广人用户名
  u.pen_name,                     -- 推广人笔名
  u2.username as source_user_name, -- 被推广读者用户名
  u2.pen_name as source_user_pen_name, -- 被推广读者笔名
  n.title as novel_title,         -- 小说标题
  rs.amount_usd as source_spending_amount  -- 原始消费金额
FROM commission_transaction ct
LEFT JOIN user u ON ct.user_id = u.id              -- 推广人信息
LEFT JOIN user u2 ON ct.source_user_id = u2.id     -- 被推广读者信息
LEFT JOIN novel n ON ct.novel_id = n.id            -- 小说信息
LEFT JOIN reader_spending rs ON ct.reference_id = rs.id  -- 关联原始消费记录
WHERE ct.commission_type = 'reader_referral'       -- 只查询读者推广类型
  AND ct.settlement_month = ?                       -- 按结算月份筛选
ORDER BY ct.created_at DESC
```

**说明**:
- 从 `commission_transaction` 表中查询所有读者推广佣金明细
- 通过 LEFT JOIN 关联多个表获取完整信息：
  - `user` 表: 获取推广人信息
  - `user` 表 (u2): 获取被推广读者信息
  - `novel` 表: 获取小说标题
  - `reader_spending` 表: 获取原始消费金额
- 每条记录代表一笔推广佣金，包含：
  - 推广人、被推广读者、小说、层级
  - 基础金额（`base_amount_usd`）: 被推广读者的消费金额
  - 佣金金额（`commission_amount_usd`）: 根据推广方案比例计算出的佣金

**对应页面表格**: "读者推广佣金明细" 表
- 推广人: `userName`
- 被推广读者: `sourceUserName`
- 小说: `novelTitle`
- 层级: `level` (第几层推广)
- 读者消费: `sourceSpendingAmount` (原始消费金额)
- 佣金金额: `commissionAmount` (计算出的佣金)

---

## 数据关系图

```
读者消费 (reader_spending)
    ↓
    ├─→ 生成作者收入 (author_royalty)
    │
    └─→ 生成推广佣金 (commission_transaction)
            ├─→ 读者推广 (reader_referral)
            │     └─→ 按推广人汇总 → "读者推广收入汇总"表
            │
            └─→ 作者推广 (author_referral)
```

## 数据生成流程

### 步骤1: 生成基础收入数据 (reader_spending)
**API**: `POST /api/admin/generate-reader-spending`

从以下来源生成：
1. **章节解锁**: `chapter_unlocks` 表
   - 筛选条件: `unlock_method='karma' AND cost>0`
   - 计算: `amount_usd = karma_amount × usd_per_karma` (使用高精度 Decimal)
   - 汇率来源: `karma_dollars` 表（按时间匹配）

2. **订阅**: `user_champion_subscription_record` 表
   - 筛选条件: `payment_status='completed' AND payment_amount>0`
   - 直接使用: `amount_usd = payment_amount` (使用高精度 Decimal)

### 步骤2: 生成作者基础收入 (author_royalty)
**API**: `POST /api/admin/author-royalty/generate`

从 `reader_spending` 生成：
- 计算: `author_amount_usd = amount_usd × royalty_percent` (使用高精度 Decimal)
- 分成比例来源: `author_royalty_plan` 表（通过 `novel_royalty_contract` 关联）

### 步骤3: 生成推广佣金 (commission_transaction)
**API**: `POST /api/admin/commission-transaction/generate`

从以下来源生成：
1. **读者推广佣金**:
   - 基础数据: `reader_spending.amount_usd`
   - 推广链: 沿 `referrals` 表向上查找多级上线
   - 计算: `commission_amount_usd = base_amount_usd × percent` (使用高精度 Decimal)
   - 方案来源: `commission_plan` + `commission_plan_level` 表

2. **作者推广佣金**:
   - 基础数据: `author_royalty.author_amount_usd`
   - 推广链: 沿 `referrals` 表向上查找多级上线
   - 计算: `commission_amount_usd = base_amount_usd × percent` (使用高精度 Decimal)

## 前端显示格式

所有金额在前端显示时都使用 `.toFixed(2)` 格式化为2位小数：
```javascript
// 示例
${item.totalReferralIncome.toFixed(2)}  // 显示为: $35.43
${item.totalSpending.toFixed(2)}        // 显示为: $441.71
${item.commissionAmount.toFixed(2)}     // 显示为: $0.02
```

**注意**: 虽然前端显示为2位小数，但数据库存储的是高精度（8位小数），这样可以确保计算精度不丢失。

## 关键表结构

### commission_transaction (推广佣金明细表)
- `user_id`: 推广人ID（拿佣金的人）
- `source_user_id`: 被推广读者ID（读者推广用）
- `commission_type`: 'reader_referral' 或 'author_referral'
- `base_amount_usd`: 基础金额（DECIMAL(20,8)）
- `commission_amount_usd`: 佣金金额（DECIMAL(20,8)）
- `level`: 推广层级（1, 2, 3...）
- `settlement_month`: 结算月份

### reader_spending (读者消费汇总表)
- `user_id`: 读者ID
- `amount_usd`: 消费金额（DECIMAL(20,8)）
- `source_type`: 'chapter_unlock' 或 'subscription'
- `settlement_month`: 结算月份

### referrals (推荐关系表)
- `user_id`: 下级用户ID
- `referrer_id`: 上级用户ID
- `promoter_plan_id`: 读者推广方案ID
- `author_plan_id`: 作者推广方案ID

## 总结

页面上的三个表格数据都来自 `commission_transaction` 和 `reader_spending` 表，这些数据是通过结算脚本生成的：

1. **读者推广收入汇总**: 从 `commission_transaction` 按推广人汇总
2. **读者消费汇总**: 从 `reader_spending` 按读者汇总
3. **读者推广佣金明细**: 从 `commission_transaction` 查询明细，关联用户和小说信息

所有金额计算都使用高精度 Decimal，确保"积小成多"时不会丢失精度。

