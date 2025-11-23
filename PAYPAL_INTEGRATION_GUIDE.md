# PayPal 集成完整指南

## 🎯 概述

您的项目已经集成了PayPal支付功能！本指南将帮助您完成PayPal账户配置并开始收款。

## 📋 当前集成状态

✅ **已完成的功能:**
- PayPal SDK集成 (`@paypal/paypal-server-sdk`)
- 支付订单创建
- 支付成功回调处理
- 支付取消处理
- 用户余额更新
- 支付记录管理
- 前端支付界面

## 🚀 快速开始

### 1. 获取PayPal API凭据

#### 步骤1: 访问PayPal开发者控制台
1. 打开 [PayPal开发者控制台](https://developer.paypal.com/)
2. 使用您的PayPal账户登录
3. 点击 "Create App" 创建新应用

#### 步骤2: 创建应用
```
应用名称: kongfuworld
环境: Sandbox (测试) / Live (生产)
功能: Accept payments
```

#### 步骤3: 获取凭据
创建应用后，您将获得：
- **Client ID** - 客户端ID
- **Client Secret** - 客户端密钥

### 2. 配置环境变量

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

### 3. 测试PayPal集成

运行测试脚本验证配置：

```bash
cd backend
node test-paypal.js
```

## 💳 支付流程

### 前端支付流程
1. 用户点击支付按钮
2. 选择PayPal支付方式
3. 前端调用 `/api/payment/paypal/create`
4. 重定向到PayPal支付页面
5. 用户完成支付
6. 返回网站成功页面

### 后端处理流程
1. 创建PayPal支付订单
2. 记录支付到数据库
3. 处理支付成功回调
4. 更新用户余额
5. 发送支付确认

## 🔧 API接口

### 创建支付订单
```http
POST /api/payment/paypal/create
Content-Type: application/json

{
  "userId": 1,
  "amount": 10.00,
  "currency": "USD",
  "description": "WuxiaWorld Credits"
}
```

**响应:**
```json
{
  "success": true,
  "orderId": "ORDER_ID",
  "approvalUrl": "https://www.sandbox.paypal.com/checkoutnow?token=..."
}
```

### 支付成功回调
```http
GET /api/payment/paypal/success?orderId=ORDER_ID
```

### 支付取消
```http
GET /api/payment/paypal/cancel
```

## 🧪 测试环境

### PayPal Sandbox测试账户
PayPal提供测试账户用于开发测试：

**买家测试账户:**
- 邮箱: `sb-buyer@personal.example.com`
- 密码: `password123`

**卖家测试账户:**
- 使用您的PayPal账户

### 测试流程
1. 启动应用: `npm start`
2. 访问支付页面
3. 选择PayPal支付
4. 使用测试账户完成支付
5. 验证支付结果

## 🌐 生产环境部署

### 1. 升级到Live环境
1. 在PayPal开发者控制台切换到Live环境
2. 获取Live环境的Client ID和Secret
3. 更新环境变量:
   ```env
   PAYPAL_MODE=live
   PAYPAL_CLIENT_ID=你的Live环境客户端ID
   PAYPAL_CLIENT_SECRET=你的Live环境客户端密钥
   ```

### 2. 域名配置
确保在PayPal应用中配置正确的回调URL：
- 成功回调: `https://yourdomain.com/api/payment/paypal/success`
- 取消回调: `https://yourdomain.com/api/payment/paypal/cancel`

### 3. HTTPS要求
生产环境必须使用HTTPS，PayPal不支持HTTP回调。

## 📊 支付记录管理

### 数据库表结构
```sql
CREATE TABLE payment_record (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  payment_method VARCHAR(50) NOT NULL,
  status VARCHAR(20) NOT NULL,
  type VARCHAR(20) NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 查询支付记录
```http
GET /api/payment/history/:userId
```

## 🔒 安全注意事项

1. **保护API密钥**: 不要将 `.env` 文件提交到版本控制
2. **HTTPS**: 生产环境必须使用HTTPS
3. **验证支付**: 始终验证PayPal返回的支付状态
4. **日志记录**: 记录所有支付操作日志
5. **错误处理**: 妥善处理支付失败情况

## 🛠️ 故障排除

### 常见问题

**Q: 支付创建失败**
- 检查PayPal API凭据是否正确
- 确认网络连接正常
- 查看服务器日志

**Q: 支付成功后余额未更新**
- 检查数据库连接
- 验证回调URL配置
- 查看支付处理日志

**Q: 测试支付无法完成**
- 确认使用Sandbox环境
- 检查测试账户凭据
- 验证PayPal应用配置

### 调试工具
1. PayPal开发者控制台日志
2. 服务器控制台日志
3. 数据库支付记录
4. 浏览器开发者工具

## 📞 技术支持

如果遇到问题，可以：
1. 查看PayPal开发者文档
2. 检查服务器日志
3. 联系技术支持

## 🎉 开始收款

配置完成后，您的网站就可以开始接收PayPal支付了！

1. 用户选择PayPal支付
2. 跳转到PayPal支付页面
3. 用户完成支付
4. 资金自动转入您的PayPal账户
5. 用户获得网站积分

---

**恭喜！您的PayPal集成已经完成！** 🎊
