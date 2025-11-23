# PayPal 集成配置指南

## 1. 获取PayPal API凭据

### 步骤1：登录PayPal开发者控制台
1. 访问 [PayPal开发者控制台](https://developer.paypal.com/)
2. 使用您的PayPal账户登录
3. 点击 "Create App" 创建新应用

### 步骤2：创建应用
1. 应用名称：`kongfuworld`
2. 选择环境：
   - **Sandbox** (测试环境) - 用于开发测试
   - **Live** (生产环境) - 用于正式收款
3. 选择功能：`Accept payments`

### 步骤3：获取API凭据
创建应用后，您将获得：
- **Client ID** - 客户端ID
- **Client Secret** - 客户端密钥

## 2. 配置环境变量

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

## 3. 测试PayPal支付

### 测试账户
在Sandbox环境中，PayPal提供测试账户：
- **买家账户**：用于测试支付流程
- **卖家账户**：您的PayPal账户

### 测试流程
1. 启动后端服务器：`npm start`
2. 启动前端应用：`npm start`
3. 访问支付页面
4. 选择PayPal支付方式
5. 使用测试账户完成支付

## 4. 生产环境配置

### 升级到Live环境
1. 在PayPal开发者控制台中切换到Live环境
2. 获取Live环境的Client ID和Client Secret
3. 更新 `.env` 文件：
   ```env
   PAYPAL_MODE=live
   PAYPAL_CLIENT_ID=你的Live环境客户端ID
   PAYPAL_CLIENT_SECRET=你的Live环境客户端密钥
   ```

### 域名配置
确保您的域名已添加到PayPal应用的回调URL中：
- 成功回调：`https://yourdomain.com/payment/success`
- 取消回调：`https://yourdomain.com/payment/cancel`

## 5. 支付流程说明

### 前端支付流程
1. 用户选择PayPal支付
2. 前端调用 `/api/payment/paypal/create` 创建支付订单
3. 重定向到PayPal支付页面
4. 用户完成支付后返回网站
5. 后端处理支付结果

### 后端处理流程
1. 创建PayPal支付订单
2. 记录支付记录到数据库
3. 处理支付成功回调
4. 更新用户余额
5. 发送支付确认通知

## 6. 常见问题

### Q: 如何测试支付功能？
A: 使用PayPal Sandbox环境，创建测试账户进行支付测试。

### Q: 支付成功后用户余额没有更新？
A: 检查数据库连接和PayPal回调URL配置。

### Q: 如何查看支付记录？
A: 查看数据库中的 `payment_record` 表。

## 7. 安全注意事项

1. **保护API密钥**：不要将 `.env` 文件提交到版本控制
2. **HTTPS**：生产环境必须使用HTTPS
3. **验证支付**：始终验证PayPal返回的支付状态
4. **日志记录**：记录所有支付操作日志

## 8. 支持的功能

- ✅ 创建支付订单
- ✅ 处理支付成功回调
- ✅ 处理支付取消
- ✅ 更新用户余额
- ✅ 支付记录管理
- ✅ 多币种支持
- ✅ 移动端适配

## 9. 联系支持

如果遇到问题，可以：
1. 查看PayPal开发者文档
2. 检查服务器日志
3. 联系技术支持
