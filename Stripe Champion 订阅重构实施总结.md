# Stripe Champion 订阅重构实施总结

## 一、数据库迁移

### 1.1 迁移文件
- **SQL 文件**：`backend/migrations/20251205_refactor_stripe_subscription_fields.sql`
- **执行脚本**：`backend/migrations/execute_refactor_stripe_subscription_fields.js`

### 1.2 迁移内容

#### user_champion_subscription_record 表
- ✅ `transaction_id` → `stripe_subscription_id`
- ✅ 只存储 Stripe Subscription ID (sub_xxx)，不再混用 PaymentIntent ID 或 Invoice ID

#### user_champion_subscription 表
- ✅ 新增 `stripe_customer_id` VARCHAR(255) NULL
- ✅ 位置：在 `stripe_subscription_id` 之后

#### payment_record 表
- ✅ 新增 `stripe_subscription_id` VARCHAR(255) NULL
- ✅ 新增 `stripe_payment_intent_id` VARCHAR(255) NULL
- ✅ 新增 `stripe_customer_id` VARCHAR(255) NULL
- ✅ 创建相关索引

### 1.3 执行迁移

```bash
# 方式1：直接执行 SQL
mysql -u root -p kongfuworld < backend/migrations/20251205_refactor_stripe_subscription_fields.sql

# 方式2：使用 Node.js 脚本
node backend/migrations/execute_refactor_stripe_subscription_fields.js
```

---

## 二、代码修改总结

### 2.1 unifiedPaymentService.js

#### createSubscriptionRecord() 方法
- ✅ 新增参数：`stripeSubscriptionId`, `stripePaymentIntentId`, `stripeCustomerId`
- ✅ 字段名修改：`transaction_id` → `stripe_subscription_id`
- ✅ 逻辑调整：`stripe_subscription_id` 只存储 Stripe Subscription ID (sub_xxx)

#### handleStripeChampionSubscriptionCreated() 方法
- ✅ 创建/更新 `user_champion_subscription` 时，同时写入 `stripe_customer_id`
- ✅ 调用 `createSubscriptionRecord()` 时，传入 `stripeSubscriptionId`, `stripePaymentIntentId`, `stripeCustomerId`

#### handlePaymentSuccess() 方法
- ✅ 从 `payment_record` 表中查询 Stripe 相关字段
- ✅ 从 `user_champion_subscription` 表中查询 `stripe_customer_id`
- ✅ 调用 `createSubscriptionRecord()` 时，传入 Stripe 相关 ID

### 2.2 stripeService.js

#### createChampionSubscription() 方法
- ✅ 添加防重复创建检查（双保险）
- ✅ 检查是否已有 active 的 Stripe Subscription

#### handlePaymentSuccess() 方法
- ✅ 优先通过 `stripe_payment_intent_id` 字段查询 `payment_record`（向后兼容通过 description）
- ✅ 更新 `payment_record` 时，同时更新 `stripe_payment_intent_id` 和 `stripe_customer_id`

#### handleInvoicePaymentSucceeded() 方法
- ✅ 使用 `unifiedPaymentService.createSubscriptionRecord()` 统一创建订阅记录
- ✅ 传入正确的 `stripeSubscriptionId` (sub_xxx)，不存储 invoice.id

### 2.3 payment.js (路由)

#### POST /payment/stripe/champion-subscription
- ✅ 添加防重复创建检查（路由层）
- ✅ 创建 `payment_record` 时，同时写入 `stripe_subscription_id`, `stripe_payment_intent_id`, `stripe_customer_id`
- ✅ `description` 字段保留用于人类可读，但不再依赖解析字符串

---

## 三、防重复创建 Subscription

### 3.1 检查位置

1. **路由层**（`backend/routes/payment.js`）
   - 在调用 `stripeService.createChampionSubscription()` 之前检查
   - 如果已有 active 的 Stripe Subscription，返回 HTTP 400 错误

2. **Service 层**（`backend/services/stripeService.js`）
   - 在 `createChampionSubscription()` 方法中再次检查（双保险）
   - 如果已有 active 的 Stripe Subscription，抛出错误

### 3.2 检查逻辑

```javascript
// 检查条件
- user_id = ? AND novel_id = ? AND is_active = 1
- stripe_subscription_id IS NOT NULL
- auto_renew = 1

// 如果满足条件，返回错误：
{
  code: 'ALREADY_SUBSCRIBED',
  message: 'You already have an active Stripe subscription for this novel.'
}
```

---

## 四、字段使用规范

### 4.1 user_champion_subscription_record.stripe_subscription_id
- **用途**：只存储 Stripe Subscription ID (sub_xxx)
- **写入位置**：
  - `unifiedPaymentService.createSubscriptionRecord()` - 传入 `stripeSubscriptionId` 参数
  - `stripeService.handleInvoicePaymentSucceeded()` - 传入 `subscriptionId` (sub_xxx)
- **禁止**：不再存储 PaymentIntent ID (pi_xxx) 或 Invoice ID (in_xxx)

### 4.2 payment_record.stripe_subscription_id
- **用途**：存储 Stripe Subscription ID (sub_xxx)
- **写入位置**：`backend/routes/payment.js` - 创建 payment_record 时

### 4.3 payment_record.stripe_payment_intent_id
- **用途**：存储 Stripe PaymentIntent ID (pi_xxx)
- **写入位置**：
  - `backend/routes/payment.js` - 创建 payment_record 时
  - `stripeService.handlePaymentSuccess()` - 更新 payment_record 时

### 4.4 payment_record.stripe_customer_id
- **用途**：存储 Stripe Customer ID (cus_xxx)
- **写入位置**：
  - `backend/routes/payment.js` - 创建 payment_record 时
  - `stripeService.handlePaymentSuccess()` - 更新 payment_record 时

### 4.5 user_champion_subscription.stripe_customer_id
- **用途**：存储 Stripe Customer ID (cus_xxx)
- **写入位置**：
  - `unifiedPaymentService.handleStripeChampionSubscriptionCreated()` - 创建/更新订阅时

---

## 五、统一使用 unifiedPaymentService.createSubscriptionRecord

### 5.1 已统一使用的场景

1. ✅ **Stripe Champion 首次订阅**：`unifiedPaymentService.handleStripeChampionSubscriptionCreated()` → `createSubscriptionRecord()`
2. ✅ **Stripe 自动续费**：`stripeService.handleInvoicePaymentSucceeded()` → `unifiedPaymentService.createSubscriptionRecord()`
3. ✅ **手动购买/升级**：`unifiedPaymentService.handlePaymentSuccess()` → `createSubscriptionRecord()`

### 5.2 待废弃的方法

- `stripeService.createSubscriptionRecord()` - 已不再使用，可逐步移除
- `paypalServiceSDK.createSubscriptionRecord()` - 保留用于 PayPal 场景

---

## 六、测试检查点

### 6.1 新建 Champion + Stripe 订阅流程

**预期结果**：
- `user_champion_subscription`:
  - ✅ `stripe_subscription_id` = sub_xxx
  - ✅ `stripe_customer_id` = cus_xxx
- `user_champion_subscription_record`:
  - ✅ `stripe_subscription_id` = sub_xxx
  - ✅ `stripe_payment_intent_id` = pi_xxx
  - ✅ `stripe_customer_id` = cus_xxx
- `payment_record`:
  - ✅ `stripe_subscription_id` = sub_xxx
  - ✅ `stripe_payment_intent_id` = pi_xxx
  - ✅ `stripe_customer_id` = cus_xxx

### 6.2 Webhook invoice.payment_succeeded 自动续费流程

**预期结果**：
- ✅ 不会创建新的 Subscription
- ✅ 基于 `invoice.subscription` (sub_xxx) 找到对应的 `user_champion_subscription`
- ✅ 延长 `end_date`
- ✅ 插入新的 `user_champion_subscription_record`，`stripe_subscription_id` = sub_xxx（不存储 invoice.id）

### 6.3 防重复创建 Subscription

**测试场景**：
1. 用户已有 active 的 Stripe Subscription
2. 再次调用 `POST /payment/stripe/champion-subscription`

**预期结果**：
- ✅ 返回 HTTP 400 错误
- ✅ 错误信息：`{ code: 'ALREADY_SUBSCRIBED', message: 'You already have an active Stripe subscription for this novel.' }`
- ✅ 不会在 Stripe 端创建新的 Subscription

---

## 七、向后兼容性

### 7.1 已实现的向后兼容

1. ✅ `payment_record` 查询：优先使用新字段 `stripe_payment_intent_id`，向后兼容通过 `description` 查询
2. ✅ `description` 字段：保留用于人类可读，不强制要求解析字符串
3. ✅ 旧数据：`stripe_customer_id` 可以为 NULL，不强制补历史数据

### 7.2 注意事项

- ⚠️ `user_champion_subscription_record.transaction_id` 已改名为 `stripe_subscription_id`
- ⚠️ 如果代码中有直接使用 `transaction_id` 字段的地方，需要更新为 `stripe_subscription_id`
- ⚠️ 迁移后，旧的 `transaction_id` 数据会保留在 `stripe_subscription_id` 字段中（如果之前存储的是 sub_xxx）

---

## 八、后续优化建议

1. **逐步移除重复的 createSubscriptionRecord 方法**
   - `stripeService.createSubscriptionRecord()` - 可移除
   - `paypalServiceSDK.createSubscriptionRecord()` - 保留用于 PayPal

2. **统一 Webhook 处理路由**
   - 目前有两个 Webhook 处理路由，建议统一使用一个

3. **添加数据验证**
   - 在写入 `stripe_subscription_id` 时，验证格式是否为 `sub_xxx`
   - 在写入 `stripe_payment_intent_id` 时，验证格式是否为 `pi_xxx`
   - 在写入 `stripe_customer_id` 时，验证格式是否为 `cus_xxx`

---

## 九、修改文件清单

### 数据库迁移
- ✅ `backend/migrations/20251205_refactor_stripe_subscription_fields.sql`
- ✅ `backend/migrations/execute_refactor_stripe_subscription_fields.js`

### 代码修改
- ✅ `backend/services/unifiedPaymentService.js`
- ✅ `backend/services/stripeService.js`
- ✅ `backend/routes/payment.js`

---

## 十、执行顺序

1. **第一步**：执行数据库迁移
   ```bash
   node backend/migrations/execute_refactor_stripe_subscription_fields.js
   ```

2. **第二步**：重启后端服务
   ```bash
   # 确保代码修改已部署
   npm restart
   ```

3. **第三步**：测试验证
   - 测试新建订阅流程
   - 测试自动续费流程
   - 测试防重复创建逻辑

---

## 十一、回滚方案

如果迁移出现问题，可以执行以下 SQL 回滚：

```sql
-- 回滚 user_champion_subscription_record
ALTER TABLE user_champion_subscription_record
  CHANGE COLUMN stripe_subscription_id transaction_id VARCHAR(255) NULL;

-- 回滚 user_champion_subscription
ALTER TABLE user_champion_subscription
  DROP COLUMN stripe_customer_id;

-- 回滚 payment_record
ALTER TABLE payment_record
  DROP COLUMN stripe_subscription_id,
  DROP COLUMN stripe_payment_intent_id,
  DROP COLUMN stripe_customer_id;

-- 删除索引
DROP INDEX idx_payment_record_stripe_subscription_id ON payment_record;
DROP INDEX idx_payment_record_stripe_payment_intent_id ON payment_record;
DROP INDEX idx_payment_record_stripe_customer_id ON payment_record;
DROP INDEX idx_user_champion_subscription_stripe_customer_id ON user_champion_subscription;
```

**注意**：回滚后需要恢复代码到修改前的版本。

