# Chat开发工作流指南

## 🎯 目标
通过Chat沟通开发时，自动运行检查确保代码质量，避免类似API端点不匹配的问题。

## 🚀 自动化检查方案

### 1. 自动检查脚本
我创建了 `scripts/auto-dev-check.js` 脚本，可以自动运行所有检查：

```bash
# 运行自动检查
npm run auto:check

# 开发前自动检查
npm run dev:start
```

### 2. 检查内容
自动检查脚本会检查：
- ✅ API端点一致性
- ✅ 数据库事务使用
- ✅ 错误处理完整性
- ✅ 项目结构完整性

### 3. 日志记录
每次检查都会生成详细日志：
- 日志文件：`logs/dev-check-{timestamp}.log`
- 包含所有检查结果和问题详情

## 📋 Chat开发流程

### 每次Chat开发时

#### 1. 开始前（自动运行）
```bash
# 运行自动检查，了解项目现状
npm run auto:check
```

**检查内容**：
- API端点一致性
- 数据库事务使用
- 错误处理完整性
- 项目结构完整性

#### 2. 开发过程中（按需运行）
```bash
# 修改代码后运行检查
npm run check:pre-commit
```

**检查内容**：
- 新修改的API端点
- 数据库操作事务
- 错误处理完整性
- 前端API调用

#### 3. 完成后（自动运行）
```bash
# 开发完成后运行全面检查
npm run check:all
```

**检查内容**：
- 所有API端点一致性
- 完整的数据库事务检查
- 全面的错误处理检查
- 文档同步性检查

## 🔧 使用方式

### 方式1：手动运行（推荐）
每次Chat开发时，在开始前运行：
```bash
npm run auto:check
```

### 方式2：集成到开发流程
在开发脚本中集成：
```bash
# 开发前检查
npm run dev:start

# 开发中检查
npm run check:pre-commit

# 开发后检查
npm run check:all
```

### 方式3：自动化集成
可以设置Git hooks或IDE插件自动运行检查。

## 📊 检查结果解读

### 成功情况
```
✅ API端点一致性检查通过
✅ 数据库事务检查通过
✅ 错误处理检查通过
🎉 所有检查通过！项目状态良好
```

### 发现问题
```
⚠️  API端点不一致:
   - unlock-with-karma - 前端有引用但后端可能缺失
⚠️  数据库事务问题:
   - backend/routes/chapter_unlock.js
⚠️  错误处理问题:
   - backend/routes/payment.js
```

### 日志文件
详细日志保存在：`logs/dev-check-{timestamp}.log`

## 🎯 最佳实践

### 1. 开发前
- 运行 `npm run auto:check` 了解现状
- 查看日志文件了解具体问题
- 根据检查结果制定开发计划

### 2. 开发中
- 定期运行 `npm run check:pre-commit`
- 及时修复发现的问题
- 保持代码质量

### 3. 开发后
- 运行 `npm run check:all` 确保质量
- 查看详细日志确认所有问题已解决
- 记录变更和修复内容

## 🚨 常见问题解决

### API端点不一致
**问题**：前端调用 `buy-with-karma`，后端提供 `unlock-with-karma`
**解决**：
1. 运行 `npm run auto:check` 确认问题
2. 统一使用 `unlock-with-karma`
3. 更新所有相关文件
4. 重新运行检查确认修复

### 数据库事务遗漏
**问题**：写操作没有使用事务
**解决**：
1. 检查日志文件找到问题文件
2. 添加 `START TRANSACTION` 和 `COMMIT`
3. 添加适当的错误处理和回滚
4. 重新运行检查确认修复

### 错误处理不完整
**问题**：API调用缺少错误处理
**解决**：
1. 检查日志文件找到问题文件
2. 添加 `try-catch` 块
3. 实现适当的错误处理逻辑
4. 重新运行检查确认修复

## 📝 变更记录

### 每次修改后记录
```
## [日期] - 修改内容
### 检查结果
- 运行 npm run auto:check
- 发现问题：X个
- 修复问题：X个

### 修改的文件
- 前端：frontend/src/components/ChapterUnlockModal/ChapterUnlockModal.tsx
- 后端：backend/routes/chapter_unlock.js

### 修复的问题
- API端点不匹配：buy-with-karma → unlock-with-karma
- 数据库事务：添加START TRANSACTION
- 错误处理：添加try-catch块

### 验证结果
- 运行 npm run check:all
- 所有检查通过
- 功能测试正常
```

## 🎉 总结

通过这个自动化检查系统，你可以：

1. **自动发现问题**：在开发前就知道项目状态
2. **提高代码质量**：确保API端点一致性和错误处理
3. **减少错误**：避免类似API端点不匹配的问题
4. **规范开发流程**：建立标准化的开发检查流程

**重要提醒**：每次Chat开发前请运行 `npm run auto:check`，确保项目状态良好后再开始开发！
