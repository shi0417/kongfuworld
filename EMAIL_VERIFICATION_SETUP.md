# 邮箱验证功能配置说明

## 功能概述

已实现完整的邮箱验证功能，用户点击"Writers' Zone"后会：
1. 检查用户是否登录（未登录跳转到登录页面）
2. 检查用户是否是作者（`is_author=0`时跳转到邮箱验证页面）
3. 邮箱验证通过后更新`confirmed_email`（存储验证通过的邮箱地址）和`is_author=1`
4. 跳转到`/writers-zone`页面

## 已完成的文件

### 前端文件
- `frontend/src/pages/EmailVerification.tsx` - 邮箱验证页面组件
- `frontend/src/pages/EmailVerification.module.css` - 样式文件
- `frontend/src/components/NavBar/NavBar.tsx` - 已更新Writers Zone点击逻辑
- `frontend/src/pages/Login.tsx` - 已添加中英文支持
- `frontend/src/App.tsx` - 已添加路由

### 后端文件
- `backend/routes/emailVerification.js` - 邮箱验证API路由
- `backend/services/emailService.js` - 邮件发送服务
- `backend/server.js` - 已注册邮箱验证路由

### 数据库
- `user`表已添加字段：`is_author`, `pen_name`, `bio`, `confirmed_email`, `social_links`
- `confirmed_email`字段类型：`varchar(100)`，用于存储已验证的邮箱地址（不再是布尔标志位）

## 邮件服务配置

### 1. 安装依赖
已安装`nodemailer`包。

### 2. 配置邮件服务器

编辑 `backend/kongfuworld.env` 文件（如果不存在，复制`backend/env.example`）：

```env
# 邮件配置
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=admin@kongfuworld.com
SMTP_PASSWORD=your_email_password
```

### 3. Gmail配置示例

如果使用Gmail，需要：
1. 开启"允许不够安全的应用访问"
2. 或者使用应用专用密码（推荐）

### 4. 其他邮件服务商配置

#### 使用QQ邮箱：
```env
SMTP_HOST=smtp.qq.com
SMTP_PORT=587
SMTP_USER=your_email@qq.com
SMTP_PASSWORD=your_app_password
```

#### 使用163邮箱：
```env
SMTP_HOST=smtp.163.com
SMTP_PORT=465
SMTP_USER=your_email@163.com
SMTP_PASSWORD=your_auth_code
```

## API端点

### 发送验证码
```
POST /api/email-verification/send-code
Content-Type: application/json
Authorization: Bearer <token>

{
  "email": "user@example.com"
}
```

响应：
```json
{
  "success": true,
  "message": "Verification code sent / 验证码已发送"
}
```

### 验证验证码
```
POST /api/email-verification/verify
Content-Type: application/json
Authorization: Bearer <token>

{
  "email": "user@example.com",
  "code": "123456"
}
```

响应：
```json
{
  "success": true,
  "message": "Email verified successfully / 邮箱验证成功"
}
```

## 使用流程

1. 用户点击"Writers' Zone"
2. 系统检查登录状态
   - 未登录 → 跳转到 `/login?redirect=/writers-zone`
   - 已登录 → 继续检查
3. 系统检查作者状态
   - `is_author=0` → 跳转到 `/email-verification`
   - `is_author=1` → 直接跳转到 `/writers-zone`
4. 在邮箱验证页面：
   - 输入邮箱地址
   - 点击"获取验证码"（发送邮件）
   - 输入验证码
   - 同意条款
   - 提交验证
5. 验证成功后：
   - 更新`confirmed_email=1`
   - 更新`is_author=1`
   - 跳转到`/writers-zone`

## 验证码存储

当前使用内存存储验证码（`Map`），在生产环境中建议：
- 使用Redis存储验证码
- 设置合理的过期时间（当前为10分钟）
- 限制发送频率（防止滥用）

## 注意事项

1. **邮件服务密码**：确保邮件服务密码正确，否则无法发送验证码
2. **SMTP配置**：不同邮件服务商的SMTP配置不同，请根据实际情况调整
3. **安全性**：生产环境建议使用环境变量存储敏感信息
4. **验证码过期**：验证码有效期为10分钟
5. **重发限制**：建议添加发送频率限制（如每分钟最多发送1次）

## 测试步骤

1. 启动后端服务：`cd backend && npm start`
2. 启动前端服务：`cd frontend && npm start`
3. 配置邮件服务（编辑`kongfuworld.env`）
4. 访问 `http://localhost:3000`
5. 点击"Writers' Zone"按钮
6. 按照流程测试邮箱验证功能

## 故障排查

### 邮件发送失败
- 检查SMTP配置是否正确
- 检查邮件服务商是否允许SMTP访问
- 检查防火墙设置
- 查看后端控制台错误日志

### 验证码验证失败
- 检查验证码是否过期（10分钟）
- 检查输入的验证码是否正确
- 检查用户是否已登录（需要token）

### 跳转逻辑问题
- 检查浏览器控制台是否有错误
- 检查用户认证状态
- 检查路由配置是否正确

