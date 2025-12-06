# Champion + Stripe 自动续费 & 手动购买 实现现状分析报告

**分析时间**: 2025-12-05  
**分析范围**: 后端支付逻辑、Stripe 订阅机制、本地数据库存储、前端调用流程

---

## 一、文件 & 路由总览

### 1.1 后端核心文件

#### 路由文件
- **`backend/routes/payment.js`** (712行)
  - `POST /payment/stripe/champion-subscription` - 创建 Stripe Champion 订阅（自动续费）
  - `POST /payment/stripe/create` - 创建 Stripe 一次性支付（手动购买）
  - `POST /payment/stripe/confirm` - 确认 Stripe 支付
  - `POST /payment/stripe/webhook` - Stripe Webhook 处理
  - `GET /payment/paypal/success` - PayPal 支付成功回调
  - `POST /payment/karma/create` - Karma 购买支付

#### Service 文件
- **`backend/services/stripeService.js`** (997行)
  - `createChampionSubscription()` - 创建 Stripe Subscription（第898-976行）
  - `handleWebhook()` - 处理 Stripe Webhook 事件（第456-485行）
  - `handleInvoicePaymentSucceeded()` - 处理订阅续费（第488-668行）
  - `handlePaymentSuccess()` - 处理支付成功（第671-773行）
  - `getOrCreateCustomer()` - 获取或创建 Stripe Customer（第851-892行）
  - `createPaymentIntent()` - 创建一次性支付意图（第66-96行）

- **`backend/services/unifiedPaymentService.js`** (550行)
  - `handlePaymentSuccess()` - 统一支付成功处理（第42-178行）
  - `handleStripeChampionSubscriptionCreated()` - 处理 Stripe 订阅创建（第398-546行）
  - `createSubscriptionRecord()` - 创建订阅记录（第194-392行）

- **`backend/services/championService.js`** (519行)
  - `getOrCreateStripePriceForChampionTier()` - 获取或创建 Stripe Price（第258-363行）
  - `getOrCreateStripeCouponForPromotion()` - 获取或创建 Stripe Coupon（第373-515行）
  - `getUserChampionStatus()` - 获取用户 Champion 状态（第214-242行）

- **`backend/services/stripeWebhookHandler.js`** (72行)
  - `stripeWebhookHandler()` - Webhook 入口处理函数

### 1.2 前端核心文件

- **`frontend/src/components/ChampionDisplay/ChampionDisplay.tsx`**
  - `handleStripeSubscription()` - 处理 Stripe 自动续费订阅（第186-230行）
  - 调用 API: `POST /payment/stripe/champion-subscription`

- **`frontend/src/components/SmartPaymentModal/SmartPaymentModal.tsx`**
  - 处理订阅支付完成（使用 `clientSecret`）
  - 调用 API: `POST /payment/stripe/create`（一次性支付）

---

## 二、当前支付 & 订阅流程图（文字版）

### 2.1 Stripe 自动续费订阅流程（`/payment/stripe/champion-subscription`）

**时间顺序**：

1. **前端发起请求**
   - 用户点击 "SUBSCRIBE" 按钮
   - 前端调用 `POST /payment/stripe/champion-subscription`
   - 请求体：`{ userId, novelId, tierLevel, tierName, autoRenew: true }`

2. **后端处理流程**（`backend/routes/payment.js` 第464-590行）
   - 获取或创建 Stripe Price（从 `novel_champion_tiers` 表）
   - 查询促销活动并获取或创建 Stripe Coupon
   - 获取或创建 Stripe Customer
   - **调用 `stripeService.createChampionSubscription()`** 创建 Stripe Subscription

3. **创建 Stripe Subscription**（`backend/services/stripeService.js` 第898-976行）
   - 调用 `stripe.subscriptions.create()`，传入参数：
     ```javascript
     {
       customer: customerId,
       items: [{ price: priceId }],
       metadata: { userId, novelId, tierLevel, tierName },
       expand: ['latest_invoice.payment_intent'],
       payment_behavior: 'default_incomplete', // 如果没有 paymentMethodId
       discounts: [{ coupon: couponId }] // 如果有促销
     }
     ```
   - **关键点**：**没有设置 `billing_cycle_anchor`**
   - 返回 `subscription` 对象和 `clientSecret`（如果状态是 `incomplete`）

4. **创建本地记录**
   - 创建 `payment_record`（状态为 `pending`，包含 PaymentIntent ID）
   - 调用 `unifiedPaymentService.handleStripeChampionSubscriptionCreated()` 写入：
     - `user_champion_subscription` 表（更新或创建）
     - `user_champion_subscription_record` 表（创建详细记录）

5. **前端完成支付**
   - 如果订阅状态是 `incomplete`，返回 `clientSecret`
   - 前端使用 Stripe.js 完成支付
   - 支付成功后触发 `payment_intent.succeeded` Webhook

6. **Webhook 处理**（`backend/services/stripeService.js` 第671-773行）
   - `handlePaymentSuccess()` 更新：
     - `payment_record` 的金额和状态
     - `user_champion_subscription_record` 的支付金额
     - 延长期限（如果是首次支付）

7. **自动续费**（`backend/services/stripeService.js` 第488-668行）
   - Stripe 在每个周期结束时自动创建 Invoice
   - 触发 `invoice.payment_succeeded` Webhook
   - `handleInvoicePaymentSucceeded()` 更新：
     - `user_champion_subscription.end_date`（延长 30 天或使用 invoice 的周期结束时间）
     - 创建新的 `user_champion_subscription_record`（`subscription_type = 'renew'`）

### 2.2 Stripe 一次性支付流程（`/payment/stripe/create`）

**时间顺序**：

1. **前端发起请求**
   - 调用 `POST /payment/stripe/create`
   - 请求体：`{ userId, amount, novelId, tierLevel, tierName }`

2. **后端创建 PaymentIntent**（`backend/services/stripeService.js` 第66-96行）
   - 调用 `stripe.paymentIntents.create()`
   - 创建 `payment_record`（状态为 `pending`）

3. **前端确认支付**
   - 使用 Stripe.js 确认支付
   - 调用 `POST /payment/stripe/confirm`

4. **支付成功处理**（`backend/routes/payment.js` 第334-401行）
   - 调用 `unifiedPaymentService.handlePaymentSuccess()`
   - 更新 `user_champion_subscription`（延长 30 天）
   - 创建 `user_champion_subscription_record`

**关键区别**：
- ✅ **自动续费订阅**：使用 `stripe.subscriptions.create()`，有真正的 Subscription 对象
- ❌ **一次性支付**：使用 `stripe.paymentIntents.create()`，**没有 Subscription**，只是简单延长本地到期时间

---

## 三、本地会员有效期与 Stripe 周期的关系

### 3.1 当前本地到期时间计算逻辑

#### 手动购买（一次性支付）
- **位置**：`backend/services/unifiedPaymentService.js` 第96-122行
- **逻辑**：
  - 如果用户已有订阅：`新到期时间 = 现有 end_date + 30天`
  - 如果用户没有订阅：`新到期时间 = 当前时间 + 30天`
- **示例**：
  - 用户当前到期时间：2026-01-06
  - 12月5日购买1次：新到期时间 = 2026-01-06 + 30天 = **2026-02-05**
  - 12月5日再购买1次：新到期时间 = 2026-02-05 + 30天 = **2026-03-07**

#### 自动续费订阅（首次创建）
- **位置**：`backend/services/unifiedPaymentService.js` 第398-546行
- **逻辑**：
  - 使用 Stripe Subscription 的 `current_period_start` 和 `current_period_end`
  - **但如果用户已有订阅且到期时间更晚，保留现有到期时间**（第428-439行）
  - 计算订阅时长：`subscriptionDurationDays = (periodEnd - periodStart) / (1000 * 60 * 60 * 24)`
- **示例**：
  - 用户当前到期时间：2026-03-04
  - 12月5日创建 Stripe 订阅（周期：2025-12-05 到 2026-01-05）
  - 因为 2026-03-04 > 2026-01-05，所以保留 2026-03-04

#### 自动续费（Webhook `invoice.payment_succeeded`）
- **位置**：`backend/services/stripeService.js` 第488-668行
- **逻辑**：
  - 优先使用 `invoice.lines.data[0].period.end`（第536-538行）
  - 如果没有，则在当前 `end_date` 基础上加 30 天（第540-543行）
- **示例**：
  - 用户当前到期时间：2026-01-05
  - Stripe 自动扣款成功，invoice 周期结束：2026-02-05
  - 新到期时间 = **2026-02-05**（使用 invoice 的周期结束时间）

### 3.2 当前是否会根据 Stripe 自动扣款更新到期时间

✅ **是的**，通过 `invoice.payment_succeeded` Webhook 更新：
- 位置：`backend/services/stripeService.js` 第488-668行
- 更新 `user_champion_subscription.end_date`
- 创建新的 `user_champion_subscription_record`（`subscription_type = 'renew'`）

### 3.3 当前是否有代码修改 Stripe Subscription 的 `billing_cycle_anchor`

❌ **没有**。搜索整个代码库，**没有找到任何 `billing_cycle_anchor` 的使用**。

**结论**：当前项目 **没有** 使用 `billing_cycle_anchor` 控制下次扣费时间。

---

## 四、手动购买与订阅之间的关系

### 4.1 当前"手动购买 Champion"的实现方式

**答案**：**纯一次性 Payment（和 Subscription 无任何关联）**

**证据**：
- 手动购买使用 `stripe.paymentIntents.create()`（`backend/services/stripeService.js` 第66-96行）
- 手动购买使用 `unifiedPaymentService.handlePaymentSuccess()`（`backend/routes/payment.js` 第375行）
- 该方法只是简单延长本地 `end_date`，**不创建 Stripe Subscription**

### 4.2 若用户已经有一个 Champion 订阅

#### 代码逻辑分析

**自动续费订阅**：
- 位置：`backend/services/unifiedPaymentService.js` 第424-452行
- 如果用户已有订阅：
  - 更新现有订阅记录（不创建新记录）
  - 保留更晚的到期时间（如果现有到期时间比 Stripe 周期更晚）
  - 更新 `stripe_subscription_id`

**手动购买**：
- 位置：`backend/services/unifiedPaymentService.js` 第102-122行
- 如果用户已有订阅：
  - 更新现有订阅记录（不创建新记录）
  - 在现有 `end_date` 基础上加 30 天
  - **不检查是否有 Stripe Subscription**

#### 是否阻止重复购买

❌ **不阻止**。代码允许：
- 用户可以有多个 `user_champion_subscription_record` 记录
- 但 `user_champion_subscription` 表有 `UNIQUE KEY unique_user_novel`，所以每个用户每个小说只有一条主记录

#### 多次购买的处理方式

✅ **允许多次购买，简单叠加本地到期时间**：
- 每次购买在现有 `end_date` 基础上加 30 天
- 不检查是否已有 Stripe Subscription
- 手动购买和自动续费订阅可以共存（但可能导致数据不一致）

---

## 五、相关的数据表结构

### 5.1 `payment_record` 表

**字段**（从代码推断）：
- `id` - 主键
- `user_id` - 用户ID
- `novel_id` - 小说ID
- `amount` - 支付金额
- `payment_method` - 支付方式（'stripe', 'paypal'）
- `status` - 支付状态（'pending', 'completed', 'failed'）
- `type` - 支付类型（'champion_subscribe', 'karma_purchase', 'recharge'）
- `description` - 描述（包含 Subscription ID、PaymentIntent ID 等信息）
- `created_at`, `updated_at` - 时间戳

**关键字段说明**：
- `description` 字段包含：
  - `Stripe Subscription ID: sub_xxx`
  - `PaymentIntent ID: pi_xxx`
  - `Novel ID: xxx`
  - `Tier Level: xxx`
  - `Tier Name: xxx`

### 5.2 `user_champion_subscription` 表

**字段**（从 `backend/database/champion_system.sql` 第41-59行）：
- `id` - 主键
- `user_id` - 用户ID
- `novel_id` - 小说ID
- `tier_level` - Champion等级
- `tier_name` - 等级名称
- `monthly_price` - 月费（原价）
- `start_date` - 订阅开始时间
- `end_date` - **订阅结束时间（关键字段）**
- `is_active` - 是否激活
- `payment_method` - 支付方式
- `auto_renew` - 是否自动续费
- `stripe_subscription_id` - **Stripe Subscription ID（如果有自动续费）**
- `cancel_at_period_end` - 是否在周期结束时取消
- `cancelled_at` - 取消时间
- `created_at`, `updated_at` - 时间戳

**关键字段说明**：
- `end_date`：**存储会员到期时间**，用于判断用户是否有权限访问章节
- `stripe_subscription_id`：**关联 Stripe Subscription**，用于 Webhook 处理
- `auto_renew`：标识是否自动续费（1=是，0=否）

### 5.3 `user_champion_subscription_record` 表

**字段**（从 `backend/database/user_champion_subscription_record.sql`）：
- `id` - 主键
- `user_id`, `novel_id` - 用户和小说ID
- `payment_record_id` - 关联的 `payment_record` ID
- `tier_level`, `tier_name` - 等级信息
- `monthly_price` - 月费（原价）
- `payment_amount` - **实际支付金额**
- `payment_method` - 支付方式
- `payment_status` - 支付状态（'pending', 'completed', 'failed'）
- `subscription_type` - **订阅类型**（'new', 'extend', 'renew', 'upgrade'）
- `subscription_duration_days` - **订阅时长（天）**
- `start_date`, `end_date` - 订阅起止时间
- `is_active`, `auto_renew` - 激活和自动续费标志
- `transaction_id` - 第三方交易ID
- `stripe_payment_intent_id` - Stripe PaymentIntent ID
- `stripe_customer_id` - **Stripe Customer ID**
- `paypal_order_id` - PayPal 订单ID
- `card_brand`, `card_last4`, `card_exp_month`, `card_exp_year` - 卡片信息
- `currency`, `exchange_rate`, `local_amount`, `local_currency` - 货币信息
- `discount_amount`, `discount_code` - 折扣信息
- `tax_amount`, `fee_amount` - 税费和手续费
- `refund_amount`, `refund_reason`, `refund_date` - 退款信息
- `before_membership_snapshot`, `after_membership_snapshot` - 会员快照（JSON）
- `notes`, `ip_address`, `user_agent` - 其他信息
- `created_at`, `updated_at` - 时间戳

**关键字段说明**：
- `subscription_type`：
  - `'new'`：新订阅
  - `'extend'`：延长现有订阅
  - `'renew'`：自动续费
  - `'upgrade'`：升级（未使用）
- `subscription_duration_days`：订阅时长（通常为 30 或 31 天）

### 5.4 是否有字段存储"下一次应当在本地认定的扣款日期"

❌ **没有专门的字段**。

**当前实现**：
- `user_champion_subscription.end_date`：存储会员到期时间
- `user_champion_subscription.stripe_subscription_id`：关联 Stripe Subscription
- **没有 `next_billing_date` 或 `local_next_billing` 字段**

**Stripe Subscription 的周期信息**：
- Stripe Subscription 有 `current_period_end`，但**本地没有存储**
- 只能通过 Stripe API 查询获取

---

## 六、可以插入"手动续费延长自动扣款日期"的最佳插入点建议

### 6.1 需求场景

**目标**：实现"手动购买 2 次 → 下次自动扣款从 2 月 6 日扣"的逻辑

**当前问题**：
- 手动购买只延长本地 `end_date`，不修改 Stripe Subscription
- Stripe Subscription 的 `current_period_end` 不受手动购买影响
- 下次自动扣款仍然按照 Stripe Subscription 的原始周期进行

### 6.2 最佳插入点

#### 插入点 1：手动购买成功后（推荐）

**位置**：`backend/services/unifiedPaymentService.js` 第110-113行

**当前逻辑**：
```javascript
await this.db.execute(
  'UPDATE user_champion_subscription SET tier_level = ?, tier_name = ?, monthly_price = ?, end_date = ?, updated_at = NOW() WHERE id = ?',
  [tierLevel, tierName, amount, endDate, existingSubscription[0].id]
);
```

**建议修改**：
1. 检查用户是否有 Stripe Subscription（`stripe_subscription_id` 不为空）
2. 如果有，计算新的 `billing_cycle_anchor`：
   ```javascript
   const newBillingCycleAnchor = Math.floor(newEndDate.getTime() / 1000); // Unix 时间戳
   ```
3. 调用 `stripe.subscriptions.update()` 更新 `billing_cycle_anchor`：
   ```javascript
   await stripeService.stripe.subscriptions.update(stripeSubscriptionId, {
     billing_cycle_anchor: newBillingCycleAnchor
   });
   ```

**相关函数**：
- 需要在 `stripeService.js` 中添加新方法：`updateSubscriptionBillingCycleAnchor()`

#### 插入点 2：`handleStripeChampionSubscriptionCreated()` 中

**位置**：`backend/services/unifiedPaymentService.js` 第442-452行

**当前逻辑**：
- 更新 `user_champion_subscription` 时，如果用户已有订阅，保留更晚的到期时间

**建议修改**：
- 如果保留了更晚的到期时间，同时更新 Stripe Subscription 的 `billing_cycle_anchor`

#### 插入点 3：创建新的辅助函数

**建议**：在 `stripeService.js` 中添加：

```javascript
// 同步本地到期时间到 Stripe Subscription
async syncLocalEndDateToStripeSubscription(userId, novelId, newEndDate) {
  // 1. 查找用户的 Stripe Subscription
  const [subscription] = await this.db.execute(
    'SELECT stripe_subscription_id FROM user_champion_subscription WHERE user_id = ? AND novel_id = ? AND stripe_subscription_id IS NOT NULL',
    [userId, novelId]
  );
  
  if (subscription.length === 0) {
    return; // 没有 Stripe Subscription，无需同步
  }
  
  // 2. 计算新的 billing_cycle_anchor
  const billingCycleAnchor = Math.floor(newEndDate.getTime() / 1000);
  
  // 3. 更新 Stripe Subscription
  await this.stripe.subscriptions.update(subscription[0].stripe_subscription_id, {
    billing_cycle_anchor: billingCycleAnchor
  });
  
  console.log(`[Stripe订阅] 已更新 billing_cycle_anchor - Subscription ID: ${subscription[0].stripe_subscription_id}, 新扣款日期: ${newEndDate.toISOString()}`);
}
```

### 6.3 需要补充的数据表字段

**建议添加字段**（可选，用于记录和查询）：

1. **`user_champion_subscription` 表**：
   - `next_billing_date` DATETIME - 下次扣款日期（从 Stripe Subscription 同步）
   - `last_billing_sync_at` DATETIME - 上次同步 billing 信息的时间

2. **或者不添加字段**：
   - 直接通过 `stripe_subscription_id` 调用 Stripe API 查询 `current_period_end`
   - 优点：数据不冗余，始终与 Stripe 保持一致
   - 缺点：需要额外的 API 调用

### 6.4 实现步骤建议

1. **第一步**：在 `stripeService.js` 中添加 `syncLocalEndDateToStripeSubscription()` 方法
2. **第二步**：在 `unifiedPaymentService.handlePaymentSuccess()` 中调用该方法（手动购买后）
3. **第三步**：在 `unifiedPaymentService.handleStripeChampionSubscriptionCreated()` 中调用该方法（创建订阅时）
4. **第四步**：测试验证：
   - 用户有 Stripe Subscription，手动购买 2 次
   - 检查 Stripe Dashboard 中 Subscription 的 `current_period_end` 是否已更新
   - 检查下次自动扣款是否在正确的时间进行

---

## 七、总结

### 7.1 当前实现状态

✅ **已实现**：
- Stripe Subscription 创建（自动续费）
- Stripe Webhook 处理（`invoice.payment_succeeded`）
- 本地到期时间延长（手动购买和自动续费）
- 促销折扣支持（Stripe Coupon）

❌ **未实现**：
- `billing_cycle_anchor` 的使用
- 手动购买对 Stripe Subscription 的影响
- 本地存储 Stripe Subscription 的周期信息

### 7.2 关键发现

1. **当前项目同时支持两种支付方式**：
   - **自动续费订阅**：使用 `stripe.subscriptions.create()`，有真正的 Subscription
   - **一次性支付**：使用 `stripe.paymentIntents.create()`，没有 Subscription

2. **手动购买和自动续费可以共存，但可能导致数据不一致**：
   - 手动购买只延长本地 `end_date`
   - 不修改 Stripe Subscription 的 `billing_cycle_anchor`
   - 下次自动扣款仍然按照原始周期进行

3. **当前没有使用 `billing_cycle_anchor`**：
   - 创建 Subscription 时没有设置
   - 手动购买后没有更新
   - 这是实现"手动续费延长自动扣款日期"的关键点

### 7.3 建议

1. **短期**：在手动购买成功后，同步更新 Stripe Subscription 的 `billing_cycle_anchor`
2. **长期**：考虑统一支付方式，避免手动购买和自动续费混用导致的数据不一致问题

---

**报告结束**

