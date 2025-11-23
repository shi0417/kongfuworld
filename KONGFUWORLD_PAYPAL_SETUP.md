# kongfuworld PayPal 集成配置指南

## 🎯 应用信息

**应用名称**: `kongfuworld`  
**项目类型**: 武侠小说阅读平台  
**支付功能**: 用户充值积分系统  

## 📋 PayPal应用创建步骤

### 步骤1: 访问PayPal开发者控制台
1. 打开浏览器，访问：**https://developer.paypal.com/**
2. 点击右上角的 **"Log In"** 按钮
3. 使用您的PayPal账户登录

### 步骤2: 创建应用
1. 登录后，点击 **"Create App"** 按钮
2. 填写应用信息：
   ```
   应用名称: kongfuworld
   环境: Sandbox (测试环境) 或 Live (生产环境)
   功能: Accept payments
   ```
3. 点击 **"Create App"** 创建应用

### 步骤3: 获取API凭据
创建成功后，您会看到：
- **Client ID** - 客户端ID
- **Client Secret** - 客户端密钥

## 🔧 环境配置

在 `backend` 目录下创建 `.env` 文件：

```env
# 数据库配置
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=123456
DB_NAME=kongfuworld

# PayPal配置
PAYPAL_CLIENT_ID=你的PayPal客户端ID
PAYPAL_CLIENT_SECRET=你的PayPal客户端密钥
PAYPAL_MODE=sandbox  # 测试环境使用 'sandbox'，生产环境使用 'live'

# 前端URL配置
FRONTEND_URL=http://localhost:3000

# JWT密钥
JWT_SECRET=your-secret-key
```

## 🧪 测试配置

运行测试脚本验证配置：

```bash
cd backend
node test-paypal.js
```

## 💳 支付流程说明

### 用户支付流程
1. 用户在kongfuworld网站选择充值
2. 选择PayPal支付方式
3. 跳转到PayPal支付页面
4. 用户完成支付
5. 返回kongfuworld网站
6. 用户获得积分

### 支付项目信息
- **商品名称**: kongfuworld Credits
- **商品描述**: kongfuworld Credits Purchase
- **品牌名称**: kongfuworld

## 🔒 安全配置

### 回调URL配置
在PayPal应用中配置以下回调URL：
- **成功回调**: `https://yourdomain.com/api/payment/paypal/success`
- **取消回调**: `https://yourdomain.com/api/payment/paypal/cancel`

### 生产环境要求
- ✅ 使用HTTPS
- ✅ 配置正确的域名
- ✅ 使用Live环境的API凭据

## 📊 支付记录

所有支付记录将保存在数据库中：
- 用户ID
- 支付金额
- 支付方式
- 支付状态
- 创建时间

## 🎉 开始收款

配置完成后，kongfuworld就可以开始接收PayPal支付了！

1. 用户选择PayPal充值
2. 跳转到PayPal支付页面
3. 用户完成支付
4. 资金转入您的PayPal账户
5. 用户获得kongfuworld积分

---

**kongfuworld PayPal集成配置完成！** 🥋

