# 武侠世界项目开发规范文档

## 📋 项目概述
本文档定义了武侠世界项目的开发标准，确保代码一致性、可维护性和团队协作效率。

## 🎯 核心开发原则

### 1. 英文UI规范
- **统一性**：所有前端显示内容必须使用英文
- **一致性**：用户界面、提示信息、错误消息都必须是英文
- **国际化**：网站面向国际用户，所有文本内容使用英文

### 2. API端点命名规范
- **统一性**：前端、后端、文档必须使用相同的API端点名称
- **一致性**：所有相关文件（代码、文档、测试）必须同步更新
- **可追溯性**：每次API变更都必须记录在变更日志中

### 2. 代码修改检查清单
在每次修改代码前，必须检查以下项目：

#### 🔍 修改前检查
- [ ] 阅读相关文档，了解现有API设计
- [ ] 检查是否有其他文件引用了要修改的API端点
- [ ] 确认修改不会破坏现有功能

#### 📝 修改时要求
- [ ] 使用统一的命名规范
- [ ] 更新所有相关文件（前端、后端、文档、测试）
- [ ] 添加适当的错误处理和日志记录
- [ ] 确保数据库操作使用事务

#### ✅ 修改后验证
- [ ] 运行相关测试确保功能正常
- [ ] 检查控制台是否有错误信息
- [ ] 验证API端点响应格式正确
- [ ] 更新API文档和测试用例
- [ ] **检查所有用户界面文本是否为英文**
- [ ] **验证错误消息和提示信息为英文**

## 🌐 英文UI开发规范

### 用户界面文本要求
- **所有显示文本**：按钮、标签、提示信息必须使用英文
- **错误消息**：所有错误提示和警告信息必须使用英文
- **表单标签**：输入框标签、占位符文本必须使用英文
- **模态框内容**：弹窗标题、内容、按钮文本必须使用英文

### 英文UI检查清单
```javascript
// ✅ 正确示例
<button>Buy Now</button>
<input placeholder="Enter your email" />
<div>Error: Invalid input</div>

// ❌ 错误示例
<button>立即购买</button>
<input placeholder="请输入邮箱" />
<div>错误：输入无效</div>
```

### 常见英文UI组件
- **按钮文本**：Buy Now, Cancel, Submit, Save, Delete
- **表单标签**：Email, Password, Name, Card Number
- **状态信息**：Loading..., Success, Error, Warning
- **导航文本**：Home, Profile, Settings, Logout

## 🛠️ API开发规范

### 端点命名规范
```
GET    /api/{module}/{action}           - 获取数据
POST   /api/{module}/{action}           - 创建/执行操作
PUT    /api/{module}/{action}           - 更新数据
DELETE /api/{module}/{action}           - 删除数据
```

### 具体命名约定
- **解锁相关**：统一使用 `unlock-with-{method}` 格式
  - ✅ `unlock-with-key` - 钥匙解锁
  - ✅ `unlock-with-karma` - Karma解锁
  - ✅ `unlock-with-time` - 时间解锁
  - ❌ `buy-with-karma` - 避免使用buy前缀

- **支付相关**：使用 `purchase-{type}` 格式
  - ✅ `purchase-karma` - 购买Karma
  - ✅ `purchase-champion` - 购买Champion订阅

### 响应格式标准
```json
{
  "success": true,
  "message": "操作成功",
  "data": {
    // 具体数据
  },
  "error": null
}
```

## 📁 文件组织规范

### 必须同步更新的文件类型
1. **后端路由文件**：`backend/routes/{module}.js`
2. **前端API调用**：`frontend/src/components/**/*.tsx`
3. **API文档**：`{MODULE}_IMPLEMENTATION.md`
4. **测试文件**：`backend/test_{module}.js`
5. **数据库脚本**：`backend/database/{module}.sql`

### 文件命名约定
- 实现文档：`{MODULE}_IMPLEMENTATION.md`
- 修复总结：`{MODULE}_FIX_SUMMARY.md`
- 测试文件：`test_{module}.js`
- 数据库脚本：`{module}_system.sql`

## 🔄 开发流程规范

### 1. 需求分析阶段
- [ ] 明确功能需求
- [ ] 设计API端点结构
- [ ] 确定数据库变更需求
- [ ] 规划前端组件结构

### 2. 开发实施阶段
- [ ] 创建/更新数据库结构
- [ ] 实现后端API路由
- [ ] 实现前端组件和API调用
- [ ] 编写测试用例
- [ ] 更新相关文档

### 3. 测试验证阶段
- [ ] 运行单元测试
- [ ] 进行集成测试
- [ ] 验证API端点一致性
- [ ] 检查错误处理
- [ ] 验证用户体验

### 4. 部署发布阶段
- [ ] 更新API文档
- [ ] 记录变更日志
- [ ] 部署到测试环境
- [ ] 进行最终验证
- [ ] 部署到生产环境

## 🚨 常见问题预防

### API端点不一致
**问题**：前端调用 `buy-with-karma`，后端提供 `unlock-with-karma`
**预防**：
- 修改API前先搜索所有相关文件
- 使用统一的命名规范
- 建立API端点检查清单

### 数据库连接方式不一致 ⚠️ **新增**
**问题**：不同文件使用不同的数据库连接方式（回调式 vs Promise式）
**症状**：`TypeError: (intermediate value) is not iterable`
**预防**：
- **统一使用 Promise 式连接**：所有文件必须使用 `mysql2/promise`
- 检查所有数据库相关文件的连接方式
- 确保 `db.execute()` 和 `db.query()` 使用方式一致
- 添加数据库连接方式一致性检查

### 数据库操作错误
**问题**：忘记使用事务，数据不一致
**预防**：
- 所有数据库写操作必须使用事务
- 添加适当的错误处理和回滚机制
- 验证数据完整性

### 前端状态管理错误
**问题**：状态更新不及时，UI显示错误
**预防**：
- 使用统一的状态管理
- 添加适当的加载状态
- 实现错误边界处理

## 📊 质量检查清单

### 代码质量
- [ ] 代码格式规范
- [ ] 变量命名清晰
- [ ] 函数职责单一
- [ ] 错误处理完整
- [ ] 日志记录适当

### API质量
- [ ] 端点命名一致
- [ ] 参数验证完整
- [ ] 响应格式标准
- [ ] 错误信息清晰
- [ ] 性能优化合理

### 文档质量
- [ ] API文档完整
- [ ] 使用示例清晰
- [ ] 错误处理说明
- [ ] 变更记录详细

## 🔧 自动化检查工具

### 建议实现的检查脚本
1. **API端点一致性检查**
2. **数据库事务使用检查**
3. **数据库连接方式一致性检查** ⚠️ **新增**
4. **错误处理完整性检查**
5. **文档同步性检查**

### 数据库连接方式检查规范 ⚠️ **新增**
```javascript
// 检查所有数据库相关文件是否使用统一的连接方式
const dbFiles = [
  'backend/daily_checkin_api.js',
  'backend/key_transaction_helper.js',
  'backend/routes/*.js'
];

// 必须使用 Promise 式连接
const requiredPatterns = [
  "require('mysql2/promise')",
  "mysql.createConnection(dbConfig)",
  "db.execute("
];

// 禁止使用回调式连接
const forbiddenPatterns = [
  "require('mysql2')",  // 应该是 mysql2/promise
  "db.query("          // 应该是 db.execute
];
```

## 📝 变更日志模板

### 变更记录格式
```
## [版本] - 日期
### 新增
- 功能描述

### 修改
- 修改内容

### 修复
- 问题描述和解决方案

### 影响范围
- 前端文件列表
- 后端文件列表
- 数据库变更
- 文档更新
```

---

**重要提醒**：每次开发前请仔细阅读本规范，确保所有修改都符合标准。如有疑问，请及时沟通确认。
