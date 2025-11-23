# PayPal Webhook 配置指南

## 快速开始

### 1. 启动 ngrok

**方法1：使用批处理文件（推荐）**
```bash
# 双击运行 start_ngrok.bat
# 或在命令行执行：
start_ngrok.bat
```

**方法2：手动启动**
```powershell
C:\ngrok\ngrok.exe http 5000
```

### 2. 获取公网 URL

启动 ngrok 后，打开浏览器访问：
```
http://localhost:4040
```

你会看到 ngrok 的 Web 界面，显示类似：
```
Forwarding   https://abc123-def456.ngrok-free.app -> http://localhost:5000
```

复制 `https://abc123-def456.ngrok-free.app` 这个 URL。

### 3. 配置 PayPal Webhook

#### 步骤 1：登录 PayPal 开发者平台
访问：https://developer.paypal.com/home

#### 步骤 2：进入应用设置
1. 点击左侧菜单 "My Apps & Credentials"
2. 选择你的应用（Sandbox 或 Live）
3. 向下滚动找到 "Webhooks" 部分

#### 步骤 3：添加 Webhook
1. 点击 "Add Webhook" 或 "Update Webhook"
2. 在 "Webhook URL" 中输入：
   ```
   https://your-ngrok-url.ngrok-free.app/api/admin/webhooks/paypal
   ```
   将 `your-ngrok-url` 替换为你从 ngrok 获取的实际 URL

#### 步骤 4：选择事件类型
选择以下事件类型（至少选择这些）：
- ✅ `PAYMENT.PAYOUTSBATCH.SUCCESS` - 批次处理成功
- ✅ `PAYMENT.PAYOUTSBATCH.DENIED` - 批次被拒绝
- ✅ `PAYMENT.PAYOUTSBATCH.PROCESSING` - 批次处理中
- ✅ `PAYMENT.PAYOUTSBATCH.PENDING` - 批次待处理（可选）

#### 步骤 5：保存配置
点击 "Save" 保存 Webhook 配置

### 4. 测试 Webhook

#### 方法 1：使用 PayPal 测试工具
1. 在 Webhook 配置页面，点击 "Send Test Event"
2. 选择事件类型（例如：`PAYMENT.PAYOUTSBATCH.SUCCESS`）
3. 查看后端控制台日志，应该看到：
   ```
   [PayPal Webhook] 收到Webhook请求
   [PayPal Webhook] 事件类型: PAYMENT.PAYOUTSBATCH.SUCCESS
   ```

#### 方法 2：创建实际支付
1. 在管理后台创建一个 PayPal 支付订单
2. PayPal 会自动发送 Webhook 通知
3. 查看后端日志确认接收

## 验证 Webhook 是否工作

### 检查后端日志
当 PayPal 发送 Webhook 时，你应该看到：
```
[PayPal Webhook] 收到Webhook请求
[PayPal Webhook] 请求头: {...}
[PayPal Webhook] 请求体: {...}
[PayPal Webhook] 事件类型: PAYMENT.PAYOUTSBATCH.SUCCESS
[PayPal Webhook] 处理批次: 73VS7WR4L8CGL
[PayPal Webhook] 批次状态: SUCCESS
[PayPal Webhook] 支付单 3 已标记为paid
```

### 检查数据库状态
Webhook 处理成功后，数据库应该自动更新：
- `user_payout.status` → `paid`
- `payout_gateway_transaction.status` → `succeeded`
- `user_income_monthly.payout_status` → `paid`

## 常见问题

### Q: ngrok URL 每次启动都变化？
**A:** 是的，免费版 ngrok 每次启动 URL 都会变化。解决方案：
1. 注册 ngrok 账号（免费）：https://dashboard.ngrok.com/signup
2. 获取 authtoken
3. 配置 authtoken：`C:\ngrok\ngrok.exe config add-authtoken YOUR_TOKEN`
4. 使用固定域名（需要付费计划）

### Q: Webhook 没有收到？
**A:** 检查以下几点：
1. ngrok 是否正在运行？
2. 后端服务器是否运行在 5000 端口？
3. Webhook URL 是否正确配置？
4. 查看 PayPal 开发者平台的 Webhook 日志（有发送记录但失败）
5. 查看后端日志是否有错误

### Q: 如何查看 ngrok 的请求日志？
**A:** 访问 http://localhost:4040，可以看到所有通过 ngrok 的请求详情。

### Q: 生产环境如何配置？
**A:** 生产环境不需要 ngrok，直接使用你的服务器域名：
```
https://your-domain.com/api/admin/webhooks/paypal
```

## 当前 ngrok URL

**注意：** 每次启动 ngrok，URL 都会变化。请从 http://localhost:4040 获取最新的 URL。

## 下一步

配置完成后：
1. ✅ Webhook 会自动接收 PayPal 的状态更新
2. ✅ 数据库状态会自动同步
3. ✅ 无需手动查询状态

如果需要手动查询状态，可以使用：
```bash
GET /api/admin/payouts/:id/status
```

