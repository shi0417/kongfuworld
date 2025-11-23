# 支付宝配置检查清单

## ✅ 已完成
- [x] 注册支付宝开放平台账号
- [x] 创建应用（APPID: 2021006112658007）
- [x] 生成密钥对
- [x] 上传应用公钥到开放平台
- [x] 获取支付宝公钥

## ⚠️ 待完成

### 1. 保存应用私钥（重要！）
- [ ] 找到应用私钥文件（如果使用开放平台密钥工具生成，在保存路径中）
- [ ] 妥善保存应用私钥（开放平台不会保存，丢失后需要重新配置）
- [ ] 私钥格式应该是 PKCS8 格式，包含：
  ```
  -----BEGIN PRIVATE KEY-----
  （私钥内容）
  -----END PRIVATE KEY-----
  ```

### 2. 配置环境变量
- [ ] 在 `backend/kongfuworld.env` 文件中添加支付宝配置
- [ ] 设置 `ALIPAY_APP_ID=2021006112658007`
- [ ] 设置 `ALIPAY_PRIVATE_KEY`（应用私钥，多行格式）
- [ ] 设置 `ALIPAY_PUBLIC_KEY`（支付宝公钥，已在弹窗中显示）
- [ ] 设置 `ALIPAY_GATEWAY`（生产环境或沙箱环境）

### 3. 申请转账功能权限（重要！）
- [ ] 在支付宝开放平台中，进入应用的"可调用产品"页面
- [ ] 搜索并添加"单笔转账到支付宝账户"功能
- [ ] 提交申请并等待审核通过（通常需要1-3个工作日）
- [ ] **注意：没有这个权限，无法调用转账API**

### 4. 测试配置
- [ ] 重启后端服务（让环境变量生效）
- [ ] 检查后端日志，确认支付宝配置已加载
- [ ] 使用沙箱环境进行测试（如果已申请沙箱权限）
- [ ] 测试一笔小额转账，验证功能是否正常

## 配置示例

### 环境变量格式（kongfuworld.env）

```env
# 支付宝配置
ALIPAY_APP_ID=2021006112658007
ALIPAY_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC...
（你的应用私钥内容，多行）
...
-----END PRIVATE KEY-----"
ALIPAY_PUBLIC_KEY="-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAzhw/WjMaLupPYsdX6lcf...
（支付宝公钥内容，多行）
...
-----END PUBLIC KEY-----"
# 生产环境
ALIPAY_GATEWAY=https://openapi.alipay.com/gateway.do
# 沙箱环境（测试用）
# ALIPAY_GATEWAY=https://openapi.alipaydev.com/gateway.do
```

### 注意事项

1. **私钥格式**：
   - 必须是 PKCS8 格式
   - 必须包含 `-----BEGIN PRIVATE KEY-----` 和 `-----END PRIVATE KEY-----`
   - 多行内容需要用 `\n` 连接，或者直接换行（取决于环境变量解析方式）

2. **公钥格式**：
   - 必须包含 `-----BEGIN PUBLIC KEY-----` 和 `-----END PUBLIC KEY-----`
   - 从弹窗中复制的公钥可能需要添加这些标记

3. **功能权限**：
   - 必须申请"单笔转账到支付宝账户"功能权限
   - 没有权限时，API调用会返回权限不足的错误

4. **测试建议**：
   - 先在沙箱环境测试
   - 使用小额金额测试
   - 确认功能正常后再切换到生产环境

## 验证配置是否成功

1. 重启后端服务后，查看控制台日志，应该看到：
   ```
   支付宝配置初始化: {
     appId: '已设置',
     privateKey: '已设置',
     publicKey: '已设置',
     gateway: 'https://openapi.alipay.com/gateway.do'
   }
   ```

2. 如果配置有误，会看到错误信息，根据错误信息调整配置。

3. 尝试发起一笔支付宝支付，查看日志中的支付宝API调用结果。

