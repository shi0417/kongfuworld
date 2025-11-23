# API响应格式标准化规范

## 📋 概述

本文档定义了项目中所有API的响应格式标准，确保前后端数据交互的一致性。

## 🎯 统一响应格式

### **成功响应格式**

```json
{
  "success": true,
  "data": {
    // 业务数据
  },
  "message": "操作成功",
  "timestamp": "2025-01-22T02:45:00.000Z"
}
```

### **错误响应格式**

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "参数验证失败",
    "details": {
      "field": "userId",
      "reason": "用户ID不能为空"
    }
  },
  "timestamp": "2025-01-22T02:45:00.000Z"
}
```

## 💳 支付API响应格式

### **Stripe支付创建响应**

```json
{
  "success": true,
  "clientSecret": "pi_xxx_secret_xxx",
  "paymentIntentId": "pi_xxx",
  "paymentRecordId": 123,
  "status": "requires_payment_method",
  "message": "支付意图创建成功"
}
```

### **PayPal支付创建响应**

```json
{
  "success": true,
  "orderId": "PAYPAL_ORDER_ID",
  "approvalUrl": "https://www.sandbox.paypal.com/checkoutnow?token=xxx",
  "paymentRecordId": 123,
  "message": "PayPal支付订单创建成功"
}
```

## 🔧 实施指南

### **1. 后端API修改**

所有支付相关API都应使用统一的响应格式：

```javascript
// ✅ 正确的格式
res.json({
  success: true,
  clientSecret: paymentIntent.client_secret,
  paymentIntentId: paymentIntent.id,
  paymentRecordId: paymentRecordId,
  status: paymentIntent.status,
  message: "支付意图创建成功"
});

// ❌ 避免嵌套在data中
res.json({
  success: true,
  data: {
    clientSecret: paymentIntent.client_secret,
    // ...
  }
});
```

### **2. 前端代码修改**

前端代码应直接访问响应字段：

```typescript
// ✅ 正确的访问方式
const { clientSecret, paymentIntentId } = response;

// ❌ 避免兼容性处理
const { clientSecret, paymentIntentId } = response.data || response;
```

### **3. 类型定义**

为API响应创建TypeScript接口：

```typescript
interface StripePaymentResponse {
  success: boolean;
  clientSecret: string;
  paymentIntentId: string;
  paymentRecordId: number;
  status: string;
  message: string;
}

interface PayPalPaymentResponse {
  success: boolean;
  orderId: string;
  approvalUrl: string;
  paymentRecordId: number;
  message: string;
}
```

## 📝 修改记录

### **2025-01-22**
- 统一Karma和Champion支付API响应格式
- 移除前端兼容性处理代码
- 创建API响应格式标准文档

## 🚀 未来改进

1. **自动化测试**：添加API响应格式验证测试
2. **API文档**：使用Swagger/OpenAPI生成标准文档
3. **中间件**：创建响应格式标准化中间件
4. **监控**：添加API响应格式一致性监控

## ✅ 检查清单

- [x] 统一Karma支付API响应格式
- [x] 统一Champion支付API响应格式
- [x] 更新前端代码移除兼容性处理
- [x] 创建API响应格式标准文档
- [ ] 添加API响应格式测试
- [ ] 更新API文档
- [ ] 添加响应格式验证中间件
