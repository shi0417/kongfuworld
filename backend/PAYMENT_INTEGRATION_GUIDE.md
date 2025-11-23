# 国际支付集成指南

## 概述
本指南将帮助你在WuxiaWorld网站中集成PayPal和Stripe国际支付系统。

## 1. 环境配置

### 安装依赖
```bash
cd backend
npm install paypal-rest-sdk stripe dotenv
```

### 环境变量配置
复制 `env.example` 到 `.env` 并配置以下变量：

```env
# PayPal配置
PAYPAL_MODE=sandbox  # 或 'live' 用于生产环境
PAYPAL_CLIENT_ID=your_paypal_client_id
PAYPAL_CLIENT_SECRET=your_paypal_client_secret

# Stripe配置
STRIPE_PUBLISHABLE_KEY=pk_test_your_stripe_publishable_key
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret

# 数据库配置
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=kongfuworld

# 前端URL
FRONTEND_URL=http://localhost:3000
```

## 2. PayPal 集成

### 获取PayPal凭证
1. 访问 [PayPal Developer](https://developer.paypal.com/)
2. 创建应用获取 Client ID 和 Client Secret
3. 在沙盒环境中测试

### PayPal API端点
- `POST /api/payment/paypal/create` - 创建PayPal支付
- `GET /api/payment/paypal/success` - PayPal支付成功回调
- `GET /api/payment/paypal/cancel` - PayPal支付取消

## 3. Stripe 集成

### 获取Stripe凭证
1. 访问 [Stripe Dashboard](https://dashboard.stripe.com/)
2. 获取 API Keys
3. 设置 Webhook 端点

### Stripe API端点
- `POST /api/payment/stripe/create-payment-intent` - 创建支付意图
- `POST /api/payment/stripe/webhook` - Stripe Webhook处理
- `POST /api/payment/stripe/create-subscription` - 创建订阅

## 4. 前端集成

### 安装前端依赖
```bash
cd frontend
npm install @stripe/stripe-js @stripe/react-stripe-js
```

### 使用支付组件
```tsx
import PaymentModal from './components/Payment/PaymentModal';

function App() {
  const [showPayment, setShowPayment] = useState(false);
  
  return (
    <div>
      <button onClick={() => setShowPayment(true)}>
        Buy Credits
      </button>
      
      <PaymentModal
        isOpen={showPayment}
        onClose={() => setShowPayment(false)}
        amount={10.00}
        currency="USD"
        onPaymentSuccess={(paymentId) => {
          console.log('Payment successful:', paymentId);
          setShowPayment(false);
        }}
      />
    </div>
  );
}
```

## 5. 数据库表结构

### payment_record 表
记录所有支付交易：
- `user_id` - 用户ID
- `amount` - 支付金额
- `payment_method` - 支付方式 (paypal/stripe)
- `status` - 支付状态 (pending/completed/failed)
- `type` - 支付类型 (recharge/chapter_purchase/champion_subscribe)
- `description` - 支付描述

### user 表
用户账户信息：
- `balance` - 用户余额
- `points` - 用户积分
- `karma` - 功德值
- `is_vip` - VIP状态
- `vip_expire_at` - VIP到期时间

## 6. 支付流程

### PayPal支付流程
1. 用户选择PayPal支付
2. 前端调用 `/api/payment/paypal/create`
3. 后端创建PayPal支付订单
4. 用户重定向到PayPal支付页面
5. 支付成功后回调 `/api/payment/paypal/success`
6. 更新用户余额和支付状态

### Stripe支付流程
1. 用户选择Stripe支付
2. 前端调用 `/api/payment/stripe/create-payment-intent`
3. 后端创建Stripe支付意图
4. 前端使用Stripe Elements处理支付
5. 支付成功后Webhook更新状态
6. 更新用户余额

## 7. 安全注意事项

### 环境安全
- 生产环境使用 `live` 模式
- 保护API密钥安全
- 使用HTTPS传输

### 数据验证
- 验证支付金额
- 检查用户权限
- 防止重复支付

### Webhook安全
- 验证Webhook签名
- 处理重复事件
- 记录所有支付事件

## 8. 测试

### PayPal测试
1. 使用PayPal沙盒账户
2. 测试支付成功和失败场景
3. 验证回调处理

### Stripe测试
1. 使用Stripe测试卡号
2. 测试不同支付方式
3. 验证Webhook处理

## 9. 部署

### 生产环境配置
1. 更新环境变量为生产值
2. 配置生产数据库
3. 设置正确的回调URL
4. 配置SSL证书

### 监控和日志
1. 设置支付监控
2. 记录支付日志
3. 设置异常告警

## 10. 常见问题

### PayPal问题
- 检查Client ID和Secret
- 验证回调URL配置
- 检查沙盒/生产环境设置

### Stripe问题
- 验证API密钥
- 检查Webhook配置
- 确认支付意图状态

### 数据库问题
- 检查表结构
- 验证外键约束
- 确认数据一致性

## 11. 支持

如有问题，请检查：
1. 环境变量配置
2. API密钥有效性
3. 网络连接状态
4. 数据库连接
5. 日志文件内容
