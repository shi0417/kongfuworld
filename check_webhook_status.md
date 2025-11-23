# Webhook 状态检查指南

## 从你的日志分析

### ✅ 支付创建成功
- 批次ID: `WXBNDMZLSMHJQ`
- PayPal状态: `PENDING`
- 数据库状态: `processing` ✅（正确）

### ❓ Webhook 状态
**没有看到 Webhook 日志**，可能的原因：

1. **PayPal 还未发送 Webhook**
   - Sandbox 环境可能需要几秒到几分钟
   - PENDING 状态时可能不会立即发送 Webhook

2. **Webhook URL 配置问题**
   - 检查 PayPal 开发者平台的 Webhook URL 是否正确
   - 确认 ngrok 是否正在运行

3. **ngrok 未接收请求**
   - 检查 ngrok 界面（http://localhost:4040）是否有请求记录

## 检查步骤

### 1. 检查 ngrok 是否收到请求

打开浏览器访问：
```
http://localhost:4040
```

查看 "Inspect" 标签页，看是否有来自 PayPal 的请求。

### 2. 检查 PayPal Webhook 配置

访问 PayPal 开发者平台：
1. 进入你的应用 → Webhooks
2. 查看 Webhook 的 "Delivery" 记录
3. 看是否有发送记录和响应状态

### 3. 手动查询状态

由于 Webhook 可能还未到达，可以手动查询状态：

```bash
GET /api/admin/payouts/{payout_id}/status
```

这会：
- 查询 PayPal 批次最新状态
- 自动更新数据库状态
- 如果状态变为 SUCCESS，会自动标记为 paid

### 4. 等待 Webhook

PayPal Sandbox 通常在几秒到几分钟内发送 Webhook。如果批次状态变为 SUCCESS，应该会收到：
- `PAYMENT.PAYOUTSITEM.SUCCEEDED` 事件

## 预期行为

### 当 Webhook 正常工作时，你应该看到：

```
[PayPal Webhook] 收到Webhook请求
[PayPal Webhook] 请求头: {...}
[PayPal Webhook] 请求体: {...}
[PayPal Webhook] 事件类型: PAYMENT.PAYOUTSITEM.SUCCEEDED
[PayPal Webhook] 处理支付项目事件，批次ID: WXBNDMZLSMHJQ, 项目ID: xxx, 事件类型: PAYMENT.PAYOUTSITEM.SUCCEEDED
[PayPal Webhook] 批次状态: SUCCESS, 事件类型: PAYMENT.PAYOUTSITEM.SUCCEEDED, 数据库状态: succeeded
[PayPal Webhook] 支付单 X 已标记为paid（通过PAYMENT.PAYOUTSITEM.SUCCEEDED事件）
```

## 故障排查

如果 Webhook 没有收到：

1. **确认 ngrok 正在运行**
   ```bash
   # 检查 ngrok 进程
   # 访问 http://localhost:4040 确认
   ```

2. **确认 Webhook URL 正确**
   ```
   https://unfasciated-villalike-bernice.ngrok-free.dev/api/admin/webhooks/paypal
   ```
   （注意：如果 ngrok 重启，URL 会变化）

3. **检查后端服务器日志**
   - 查看是否有错误信息
   - 确认服务器正在监听 5000 端口

4. **使用 PayPal 测试工具**
   - 在 PayPal Webhook 配置页面点击 "Send Test Event"
   - 选择 `PAYMENT.PAYOUTSITEM.SUCCEEDED`
   - 查看后端是否收到

## 建议

1. **等待几分钟**，PayPal Sandbox 可能需要时间处理
2. **手动查询状态**，使用状态查询接口
3. **检查 ngrok 日志**，确认是否有请求到达
4. **测试 Webhook**，使用 PayPal 的测试功能

