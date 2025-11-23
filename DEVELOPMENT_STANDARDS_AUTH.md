# 🔐 用户认证系统开发规范

## 📋 规范概述

本规范确保所有开发人员使用统一的认证系统，避免重复创建认证模块，保证代码一致性和可维护性。

## 🚫 禁止行为

### ❌ 不要创建新的认证函数
```typescript
// ❌ 错误：不要创建新的getCurrentUserId函数
const getCurrentUserId = () => {
  const userStr = localStorage.getItem('user');
  // ...
};

// ❌ 错误：不要直接操作localStorage
const user = JSON.parse(localStorage.getItem('user'));
```

### ❌ 不要创建新的API调用函数
```typescript
// ❌ 错误：不要创建新的fetch封装
const apiCall = async (url, options) => {
  const token = localStorage.getItem('token');
  // ...
};
```

### ❌ 不要创建新的认证状态管理
```typescript
// ❌ 错误：不要创建新的认证状态
const [isAuthenticated, setIsAuthenticated] = useState(false);
```

## ✅ 正确做法

### 1. 使用统一的认证服务
```typescript
// ✅ 正确：使用AuthService
import AuthService from '../services/AuthService';

const user = AuthService.getCurrentUser();
const userId = AuthService.getCurrentUserId();
const isAuth = AuthService.isAuthenticated();
```

### 2. 使用认证Hook
```typescript
// ✅ 正确：使用useAuth Hook
import { useAuth, useUser, useCheckin } from '../hooks/useAuth';

const MyComponent = () => {
  const { user, isAuthenticated, login, logout } = useAuth();
  const { hasCheckedInToday } = useCheckin();
  
  if (!isAuthenticated) {
    return <div>请先登录</div>;
  }
  
  return <div>欢迎, {user?.username}</div>;
};
```

### 3. 使用统一API调用
```typescript
// ✅ 正确：使用ApiService
import ApiService from '../services/ApiService';

const result = await ApiService.getUser(userId);
const checkinResult = await ApiService.performCheckin(userId);
```

## 📝 开发检查清单

### 新增组件时
- [ ] 是否使用了 `useAuth()` 而不是自定义认证逻辑？
- [ ] 是否使用了 `ApiService` 而不是直接fetch？
- [ ] 是否添加了认证状态检查？
- [ ] 是否使用了正确的错误处理？

### 修改现有组件时
- [ ] 是否将旧的 `getCurrentUserId()` 替换为 `useAuth()`？
- [ ] 是否将旧的 `fetch()` 调用替换为 `ApiService`？
- [ ] 是否移除了重复的认证逻辑？
- [ ] 是否测试了认证状态变化？

### API调用时
- [ ] 是否使用了 `ApiService` 方法？
- [ ] 是否处理了401错误（自动登出）？
- [ ] 是否使用了正确的类型定义？
- [ ] 是否添加了错误处理？

## 🔍 代码审查要点

### 1. 认证相关代码
```typescript
// 检查是否使用了正确的认证服务
// ❌ 发现这些模式需要修改
localStorage.getItem('user')
localStorage.getItem('token')
JSON.parse(localStorage.getItem('user'))

// ✅ 应该使用
AuthService.getCurrentUser()
AuthService.getCurrentUserId()
useAuth()
```

### 2. API调用代码
```typescript
// 检查是否使用了统一的API调用
// ❌ 发现这些模式需要修改
fetch('http://localhost:5000/api/...')
headers: { 'Authorization': `Bearer ${token}` }

// ✅ 应该使用
ApiService.getUser(userId)
ApiService.performCheckin(userId)
```

### 3. 签到相关代码
```typescript
// 检查是否使用了优化的签到逻辑
// ❌ 发现这些模式需要修改
SELECT * FROM daily_checkin WHERE user_id = ? AND checkin_date = ?

// ✅ 应该使用
SELECT checkinday FROM user WHERE id = ?
```

## 🛠️ 迁移指南

### 从旧认证系统迁移
1. **替换认证函数**
   ```typescript
   // 旧代码
   const getCurrentUserId = () => {
     const userStr = localStorage.getItem('user');
     // ...
   };
   
   // 新代码
   import { useAuth } from '../hooks/useAuth';
   const { user } = useAuth();
   const userId = user?.id;
   ```

2. **替换API调用**
   ```typescript
   // 旧代码
   const response = await fetch(`http://localhost:5000/api/user/${userId}`);
   
   // 新代码
   import ApiService from '../services/ApiService';
   const result = await ApiService.getUser(userId);
   ```

3. **替换签到检查**
   ```typescript
   // 旧代码
   const [results] = await db.execute(
     'SELECT * FROM daily_checkin WHERE user_id = ? AND checkin_date = ?',
     [userId, today]
   );
   
   // 新代码
   const [results] = await db.execute(
     'SELECT checkinday FROM user WHERE id = ?',
     [userId]
   );
   const hasCheckedIn = results[0].checkinday === today;
   ```

## 🧪 测试要求

### 1. 认证功能测试
```typescript
// 测试认证状态
const { isAuthenticated, user } = useAuth();
expect(isAuthenticated).toBe(true);
expect(user).toBeDefined();
```

### 2. API调用测试
```typescript
// 测试API调用
const result = await ApiService.getUser(1);
expect(result.success).toBe(true);
```

### 3. 签到功能测试
```typescript
// 测试签到状态
const { hasCheckedInToday } = useCheckin();
expect(hasCheckedInToday).toBe(false);
```

## 📊 性能要求

### 1. 认证检查性能
- 认证状态检查：< 1ms
- 用户信息获取：< 5ms
- Token验证：< 2ms

### 2. API调用性能
- 普通API调用：< 100ms
- 认证API调用：< 150ms
- 错误处理：< 50ms

### 3. 签到检查性能
- 签到状态检查：< 10ms（使用checkinday字段）
- 签到执行：< 200ms
- 状态更新：< 50ms

## 🚨 常见错误

### 1. 重复认证逻辑
```typescript
// ❌ 错误：在多个组件中重复认证逻辑
const MyComponent1 = () => {
  const [user, setUser] = useState(null);
  useEffect(() => {
    const userStr = localStorage.getItem('user');
    // ...
  }, []);
};

const MyComponent2 = () => {
  const [user, setUser] = useState(null);
  useEffect(() => {
    const userStr = localStorage.getItem('user');
    // ...
  }, []);
};
```

### 2. 不一致的API调用
```typescript
// ❌ 错误：不同组件使用不同的API调用方式
const Component1 = () => {
  const response = await fetch('/api/user/1');
};

const Component2 = () => {
  const response = await fetch('/api/user/1', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
};
```

### 3. 错误的签到检查
```typescript
// ❌ 错误：使用低效的签到检查
const [results] = await db.execute(
  'SELECT * FROM daily_checkin WHERE user_id = ? AND checkin_date = ?',
  [userId, today]
);
```

## 📋 开发流程

### 1. 开发前
```bash
npm run auto:start
```

### 2. 开发中
- 使用统一的认证服务
- 使用统一的API调用
- 遵循开发规范

### 3. 开发后
```bash
npm run auto:post
```

## 🎯 总结

遵循本规范可以确保：
- ✅ 统一的认证系统
- ✅ 一致的API调用
- ✅ 高效的签到逻辑
- ✅ 可维护的代码
- ✅ 避免重复开发

**记住：永远使用统一的认证服务，不要创建新的认证模块！**
