# 支付宝沙箱集成说明

## ✅ 已完成的工作

### 1. 安装依赖
- ✅ 已安装 `alipay-sdk@^3.4.0` 包

### 2. 配置文件
- ✅ 创建 `backend/config/alipay.js` - 支付宝SDK初始化配置
- ✅ 更新 `backend/kongfuworld.env` - 添加沙箱和正式环境配置

### 3. 服务层
- ✅ 重写 `backend/services/alipayService.js` - 使用 alipay-sdk 实现转账功能

### 4. 集成到现有流程
- ✅ `backend/routes/admin.js` 中已集成支付宝转账功能
- ✅ 支持通过 `POST /api/admin/settlements/:incomeMonthlyId/pay` 发起支付宝转账

## 📋 环境变量配置

当前配置为**沙箱环境**（`ALIPAY_MODE=sandbox`），配置如下：

```env
ALIPAY_MODE=sandbox

# 沙箱环境
ALIPAY_SANDBOX_APP_ID=9021000157685180
ALIPAY_SANDBOX_GATEWAY=https://openapi-sandbox.dl.alipaydev.com/gateway.do
ALIPAY_SANDBOX_APP_PRIVATE_KEY="..."
ALIPAY_SANDBOX_PUBLIC_KEY="..."

# 正式环境（已配置，待权限申请通过后切换）
ALIPAY_APP_ID=2021006112658007
ALIPAY_GATEWAY=https://openapi.alipay.com/gateway.do
ALIPAY_APP_PRIVATE_KEY="..."
ALIPAY_PUBLIC_KEY="..."
```

## 🔄 切换到正式环境

当正式环境权限申请通过后，只需修改一行：

```env
ALIPAY_MODE=production
```

其他代码无需修改，SDK会自动使用正式环境的配置。

## 🧪 测试步骤

### 1. 重启后端服务
```bash
cd backend
npm start
# 或
npm run dev
```

### 2. 检查配置加载
查看控制台输出，应该看到：
```
支付宝SDK初始化: {
  mode: 'sandbox',
  appId: '已设置',
  privateKey: '已设置',
  publicKey: '已设置',
  gateway: 'https://openapi-sandbox.dl.alipaydev.com/gateway.do'
}
```

### 3. 测试转账功能
在管理后台的"结算总览"页面：
1. 选择一个未支付的结算记录
2. 选择支付方式为"支付宝"
3. 选择用户的支付宝账户
4. 点击"发起支付"

### 4. 沙箱测试账号
- 支付宝沙箱账号：使用支付宝沙箱环境提供的测试账号
- 转账金额：建议使用小额金额（如 0.01 元）进行测试

## 📝 API 使用说明

### 转账接口
```javascript
const alipayService = new AlipayService();

const result = await alipayService.transferToAccount(
  payeeAccount,      // 收款方支付宝账号（手机号或邮箱）
  amount,            // 转账金额（元）
  remark,            // 转账备注
  outBizNo,          // 商户订单号（用于幂等性，可选）
  payeeRealName      // 收款方真实姓名（可选，但建议提供）
);
```

### 查询转账状态
```javascript
const result = await alipayService.queryTransferStatus(
  outBizNo,          // 商户订单号
  orderId            // 支付宝订单号（可选）
);
```

## ⚠️ 注意事项

1. **沙箱环境限制**：
   - 沙箱环境仅用于测试，不会产生真实资金流动
   - 需要使用支付宝提供的沙箱测试账号

2. **正式环境切换**：
   - 确保已申请"单笔转账到支付宝账户"功能权限
   - 权限审核通过后，修改 `ALIPAY_MODE=production` 即可

3. **幂等性**：
   - 使用固定的 `out_biz_no`（格式：`ALIPAY_USER_{userId}_{YYYYMM}`）
   - 确保同一用户同一月份不会重复转账

4. **错误处理**：
   - 所有错误都会在控制台输出详细日志
   - API返回的 `success` 字段表示是否成功
   - 失败时会返回 `code`、`message` 等错误信息

## 🔍 故障排查

### 问题：配置未加载
- 检查 `backend/kongfuworld.env` 文件是否存在
- 检查环境变量名称是否正确
- 查看控制台初始化日志

### 问题：签名错误
- 检查私钥格式是否正确（包含 `\n` 转义字符）
- 确认私钥是 PKCS8 格式
- 验证私钥和公钥是否匹配

### 问题：API调用失败
- 检查网络连接
- 查看控制台详细错误日志
- 确认沙箱账号配置正确

## 📚 相关文档

- [支付宝开放平台](https://open.alipay.com/)
- [alipay-sdk npm包](https://www.npmjs.com/package/alipay-sdk)
- [单笔转账到支付宝账户API文档](https://opendocs.alipay.com/open/309/106236)

