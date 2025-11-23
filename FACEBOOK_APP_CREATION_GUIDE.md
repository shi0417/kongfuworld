# Facebook应用创建指南

## 创建新的Facebook应用

### 步骤1：创建应用

1. 访问 https://developers.facebook.com/
2. 点击"我的应用" → "创建应用"
3. 选择"消费者"应用类型
4. 填写应用信息：
   - 应用名称：KongFuWorld
   - 应用联系邮箱：your-email@example.com
   - 应用用途：网站登录

### 步骤2：配置应用设置

#### 基本设置
- **应用域名**：`localhost`
- **应用图标**：上传一个图标文件
- **隐私政策URL**：`http://localhost:3000/privacy`
- **服务条款URL**：`http://localhost:3000/terms`

#### Facebook登录设置
- **有效OAuth重定向URI**：
  ```
  http://localhost:3000/
  http://localhost:3000/login
  http://localhost:3000/register
  ```

#### 应用审核
- 点击"应用审核" → "权限和功能"
- 申请以下权限：
  - `email` - 获取用户邮箱
  - `public_profile` - 获取用户基本信息

### 步骤3：获取新的App ID

创建完成后，获取新的App ID并更新代码：

```javascript
// 在 frontend/src/components/SocialLogin/SocialLogin.tsx 中更新
const FACEBOOK_APP_ID = process.env.REACT_APP_FACEBOOK_APP_ID || 'YOUR_NEW_APP_ID';
```

### 步骤4：环境变量配置

创建 `frontend/.env` 文件：

```env
REACT_APP_FACEBOOK_APP_ID=YOUR_NEW_APP_ID
```

### 步骤5：测试应用

1. 在Facebook开发者控制台中：
   - 将应用模式设置为"开发模式"
   - 添加测试用户（可选）

2. 测试登录功能：
   - 启动开发服务器
   - 访问注册页面
   - 测试Facebook登录

## 常见问题解决

### 问题1：应用仍在审核中
- 在开发模式下，只有应用管理员和测试用户可以使用
- 添加测试用户到应用设置中

### 问题2：权限被拒绝
- 确保申请了正确的权限
- 检查权限范围是否匹配

### 问题3：重定向URI不匹配
- 确保OAuth重定向URI完全匹配
- 包括协议（http/https）和端口号

## 生产环境配置

部署到生产环境时：

1. 更新应用域名为生产域名
2. 更新OAuth重定向URI
3. 提交应用审核（如果需要公开使用）
4. 配置HTTPS

## 联系Facebook支持

如果问题持续存在：

1. 访问Facebook开发者支持
2. 提交应用审核问题
3. 提供详细的错误信息
