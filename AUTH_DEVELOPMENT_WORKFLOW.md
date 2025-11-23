# 🔐 认证系统开发工作流程

## 📋 工作流程概述

本工作流程确保所有开发人员遵循统一的认证系统开发规范，避免重复创建认证模块，保证代码一致性和可维护性。

## 🚀 开发前检查

### 1. 运行自动检查
```bash
npm run auto:start
```

### 2. 检查认证规范
```bash
npm run auth:check
```

### 3. 确保认证服务完整
- ✅ `AuthService.ts` - 统一认证服务
- ✅ `ApiService.ts` - 统一API调用
- ✅ `useAuth.ts` - 认证Hook
- ✅ 数据库 `checkinday` 字段

## 🔧 开发中规范

### 1. 使用统一的认证服务
```typescript
// ✅ 正确做法
import { useAuth, useUser, useCheckin } from '../hooks/useAuth';
import ApiService from '../services/ApiService';

const MyComponent = () => {
  const { user, isAuthenticated } = useAuth();
  const { hasCheckedInToday } = useCheckin();
  
  // 使用统一的API调用
  const result = await ApiService.getUser(userId);
};
```

### 2. 禁止的认证模式
```typescript
// ❌ 禁止做法
const getCurrentUserId = () => {
  const userStr = localStorage.getItem('user');
  // ...
};

// ❌ 禁止做法
const response = await fetch('http://localhost:5000/api/user/1');

// ❌ 禁止做法
const [results] = await db.execute(
  'SELECT * FROM daily_checkin WHERE user_id = ? AND checkin_date = ?',
  [userId, today]
);
```

### 3. 开发中检查
```bash
npm run auto:during
```

## 🧪 开发后验证

### 1. 运行完整检查
```bash
npm run auto:post
```

### 2. 认证规范检查
```bash
npm run auth:check
```

### 3. 测试认证功能
```typescript
// 测试认证状态
const { isAuthenticated, user } = useAuth();
expect(isAuthenticated).toBe(true);

// 测试API调用
const result = await ApiService.getUser(1);
expect(result.success).toBe(true);

// 测试签到功能
const { hasCheckedInToday } = useCheckin();
expect(hasCheckedInToday).toBe(false);
```

## 📊 检查清单

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

### 1. 认证相关代码审查
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

### 2. API调用代码审查
```typescript
// 检查是否使用了统一的API调用
// ❌ 发现这些模式需要修改
fetch('http://localhost:5000/api/...')
headers: { 'Authorization': `Bearer ${token}` }

// ✅ 应该使用
ApiService.getUser(userId)
ApiService.performCheckin(userId)
```

### 3. 签到相关代码审查
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

## 🚨 常见错误处理

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

// ✅ 正确：使用统一的认证Hook
const MyComponent1 = () => {
  const { user } = useAuth();
  // ...
};
```

### 2. 不一致的API调用
```typescript
// ❌ 错误：不同组件使用不同的API调用方式
const Component1 = () => {
  const response = await fetch('/api/user/1');
};

// ✅ 正确：使用统一的API调用
const Component1 = () => {
  const result = await ApiService.getUser(1);
};
```

### 3. 错误的签到检查
```typescript
// ❌ 错误：使用低效的签到检查
const [results] = await db.execute(
  'SELECT * FROM daily_checkin WHERE user_id = ? AND checkin_date = ?',
  [userId, today]
);

// ✅ 正确：使用优化的签到检查
const [results] = await db.execute(
  'SELECT checkinday FROM user WHERE id = ?',
  [userId]
);
const hasCheckedIn = results[0].checkinday === today;
```

## 📈 性能要求

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

## 🎯 开发流程总结

### 1. 开发前
```bash
npm run auto:start
npm run auth:check
```

### 2. 开发中
- 使用统一的认证服务
- 使用统一的API调用
- 遵循开发规范
- 定期运行检查

### 3. 开发后
```bash
npm run auto:post
npm run auth:check
```

## 🎉 总结

遵循本工作流程可以确保：
- ✅ 统一的认证系统
- ✅ 一致的API调用
- ✅ 高效的签到逻辑
- ✅ 可维护的代码
- ✅ 避免重复开发
- ✅ 自动检查规范

**记住：永远使用统一的认证服务，不要创建新的认证模块！**
