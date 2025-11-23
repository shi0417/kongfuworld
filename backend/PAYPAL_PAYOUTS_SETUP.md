# PayPal Payouts 状态查询和 Webhook 配置指南

## 功能说明

### 1. 状态查询接口

**接口地址：** `GET /api/admin/payouts/:id/status`

**功能：** 手动查询PayPal批次状态并更新数据库

**使用方法：**
```bash
# 查询支付单ID为3的状态
GET http://localhost:5000/api/admin/payouts/3/status
Authorization: Bearer <admin_token>
```

**返回示例：**
```json
{
  "success": true,
  "data": {
    "payout_id": 3,
    "batch_id": "73VS7WR4L8CGL",
    "paypal_status": "SUCCESS",
    "db_status": "succeeded",
    "items": [...],
    "paypal_response": {...}
  }
}
```

**状态说明：**
- `PENDING`: PayPal批次已创建，等待处理
- `PROCESSING`: PayPal正在处理中
- `SUCCESS`: PayPal处理成功，支付完成
- `DENIED`: PayPal拒绝支付
- `FAILED`: PayPal处理失败

### 2. Webhook 处理接口

**接口地址：** `POST /api/admin/webhooks/paypal`

**功能：** 接收PayPal的状态更新通知，自动更新数据库状态

**支持的事件类型：**
- `PAYMENT.PAYOUTSBATCH.SUCCESS` - 批次处理成功
- `PAYMENT.PAYOUTSBATCH.DENIED` - 批次被拒绝
- `PAYMENT.PAYOUTSBATCH.PROCESSING` - 批次处理中

## PayPal Webhook 配置步骤

### 1. 登录 PayPal 开发者平台

访问：https://developer.paypal.com/home

### 2. 进入 Webhook 配置页面

1. 点击左侧菜单 "My Apps & Credentials"
2. 选择你的应用（Sandbox 或 Live）
3. 找到 "Webhooks" 部分
4. 点击 "Add Webhook" 或 "Update Webhook"

### 3. 配置 Webhook URL

**Sandbox 环境：**
```
http://your-domain.com/api/admin/webhooks/paypal
```

**本地测试（使用 ngrok 等工具）：**
```
https://your-ngrok-url.ngrok.io/api/admin/webhooks/paypal
```

### 4. 选择事件类型

选择以下事件类型：
- `PAYMENT.PAYOUTSBATCH.SUCCESS`
- `PAYMENT.PAYOUTSBATCH.DENIED`
- `PAYMENT.PAYOUTSBATCH.PROCESSING`
- `PAYMENT.PAYOUTSBATCH.PENDING` (可选)

### 5. 保存配置

点击 "Save" 保存Webhook配置

## 本地测试 Webhook

### 使用 ngrok（推荐）

1. 安装 ngrok：
   ```bash
   # Windows
   choco install ngrok
   # 或下载：https://ngrok.com/download
   ```

2. 启动 ngrok：
   ```bash
   ngrok http 5000
   ```

3. 复制 HTTPS URL（例如：`https://abc123.ngrok.io`）

4. 在 PayPal 开发者平台配置 Webhook URL：
   ```
   https://abc123.ngrok.io/api/admin/webhooks/paypal
   ```

### 使用 PayPal Webhook 测试工具

PayPal 开发者平台提供 Webhook 测试工具：
1. 进入 Webhook 配置页面
2. 点击 "Send Test Event"
3. 选择事件类型
4. 查看后端日志确认接收

## 定期查询状态（可选）

如果需要定期查询状态，可以创建一个定时任务：

### 使用 node-cron

```javascript
const cron = require('node-cron');
const axios = require('axios');

// 每5分钟查询一次processing状态的支付单
cron.schedule('*/5 * * * *', async () => {
  // 查询所有processing状态的PayPal支付单
  // 调用状态查询接口更新状态
});
```

### 使用数据库查询 + API调用

```sql
-- 查询所有processing状态的PayPal支付单
SELECT up.id, pgt.response_payload 
FROM user_payout up
JOIN payout_gateway_transaction pgt ON up.gateway_tx_id = pgt.id
WHERE up.status = 'processing' 
AND up.method = 'paypal'
AND JSON_EXTRACT(pgt.response_payload, '$.batch_id') IS NOT NULL;
```

## 测试流程

### 1. 创建支付订单

通过管理后台创建PayPal支付订单，状态会变为 `processing`

### 2. 查询状态

**方法1：手动查询**
```bash
GET /api/admin/payouts/{payout_id}/status
```

**方法2：等待Webhook**
PayPal会自动发送Webhook通知（通常在几秒到几分钟内）

### 3. 验证状态更新

检查数据库：
- `user_payout.status` 应该更新为 `paid`（如果成功）
- `payout_gateway_transaction.status` 应该更新为 `succeeded`
- `user_income_monthly.payout_status` 应该更新为 `paid`

## 日志查看

所有操作都会记录详细日志，查看后端控制台：

```
[PayPal状态查询] 查询批次ID: 73VS7WR4L8CGL
[PayPal Webhook] 收到Webhook请求
[PayPal Webhook] 事件类型: PAYMENT.PAYOUTSBATCH.SUCCESS
[PayPal Webhook] 批次状态: SUCCESS
```

## 故障排查

### Webhook 未收到

1. 检查 Webhook URL 是否正确配置
2. 确认服务器可以接收外部请求（使用 ngrok 测试）
3. 查看 PayPal 开发者平台的 Webhook 日志
4. 检查后端日志是否有错误

### 状态未更新

1. 手动调用状态查询接口
2. 检查数据库连接
3. 查看后端日志错误信息
4. 确认批次ID是否正确

## 注意事项

1. **Sandbox vs Live：**
   - Sandbox 环境的 Webhook URL 和 Live 环境需要分别配置
   - Sandbox 环境通常响应很快（几秒内）
   - Live 环境可能需要几分钟

2. **安全性：**
   - Webhook 应该验证 PayPal 的签名（当前版本未实现，生产环境建议添加）
   - 使用 HTTPS 接收 Webhook
   - 限制 Webhook 端点的访问权限

3. **重试机制：**
   - PayPal 会自动重试失败的 Webhook
   - 建议实现幂等性处理，避免重复更新

4. **状态同步：**
   - 如果 Webhook 失败，可以定期查询状态作为备份
   - 建议同时使用 Webhook 和定期查询两种方式

