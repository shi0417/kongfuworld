# Stripe 自动扣款问题分析报告

**分析时间**: 2025-12-05  
**问题描述**: 用户创建 Stripe 自动续费订阅后，Champion 期限从 2026-03-04 缩短到 2026-01-05

---

## 📋 问题总结

### 1. 期限缩短问题 ⚠️ **严重Bug**

**现象**：
- 用户 ID=2 原本的 Champion 订阅到期时间：`2026-03-04`
- 创建 Stripe 自动续费订阅后，到期时间变为：`2026-01-05`
- **期限缩短了约 2 个月**

**根本原因**：
在 `backend/services/unifiedPaymentService.js` 的 `handleStripeChampionSubscriptionCreated()` 函数中（第424-438行），当用户已有订阅时，代码直接使用 Stripe 订阅的 `current_period_end` 覆盖了现有的 `end_date`：

```424:438:backend/services/unifiedPaymentService.js
      if (existingSubscription.length > 0) {
        // 如果存在订阅，更新记录（使用 Stripe 提供的周期时间）
        // monthly_price 始终保存原价（basePrice）
        await this.db.execute(
          `UPDATE user_champion_subscription 
           SET tier_level = ?, tier_name = ?, monthly_price = ?, 
               start_date = COALESCE(start_date, ?), end_date = ?, 
               is_active = 1, payment_method = 'stripe', 
               auto_renew = 1, stripe_subscription_id = ?, 
               cancel_at_period_end = 0, cancelled_at = NULL,
               updated_at = NOW() 
           WHERE id = ?`,
          [tierLevel, tierName, monthlyPrice, periodStart, periodEnd, subscription.id, existingSubscription[0].id]
        );
```

**问题逻辑**：
1. Stripe 创建订阅时，`current_period_start` = 当前时间（2025-12-05）
2. Stripe 创建订阅时，`current_period_end` = 当前时间 + 1个月（2026-01-05）
3. 代码直接用 `periodEnd`（2026-01-05）覆盖了用户现有的 `end_date`（2026-03-04）

**正确的逻辑应该是**：
- 如果用户已有订阅且 `end_date` 在未来，应该**保留现有的 `end_date`**
- Stripe 订阅的周期时间只用于记录首次支付，不应该覆盖现有到期时间
- 只有当 Stripe 自动续费（通过 webhook）时，才应该延长 `end_date`

---

### 2. 价格存储问题 ✅ **正常**

**用户疑问**：支付时是7折折扣价，但后台存储的数据是原价

**实际情况**：
- ✅ `monthly_price` = `1.00`（原价）- **这是正确的**，应该保存原价
- ✅ `payment_amount` = `0.00`（实际支付金额）- 这里显示为 0 是因为首次支付可能还未完成
- ✅ `discount_amount` = `0.30`（折扣金额）- **正确记录了折扣**
- ✅ `discount_code` = `promo_3`（折扣代码）- **正确记录了折扣代码**

**结论**：价格存储逻辑是正确的。`monthly_price` 字段应该保存原价，实际支付金额和折扣信息分别保存在 `payment_amount` 和 `discount_amount` 字段中。

---

### 3. Stripe 自动扣款机制 ✅ **正常**

**问题**：在 Stripe 官网上能看到下次自动扣款的信息吗？

**答案**：**可以**。用户可以在 Stripe Dashboard 中查看：

1. **订阅信息**：
   - 登录 Stripe Dashboard → Customers → 找到对应的 Customer
   - 查看 Subscriptions 标签页
   - 可以看到订阅状态、下次扣款时间、周期等

2. **自动扣款流程**：
   - Stripe 在每个周期结束时（`current_period_end`）自动创建 Invoice
   - 自动从用户的支付方式扣款
   - 扣款成功后发送 `invoice.payment_succeeded` Webhook
   - 后端 `handleInvoicePaymentSucceeded()` 处理续费，延长 `end_date`

3. **代码实现**：
   - ✅ 订阅创建：`backend/services/stripeService.js` → `createChampionSubscription()`
   - ✅ Webhook 处理：`backend/services/stripeService.js` → `handleInvoicePaymentSucceeded()`
   - ✅ 续费逻辑：使用 `invoice.lines.data[0].period.end` 作为新的 `end_date`

---

## 🔍 问题验证方法

### 方法1：查看数据库记录

```sql
-- 查看用户的订阅记录
SELECT * FROM user_champion_subscription 
WHERE user_id = 2 AND novel_id = 7;

-- 查看详细的支付记录
SELECT * FROM user_champion_subscription_record 
WHERE user_id = 2 AND novel_id = 7 
ORDER BY created_at DESC;

-- 查看支付记录
SELECT * FROM payment_record 
WHERE user_id = 2 AND novel_id = 7 
ORDER BY created_at DESC;
```

### 方法2：查看 Stripe Dashboard

1. 登录 Stripe Dashboard
2. 进入 Customers → 搜索 Customer ID: `cus_TXrraxGlDcAeRe`
3. 查看 Subscriptions 标签页
4. 点击订阅 `sub_1Sam85DYBCezccmer1AbsuK1`
5. 查看：
   - Current period end（当前周期结束时间）
   - Next payment date（下次扣款时间）
   - Status（订阅状态）

### 方法3：使用 MCP 测试

可以创建一个测试脚本来：
1. 模拟用户已有订阅到 2026-03-04
2. 创建新的 Stripe 自动续费订阅
3. 验证 `end_date` 是否正确保留

---

## 🐛 Bug 修复方案

### 修复逻辑

当用户已有订阅时，应该：
1. **保留现有的 `end_date`**（如果它比 Stripe 订阅的 `periodEnd` 更晚）
2. 只在 Stripe 订阅的 `periodEnd` 比现有 `end_date` 更晚时，才更新 `end_date`
3. 或者：**始终在现有 `end_date` 基础上延长**，而不是使用 Stripe 的周期时间

### 推荐方案：保留更晚的到期时间

```javascript
if (existingSubscription.length > 0) {
  const existingEndDate = new Date(existingSubscription[0].end_date);
  
  // 如果现有订阅的到期时间比 Stripe 订阅的周期结束时间更晚，保留现有的
  // 否则使用 Stripe 订阅的周期结束时间
  const finalEndDate = existingEndDate > periodEnd ? existingEndDate : periodEnd;
  
  await this.db.execute(
    `UPDATE user_champion_subscription 
     SET tier_level = ?, tier_name = ?, monthly_price = ?, 
         start_date = COALESCE(start_date, ?), end_date = ?, 
         is_active = 1, payment_method = 'stripe', 
         auto_renew = 1, stripe_subscription_id = ?, 
         cancel_at_period_end = 0, cancelled_at = NULL,
         updated_at = NOW() 
     WHERE id = ?`,
    [tierLevel, tierName, monthlyPrice, periodStart, finalEndDate, subscription.id, existingSubscription[0].id]
  );
}
```

---

## 📝 测试建议

### 测试场景1：用户已有订阅，创建自动续费订阅

**前置条件**：
- 用户已有订阅，到期时间：2026-03-04
- 用户创建 Stripe 自动续费订阅

**预期结果**：
- ✅ `end_date` 应该保持为 2026-03-04（或更晚）
- ✅ `stripe_subscription_id` 应该更新为新创建的订阅 ID
- ✅ `auto_renew` 应该设置为 1
- ✅ 创建新的 `user_champion_subscription_record` 记录（`subscription_type = 'extend'`）

### 测试场景2：Stripe 自动续费（Webhook）

**前置条件**：
- 用户有 Stripe 自动续费订阅
- Stripe 在周期结束时自动扣款

**预期结果**：
- ✅ `end_date` 应该在现有基础上延长 1 个月
- ✅ 创建新的 `user_champion_subscription_record` 记录（`subscription_type = 'renew'`）
- ✅ `payment_amount` 应该是原价（因为续费时通常没有折扣）

### 测试场景3：价格存储验证

**前置条件**：
- 用户使用 7 折折扣创建订阅

**预期结果**：
- ✅ `monthly_price` = 原价（1.00）
- ✅ `payment_amount` = 折扣后价格（0.70）
- ✅ `discount_amount` = 折扣金额（0.30）
- ✅ `discount_code` = 折扣代码（promo_3）

---

## ✅ 总结

1. **期限缩短问题**：⚠️ **严重Bug**，需要立即修复
2. **价格存储问题**：✅ 正常，逻辑正确
3. **Stripe 自动扣款**：✅ 正常，可以在 Stripe Dashboard 查看

**下一步行动**：
1. ✅ 修复 `handleStripeChampionSubscriptionCreated()` 中的期限计算逻辑（已完成）
2. ⏳ 测试修复后的功能
3. ⏳ 对于已受影响用户（如 user_id=2），需要手动修复数据库记录

---

## 🔧 修复方案（已实施）

### 修复内容

已修复 `backend/services/unifiedPaymentService.js` 中的 `handleStripeChampionSubscriptionCreated()` 函数：

**修复前**：
- 直接使用 Stripe 订阅的 `periodEnd` 覆盖现有 `end_date`

**修复后**：
- 如果现有订阅的 `end_date` 比 Stripe 订阅的 `periodEnd` 更晚，保留现有的 `end_date`
- 如果 Stripe 订阅的 `periodEnd` 更晚，使用 Stripe 的时间
- 确保 `user_champion_subscription_record` 中的 `end_date` 也使用正确的值

**修复代码位置**：
- `backend/services/unifiedPaymentService.js` 第 424-451 行

### 修复后的逻辑

```javascript
if (existingSubscription.length > 0) {
  const existingEndDate = new Date(existingSubscription[0].end_date);
  
  // 如果现有订阅的到期时间比 Stripe 订阅的周期结束时间更晚，保留现有的
  if (existingEndDate > periodEnd) {
    endDate = existingEndDate;
  } else {
    endDate = periodEnd;
  }
  
  // 更新数据库，使用计算后的 endDate
  await this.db.execute(..., [..., endDate, ...]);
}
```

### 数据修复建议

对于已受影响用户（如 user_id=2），需要手动修复数据库：

```sql
-- 查看当前状态
SELECT id, user_id, novel_id, end_date, stripe_subscription_id 
FROM user_champion_subscription 
WHERE user_id = 2 AND novel_id = 7;

-- 如果 end_date 被错误缩短，需要恢复到正确的日期
-- 注意：需要根据实际情况调整日期
UPDATE user_champion_subscription 
SET end_date = '2026-03-04 10:21:10'  -- 恢复到原始到期时间
WHERE user_id = 2 AND novel_id = 7 AND id = 18;
```

**注意**：修复前请先备份数据库，并确认正确的到期时间。

