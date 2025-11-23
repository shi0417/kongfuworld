# Facebook Login Setup Guide

## 问题分析

从控制台错误可以看出，Facebook登录遇到以下问题：

1. **403错误**: `Failed to load resource: the server responded with a status of 403`
2. **跨域问题**: `Cannot access parent location (cross-origin)`
3. **网络问题**: `[Intervention]Slow network is detected`

## 解决方案

### 1. Facebook App 配置

在 Facebook Developer Console 中配置以下设置：

#### App Domains (应用域名)
```
localhost
127.0.0.1
your-domain.com (生产环境)
```

#### Valid OAuth Redirect URIs (有效OAuth重定向URI)
```
http://localhost:3000/
http://localhost:3000/login
http://localhost:3000/register
https://your-domain.com/ (生产环境)
```

#### App Settings
- **App ID**: 789137810752485
- **App Secret**: 需要在Facebook控制台获取
- **App Type**: Web应用

### 2. 环境变量配置

在 `frontend/.env` 文件中添加：

```env
REACT_APP_FACEBOOK_APP_ID=789137810752485
REACT_APP_FACEBOOK_APP_SECRET=your_facebook_app_secret
```

### 3. 网络环境

由于Facebook服务在某些地区可能被限制，建议：

1. **使用VPN**: 确保能够访问Facebook API
2. **代理设置**: 配置开发环境的代理
3. **网络检查**: 确保网络连接稳定

### 4. 代码修复

已完成的修复：

1. ✅ 启用Facebook登录组件
2. ✅ 添加正确的回调处理
3. ✅ 配置OAuth参数
4. ✅ 添加错误处理

### 5. 测试步骤

1. 启动开发服务器: `npm start`
2. 访问注册页面: `http://localhost:3000/register`
3. 点击Facebook登录按钮
4. 检查控制台是否有错误
5. 测试登录流程

### 6. 常见问题

#### 问题1: 403 Forbidden
**原因**: Facebook App域名配置不正确
**解决**: 在Facebook控制台添加localhost到App Domains

#### 问题2: 跨域错误
**原因**: CORS配置问题
**解决**: 确保Facebook App配置了正确的重定向URI

#### 问题3: 网络超时
**原因**: 网络连接问题
**解决**: 使用VPN或代理，确保能访问Facebook服务

### 7. 调试信息

在浏览器控制台中查看以下信息：
- Facebook SDK加载状态
- OAuth重定向URL
- 错误详情
- 网络请求状态

### 8. 生产环境配置

部署到生产环境时，需要：

1. 更新Facebook App域名
2. 配置HTTPS
3. 更新重定向URI
4. 设置正确的App Secret

## 当前状态

✅ Facebook登录组件已启用
✅ 错误处理已添加
✅ OAuth参数已配置
⏳ 需要配置Facebook App域名
⏳ 需要测试网络连接
