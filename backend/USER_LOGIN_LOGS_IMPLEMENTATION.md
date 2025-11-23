# 用户登录日志功能实现说明

## 概述
实现了用户登录日志记录功能，用于记录用户每次登录的IP地址、登录方式、设备类型等信息。

## 数据库表结构

### `user_login_logs` 表
- **id**: 主键，自增
- **user_id**: 用户ID，外键关联user表
- **ip_address**: IP地址（支持IPv4和IPv6）
- **login_time**: 登录时间
- **login_method**: 登录方式（password, google, facebook, apple, register）
- **user_agent**: 用户代理字符串（浏览器/设备信息）
- **device_type**: 设备类型（desktop, mobile, tablet等）
- **location**: 地理位置（预留字段，可通过IP解析）
- **login_status**: 登录状态（success, failed）
- **session_id**: 会话ID（预留字段）

## 实现文件

### 1. 数据库迁移文件
- `backend/migrations/create_user_login_logs_table.sql`: SQL建表脚本
- `backend/create_user_login_logs_table.js`: Node.js脚本，用于执行建表操作

### 2. 工具函数
- `backend/utils/loginLogger.js`: 登录日志记录工具
  - `getClientIP(req)`: 从请求中提取客户端IP地址
  - `getDeviceType(userAgent)`: 从User-Agent中提取设备类型
  - `logUserLogin(db, userId, req, loginMethod, loginStatus, callback)`: 记录登录日志（回调版本）
  - `logUserLoginAsync(db, userId, req, loginMethod, loginStatus)`: 记录登录日志（Promise版本）

### 3. 集成位置

#### 登录接口 (`backend/server.js`)
- **路径**: `POST /api/login`
- **记录时机**: 
  - 登录成功时记录（status: 'success'）
  - 密码错误时记录（status: 'failed'）
- **登录方式**: `'password'`

#### 注册接口 (`backend/server.js`)
- **路径**: `POST /api/register`
- **记录时机**: 注册成功后自动登录时记录
- **登录方式**: `'register'`

#### 第三方登录接口 (`backend/routes/social_auth.js`)
- **路径**: `POST /api/auth/social-login`
- **记录时机**: 第三方登录成功时记录
- **登录方式**: `'google'`, `'facebook'`, `'apple'`（根据provider动态设置）

## IP地址获取逻辑

优先级顺序：
1. `x-forwarded-for` 请求头（取第一个IP）
2. `x-real-ip` 请求头
3. `req.ip`
4. `req.connection.remoteAddress`
5. 如果都获取不到，返回 `'unknown'`

## 设备类型识别

- **mobile**: 包含 'mobile', 'android', 'iphone' 的User-Agent
- **tablet**: 包含 'tablet', 'ipad' 的User-Agent
- **desktop**: 其他情况
- **unknown**: 无User-Agent信息

## 使用示例

### 在回调风格的代码中使用
```javascript
const { logUserLogin } = require('./utils/loginLogger');

// 登录成功
logUserLogin(db, userId, req, 'password', 'success');

// 登录失败
logUserLogin(db, userId, req, 'password', 'failed');
```

### 在async/await代码中使用
```javascript
const { logUserLoginAsync } = require('./utils/loginLogger');

try {
  await logUserLoginAsync(db, userId, req, 'google', 'success');
} catch (error) {
  console.error('记录登录日志失败:', error);
}
```

## 注意事项

1. **异步非阻塞**: 日志记录是异步的，不会阻塞登录流程
2. **错误处理**: 日志记录失败不会影响登录功能，只会在控制台输出错误信息
3. **数据库连接**: 工具函数支持 `mysql2`（回调）和 `mysql2/promise`（Promise）两种连接方式
4. **用户不存在**: 当用户不存在时（如登录时用户名错误），不记录日志，因为没有user_id可以关联

## 查询示例

### 查询用户最近的登录记录
```sql
SELECT * FROM user_login_logs 
WHERE user_id = ? 
ORDER BY login_time DESC 
LIMIT 10;
```

### 查询用户在不同IP的登录次数
```sql
SELECT ip_address, COUNT(*) as login_count 
FROM user_login_logs 
WHERE user_id = ? AND login_status = 'success'
GROUP BY ip_address 
ORDER BY login_count DESC;
```

### 查询用户登录失败的记录
```sql
SELECT * FROM user_login_logs 
WHERE user_id = ? AND login_status = 'failed'
ORDER BY login_time DESC;
```

## 后续扩展建议

1. **地理位置解析**: 使用IP地理位置API（如MaxMind GeoIP2）填充`location`字段
2. **异常检测**: 基于IP地址和登录模式检测异常登录行为
3. **会话管理**: 使用`session_id`字段关联JWT token，实现会话追踪
4. **数据清理**: 定期清理过期的登录日志（如保留最近6个月的记录）

