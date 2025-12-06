# Champion 自动续费功能新版实现总结

**实现时间**: 2025-12-04  
**版本**: 2.0 - 动态 Price 管理版本  
**功能范围**: 仅 Stripe 路径的自动续费订阅，使用数据库动态管理 Stripe Price

---

## ✅ 已完成的实现

### 一、数据库修改

#### 1. `novel_champion_tiers` 表新增字段
- **迁移文件**: `backend/migrations/20251204_add_stripe_price_fields_to_novel_champion_tiers.sql`
- **执行脚本**: `backend/migrations/execute_add_stripe_price_fields.js`
- **新增字段**:
  - `stripe_price_id` VARCHAR(128) NULL - 存储 Stripe Price ID（首次使用时动态创建）
  - `currency` VARCHAR(10) NOT NULL DEFAULT 'USD' - 币种
- **索引**: `idx_stripe_price_id` - 用于快速查询

#### 2. `user_champion_subscription` 表字段（已存在）
- `stripe_subscription_id` - Stripe 订阅 ID
- `cancel_at_period_end` - 是否在周期结束后取消
- `cancelled_at` - 取消时间
- `auto_renew` - 是否自动续费

### 二、后端实现

#### 1. Champion Service (`backend/services/championService.js`)

**新增函数**: `getOrCreateStripePriceForChampionTier()`
- **功能**: 为每个「小说 + tier_level」组合动态创建 Stripe Price
- **逻辑**:
  1. 从 `novel_champion_tiers` 查询记录
  2. 如果 `stripe_price_id` 已存在，验证后直接返回
  3. 如果不存在，调用 Stripe API 创建 Price：
     - 使用 `monthly_price * 100` 作为 `unit_amount`（转换为分）
     - 使用 `currency` 字段（默认 USD）
     - 设置 `recurring: { interval: 'month' }`
     - 使用 `STRIPE_CHAMPION_PRODUCT_ID`（如果配置）或创建默认 Product
     - 在 metadata 中保存 `novel_id`, `tier_level`, `tier_name`
  4. 将 `price.id` 写回数据库 `stripe_price_id` 字段
  5. 返回 `{ priceId, monthlyPrice, currency, tierName, tierRow }`

#### 2. Stripe Service (`backend/services/stripeService.js`)

**修改函数**: `createChampionSubscription()`
- **变更**: 
  - 移除了环境变量 `STRIPE_CHAMPION_PRICE_TIER_1~13` 的依赖
  - 改为接收 `priceId` 参数（由调用方通过 `getOrCreateStripePriceForChampionTier` 获取）
  - 返回 `currentPeriodStart` 和 `currentPeriodEnd`（使用 Stripe 提供的周期时间）

**保留函数**:
- `getOrCreateCustomer()` - 获取或创建 Stripe Customer
- `cancelSubscriptionAtPeriodEnd()` - 取消订阅
- `handleInvoicePaymentSucceeded()` - Webhook 续费处理（已使用 invoice period 时间）

#### 3. Unified Payment Service (`backend/services/unifiedPaymentService.js`)

**修改函数**: `handleStripeChampionSubscriptionCreated()`
- **变更**:
  - 接收 `monthlyPrice` 和 `currency` 参数（不再从数据库查询）
  - **使用 Stripe 提供的周期时间**（`subscription.current_period_start` / `current_period_end`）而不是简单的 +30 天
  - 计算 `subscriptionDurationDays` 基于实际周期天数
  - 返回 `currentPeriodStart` 和 `currentPeriodEnd`

#### 4. 路由 (`backend/routes/payment.js`)

**修改路由**: `POST /payment/stripe/champion-subscription`
- **变更**:
  1. 调用 `championService.getOrCreateStripePriceForChampionTier()` 获取动态 Price
  2. 使用获取的 `priceId` 调用 `stripeService.createChampionSubscription()`
  3. 传递 `monthlyPrice` 和 `currency` 给 `handleStripeChampionSubscriptionCreated()`
  4. 返回 `currentPeriodStart` 和 `currentPeriodEnd`

**新增依赖**: 引入 `ChampionService`

#### 5. 路由 (`backend/routes/champion.js`)

**保留功能**:
- `POST /champion/subscription/:id/cancel` - 取消订阅（已实现）
- `GET /champion/user-subscriptions` - 返回订阅列表（已包含新字段）

### 三、前端实现

#### 1. ChampionDisplay 组件 (`frontend/src/components/ChampionDisplay/ChampionDisplay.tsx`)

- ✅ 自动续费勾选框（仅 Stripe）
- ✅ `handleStripeSubscription()` - 调用订阅接口
- ✅ 显示 `currentPeriodStart` 和 `currentPeriodEnd`

#### 2. PaymentModal 组件 (`frontend/src/components/PaymentModal/PaymentModal.tsx`)

- ✅ 自动续费勾选框（仅 Stripe 时显示）
- ✅ 文案: "Auto-renew this Champion every month (Stripe only)"

#### 3. 订阅列表页面

- ✅ `frontend/src/pages/Champion.tsx` - 显示自动续费状态和取消按钮
- ✅ `frontend/src/components/UserCenter/Champion.tsx` - 同样的功能

---

## 🔄 工作流程（新版）

### 创建自动续费订阅

1. 用户选择 tier 并勾选自动续费
2. 前端调用 `POST /payment/stripe/champion-subscription`
3. 后端调用 `championService.getOrCreateStripePriceForChampionTier()`:
   - 查询 `novel_champion_tiers` 表
   - 如果 `stripe_price_id` 为空，创建 Stripe Price 并写回数据库
   - 返回 `priceId`
4. 后端调用 `stripeService.createChampionSubscription()` 创建订阅
5. 后端调用 `unifiedPaymentService.handleStripeChampionSubscriptionCreated()`:
   - 使用 Stripe 提供的 `current_period_start` / `current_period_end`
   - 写入 `user_champion_subscription` 和 `user_champion_subscription_record`

### 自动续费流程

1. Stripe 在每个周期结束时自动扣款
2. Stripe 发送 `invoice.payment_succeeded` Webhook
3. 后端 `handleInvoicePaymentSucceeded()` 处理：
   - 使用 `invoice.lines.data[0].period.start/end` 作为周期时间
   - 更新 `end_date` 为 `period.end`
   - 创建新的 `subscription_record`（`subscription_type = 'renew'`）

### 取消自动续费

- 流程保持不变，调用 `POST /champion/subscription/:id/cancel`

---

## ⚠️ 重要配置要求

### 1. 环境变量配置

**可选配置**（如果不配置，系统会自动创建默认 Product）:
```env
STRIPE_CHAMPION_PRODUCT_ID=prod_xxxxx
```

**如何获取 Product ID**:
1. 登录 Stripe Dashboard
2. 进入 Products
3. 创建或选择一个 Product（用于所有 Champion 订阅）
4. 复制 Product ID 到环境变量

**注意**: 如果不配置，系统会在首次创建 Price 时自动创建一个默认 Product。

### 2. 数据库迁移

**已执行**: 
- ✅ `novel_champion_tiers` 表已添加 `stripe_price_id` 和 `currency` 字段
- ✅ `user_champion_subscription` 表已添加 Stripe 订阅相关字段

### 3. Stripe Webhook 配置

在 Stripe Dashboard 中配置 Webhook：
- **Endpoint URL**: `https://your-domain.com/api/payment/stripe/webhook`
- **监听事件**: 
  - `invoice.payment_succeeded` ✅（用于续费）

---

## 📝 关键改进点

### 1. 动态 Price 管理
- ✅ **不再依赖环境变量**: 移除了 `STRIPE_CHAMPION_PRICE_TIER_1~13` 的依赖
- ✅ **数据库驱动**: 所有 Price 信息从 `novel_champion_tiers` 表读取
- ✅ **首次创建**: 首次使用时自动创建 Stripe Price 并保存到数据库
- ✅ **后续复用**: 已创建的 Price 会被复用，避免重复创建

### 2. 精确的周期时间
- ✅ **使用 Stripe 周期**: 不再使用简单的 +30 天，而是使用 Stripe 提供的 `current_period_start` / `current_period_end`
- ✅ **Webhook 处理**: 续费时使用 `invoice.lines.data[0].period.start/end`

### 3. 币种支持
- ✅ **数据库字段**: `novel_champion_tiers.currency` 支持不同币种
- ✅ **默认 USD**: 新记录默认为 USD

---

## 🔍 数据库字段检查

### `novel_champion_tiers` 表
- ✅ `stripe_price_id` - 已添加
- ✅ `currency` - 已添加（默认 USD）

### `user_champion_subscription` 表
- ✅ `stripe_subscription_id` - 已存在
- ✅ `cancel_at_period_end` - 已存在
- ✅ `cancelled_at` - 已存在
- ✅ `auto_renew` - 已存在

---

## 📁 修改的文件清单

### 数据库
- `backend/migrations/20251204_add_stripe_price_fields_to_novel_champion_tiers.sql` (新建)
- `backend/migrations/execute_add_stripe_price_fields.js` (新建)

### 后端
- `backend/services/championService.js` (修改 - 新增 `getOrCreateStripePriceForChampionTier`)
- `backend/services/stripeService.js` (修改 - `createChampionSubscription` 使用动态 Price)
- `backend/services/unifiedPaymentService.js` (修改 - 使用 Stripe 周期时间)
- `backend/routes/payment.js` (修改 - 使用动态 Price 创建订阅)

### 前端
- `frontend/src/components/ChampionDisplay/ChampionDisplay.tsx` (修改 - 显示周期时间)

---

## 🧪 测试建议

1. **动态 Price 创建测试**:
   - 选择一个没有 `stripe_price_id` 的 tier 创建订阅
   - 验证 Stripe Dashboard 中 Price 已创建
   - 验证数据库 `stripe_price_id` 已保存
   - 再次创建相同 tier 的订阅，验证复用已有 Price

2. **周期时间测试**:
   - 创建订阅后，验证 `start_date` 和 `end_date` 与 Stripe 的周期时间一致
   - 续费后，验证 `end_date` 使用 invoice period.end

3. **币种测试**:
   - 修改 `novel_champion_tiers.currency` 为其他币种
   - 验证创建的 Stripe Price 使用正确的币种

---

## ✅ 兼容性保证

- ✅ PayPal 路径完全不受影响
- ✅ Stripe 一次性支付（不勾选自动续费）保持原有逻辑
- ✅ 所有新逻辑只在用户选择 Stripe + 勾选自动续费时生效

---

**实现完成时间**: 2025-12-04  
**状态**: ✅ 所有功能已实现，数据库迁移已执行

