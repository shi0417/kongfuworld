# 支付宝支付集成配置指南

## 当前状态

**重要提示：** 目前支付宝支付使用的是**模拟数据**。代码中可以看到：

```javascript
// backend/routes/admin.js 第5288-5296行（旧代码）
} else if (method === 'alipay') {
  // TODO: 调用支付宝转账API
  // 目前先模拟成功
  paymentResult = {
    success: true,
    tx_id: `ALIPAY_${Date.now()}`,
    message: '支付宝转账已发起'
  };
}
```

这就是为什么您看到订单显示成功，但没有真实的支付宝交易记录。

## 集成真实支付宝支付的步骤

### 1. 注册支付宝开放平台账号

1. 访问 [支付宝开放平台](https://open.alipay.com/)
2. 使用企业支付宝账号登录（需要企业认证）
3. 完成企业实名认证

### 2. 创建应用并获取密钥

1. 在开放平台中创建应用
2. 获取应用的 `APPID`
3. 生成 RSA2 密钥对：
   - **应用私钥**：用于签名请求
   - **应用公钥**：上传到支付宝开放平台
   - **支付宝公钥**：从开放平台获取，用于验证响应

### 3. 申请转账功能权限

1. 在应用的功能列表中，添加 **"单笔转账到支付宝账户"** 功能
2. 提交申请并等待审核通过（通常需要1-3个工作日）

### 4. 配置环境变量

在 `backend/kongfuworld.env` 文件中添加以下配置：

```env
# 支付宝配置
ALIPAY_APP_ID=你的应用APPID
ALIPAY_PRIVATE_KEY=你的应用私钥（PKCS8格式，包含-----BEGIN PRIVATE KEY-----和-----END PRIVATE KEY-----）
ALIPAY_PUBLIC_KEY=支付宝公钥（包含-----BEGIN PUBLIC KEY-----和-----END PUBLIC KEY-----）
ALIPAY_GATEWAY=https://openapi.alipay.com/gateway.do  # 生产环境
# ALIPAY_GATEWAY=https://openapi.alipaydev.com/gateway.do  # 沙箱环境（测试用）
```

**私钥格式示例：**
```
ALIPAY_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC...
（多行内容）
...
-----END PRIVATE KEY-----"
```

### 5. 代码已集成

我已经创建了 `backend/services/alipayService.js` 服务类，并更新了支付逻辑。代码会自动：

1. 读取环境变量中的支付宝配置
2. 调用支付宝"单笔转账到支付宝账户"API
3. 处理响应并更新数据库状态
4. 支持幂等性（使用商户订单号防止重复支付）

### 6. 收款账户信息格式

在 `user_payout_account` 表中，支付宝账户的 `account_data` JSON 格式应为：

```json
{
  "account": "13800138000",  // 或邮箱 "user@example.com"
  "name": "张三"  // 收款方真实姓名（可选，但建议提供以提高成功率）
}
```

或者：

```json
{
  "login_id": "13800138000",  // 支付宝登录账号
  "real_name": "张三"  // 收款方真实姓名
}
```

### 7. 测试

1. **沙箱环境测试**：
   - 使用沙箱网关：`https://openapi.alipaydev.com/gateway.do`
   - 使用沙箱测试账号进行转账测试

2. **生产环境**：
   - 确保企业认证完成
   - 转账功能权限已审核通过
   - 使用生产网关：`https://openapi.alipay.com/gateway.do`

### 8. 注意事项

1. **转账限额**：
   - 单笔转账限额：根据企业资质不同，通常为 5万-100万 元/笔
   - 日累计限额：根据企业资质不同

2. **手续费**：
   - 支付宝转账到支付宝账户通常免费
   - 转账到银行卡可能收取手续费

3. **到账时间**：
   - 转账到支付宝账户：通常即时到账
   - 转账到银行卡：通常1-2个工作日

4. **真实姓名验证**：
   - 建议提供收款方真实姓名，可以提高转账成功率
   - 如果姓名与支付宝账号不匹配，转账可能失败

### 9. 错误处理

代码已经实现了错误处理：
- 如果支付宝API调用失败，会更新 `payout_gateway_transaction` 状态为 `failed`
- 错误信息会保存在 `error_message` 和 `error_code` 字段中
- 可以通过展开表格行查看详细的错误信息

## 银行转账

对于 `bank_transfer` 和 `manual` 支付方式，系统会创建支付订单但不自动发起支付，需要管理员手动完成转账操作。

## 相关文档

- [支付宝开放平台文档](https://opendocs.alipay.com/)
- [单笔转账到支付宝账户API文档](https://opendocs.alipay.com/apis/api_28/alipay.fund.trans.toaccount.transfer)

