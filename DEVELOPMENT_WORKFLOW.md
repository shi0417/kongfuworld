# 开发工作流指南

## 🎯 目标
通过Chat沟通开发时，确保代码质量和一致性，避免类似API端点不匹配的问题。

## 📋 开发流程

### 1. 开发前准备
```bash
# 1. 阅读开发规范
cat DEVELOPMENT_STANDARDS.md

# 2. 运行检查清单
cat DEVELOPMENT_CHECKLIST.md

# 3. 搜索相关代码
grep -r "相关关键词" .
```

### 2. 开发过程中
```bash
# 每次修改前运行检查
npm run check:api

# 修改后验证
npm run check:pre-commit
```

### 3. 开发完成后
```bash
# 运行所有检查
npm run check:all

# 确保所有检查通过
npm run dev:check
```

## 🔧 自动化检查工具

### API一致性检查
```bash
# 检查API端点一致性
npm run check:api

# 手动运行详细检查
node scripts/api-consistency-check.js
```

### 提交前检查
```bash
# 运行提交前检查
npm run check:pre-commit

# 手动运行详细检查
node scripts/pre-commit-check.js
```

### 全面检查
```bash
# 运行所有检查
npm run check:all
```

## 🚨 常见问题预防

### 1. API端点不一致
**问题**：前端调用 `buy-with-karma`，后端提供 `unlock-with-karma`
**预防**：
```bash
# 修改前搜索所有相关文件
grep -r "buy-with-karma\|unlock-with-karma" .

# 运行API一致性检查
npm run check:api
```

### 2. 数据库事务遗漏
**问题**：写操作没有使用事务
**预防**：
```bash
# 检查路由文件中的事务使用
grep -r "START TRANSACTION\|BEGIN" backend/routes/
grep -r "INSERT\|UPDATE\|DELETE" backend/routes/
```

### 3. 错误处理不完整
**问题**：API调用缺少错误处理
**预防**：
```bash
# 检查前端API调用的错误处理
grep -r "fetch.*api" frontend/src/ | grep -v "catch"
```

## 📊 质量检查清单

### 每次开发前
- [ ] 阅读 `DEVELOPMENT_STANDARDS.md`
- [ ] 运行 `npm run check:api`
- [ ] 搜索相关代码：`grep -r "关键词" .`

### 开发过程中
- [ ] 使用统一的API端点命名
- [ ] 实现完整的错误处理
- [ ] 使用数据库事务
- [ ] 添加适当的日志记录

### 开发完成后
- [ ] 运行 `npm run check:all`
- [ ] 测试功能正常
- [ ] 更新相关文档
- [ ] 记录变更日志

## 🛠️ 快速命令参考

### 搜索相关代码
```bash
# 搜索API端点
grep -r "unlock-with-karma" .
grep -r "buy-with-karma" .

# 搜索数据库操作
grep -r "INSERT\|UPDATE\|DELETE" backend/routes/

# 搜索前端API调用
grep -r "fetch.*api" frontend/src/
```

### 检查文件一致性
```bash
# 检查相关文件
ls -la *karma* *unlock* *chapter*

# 检查路由文件
ls -la backend/routes/

# 检查前端组件
ls -la frontend/src/components/
```

### 运行自动化检查
```bash
# API一致性检查
npm run check:api

# 提交前检查
npm run check:pre-commit

# 全面检查
npm run check:all
```

## 📝 变更记录模板

### 每次修改后记录
```
## [日期] - 修改内容
### 修改的文件
- 前端：frontend/src/components/ChapterUnlockModal/ChapterUnlockModal.tsx
- 后端：backend/routes/chapter_unlock.js
- 文档：DEVELOPMENT_STANDARDS.md

### 修改原因
- 修复API端点不匹配问题
- 统一命名规范

### 影响范围
- API端点：unlock-with-karma
- 功能：Karma解锁章节
- 用户：所有使用Karma解锁的用户

### 测试验证
- [ ] 运行 npm run check:all
- [ ] 测试Karma解锁功能
- [ ] 验证API端点一致性
```

## 🎯 最佳实践

### 1. 开发前
- 仔细阅读开发规范
- 搜索相关代码了解现状
- 运行检查工具确认环境

### 2. 开发中
- 使用统一的命名规范
- 实现完整的错误处理
- 添加适当的日志记录
- 定期运行检查工具

### 3. 开发后
- 运行所有检查工具
- 测试功能完整性
- 更新相关文档
- 记录变更日志

---

**重要提醒**：每次开发前请仔细阅读本指南，确保所有步骤都已完成。如有疑问，请及时沟通确认。
