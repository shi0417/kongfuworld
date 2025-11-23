# QQ企业邮箱（腾讯企业邮箱）SMTP配置指南

## 重要信息

根据您的QQ企业邮箱设置页面，以下是正确的配置信息：

### SMTP服务器配置
- **SMTP服务器地址**: `smtp.exmail.qq.com`
- **端口**: `465`
- **安全连接**: `SSL/TLS`（使用SSL）
- **用户名**: `admin@kongfuworld.com`
- **密码**: 需要使用**授权码**，而不是登录密码

## 配置步骤

### 1. 获取授权码

QQ企业邮箱需要使用**授权码**而不是登录密码来发送邮件。获取授权码的步骤：

1. 登录QQ企业邮箱（https://exmail.qq.com）
2. 进入"设置" → "账户"
3. 找到"账户安全"或"客户端专用密码"选项
4. 生成或查看授权码
5. **重要**：授权码通常是一串16位字符，请妥善保管

### 2. 配置环境变量

在 `backend/kongfuworld.env` 文件中添加以下配置：

```env
# QQ企业邮箱SMTP配置
SMTP_HOST=smtp.exmail.qq.com
SMTP_PORT=465
SMTP_USER=admin@kongfuworld.com
SMTP_PASSWORD=your_authorization_code_here
```

**注意**：
- `SMTP_PASSWORD` 应该填写**授权码**，不是邮箱登录密码
- 授权码通常类似：`abcdefghijklmnop`（16位字符）

### 3. 验证服务已开启

确保在QQ企业邮箱设置中：
- ✅ **开启IMAP/SMTP服务**（已勾选）
- ✅ **开启POP/SMTP服务**（已勾选）

如果未开启，请：
1. 登录企业邮箱
2. 进入"设置" → "客户端"
3. 勾选"开启IMAP/SMTP服务"
4. 点击"保存更改"

### 4. 测试邮件发送

配置完成后，可以运行以下测试脚本验证配置：

```bash
cd backend
node test_email_config.js
```

## 常见问题

### 问题1：认证失败（535错误）

**原因**：使用了登录密码而不是授权码

**解决方案**：
- 使用授权码作为 `SMTP_PASSWORD`
- 授权码在企业邮箱"账户安全"或"客户端专用密码"中生成

### 问题2：连接超时

**原因**：防火墙或网络问题

**解决方案**：
- 检查服务器是否允许访问 `smtp.exmail.qq.com:465`
- 确保企业邮箱的SMTP服务已开启

### 问题3：SSL证书错误

**原因**：SSL证书验证问题

**解决方案**：
- 代码中已设置 `rejectUnauthorized: false`
- 如果仍有问题，可以尝试使用端口 587 和 TLS（不推荐，因为QQ企业邮箱推荐使用465+SSL）

## 配置示例

### 完整的环境变量配置

```env
# 数据库配置
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=123456
DB_NAME=kongfuworld

# QQ企业邮箱SMTP配置
SMTP_HOST=smtp.exmail.qq.com
SMTP_PORT=465
SMTP_USER=admin@kongfuworld.com
SMTP_PASSWORD=abc123def456ghi789jkl012mno345pq  # 这里填写授权码，不是登录密码

# 前端URL
FRONTEND_URL=http://localhost:3000

# 服务器配置
PORT=5000
NODE_ENV=development
```

## 测试邮件发送

创建一个测试文件 `backend/test_email_config.js`：

```javascript
const nodemailer = require('nodemailer');
require('dotenv').config({ path: './kongfuworld.env' });

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.exmail.qq.com',
  port: parseInt(process.env.SMTP_PORT) || 465,
  secure: true,
  auth: {
    user: process.env.SMTP_USER || 'admin@kongfuworld.com',
    pass: process.env.SMTP_PASSWORD
  },
  tls: {
    rejectUnauthorized: false
  }
});

// 验证配置
transporter.verify((error, success) => {
  if (error) {
    console.error('❌ SMTP配置验证失败:', error);
  } else {
    console.log('✅ SMTP配置验证成功，可以发送邮件');
    
    // 发送测试邮件
    transporter.sendMail({
      from: `"KongFuWorld" <${process.env.SMTP_USER}>`,
      to: process.env.SMTP_USER, // 发送给自己测试
      subject: '测试邮件 / Test Email',
      text: '这是一封测试邮件，如果您收到此邮件，说明SMTP配置成功！'
    }).then(info => {
      console.log('✅ 测试邮件已发送:', info.messageId);
    }).catch(err => {
      console.error('❌ 发送测试邮件失败:', err);
    });
  }
});
```

运行测试：
```bash
cd backend
node test_email_config.js
```

## 其他邮箱服务商配置（参考）

如果需要切换到其他邮箱服务商，可以参考以下配置：

### Gmail
```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASSWORD=your_app_password
```

### 163邮箱
```env
SMTP_HOST=smtp.163.com
SMTP_PORT=465
SMTP_USER=your_email@163.com
SMTP_PASSWORD=your_auth_code
```

### 126邮箱
```env
SMTP_HOST=smtp.126.com
SMTP_PORT=465
SMTP_USER=your_email@126.com
SMTP_PASSWORD=your_auth_code
```

## 安全建议

1. **不要将授权码提交到代码仓库**
   - 使用 `.env` 文件存储（已加入 `.gitignore`）
   
2. **定期更换授权码**
   - 如果授权码泄露，立即更换
   
3. **限制授权码权限**
   - 只允许发送邮件，不允许接收或删除邮件

4. **监控邮件发送**
   - 定期检查邮件发送日志
   - 发现异常立即处理

## 联系支持

如果遇到配置问题：
1. 检查QQ企业邮箱帮助中心
2. 联系QQ企业邮箱客服
3. 查看服务器日志排查问题

