# 自动开发检查设置指南

## 🎯 目标
实现Chat开发时自动运行检查，无需手动操作，确保代码质量和一致性。

## 🚀 自动化方案

### 方案1：Git Hooks（推荐）
**特点**：完全自动化，无需手动操作
**适用**：使用Git版本控制的项目

```bash
# 设置Git hooks
npm run setup:auto

# 之后每次提交都会自动运行检查
git add .
git commit -m "修复API端点问题"
# 自动运行：开发前检查 → 提交 → 开发后检查
```

### 方案2：IDE集成
**特点**：在IDE中一键运行
**适用**：使用VS Code等支持任务的IDE

```bash
# 设置IDE集成
npm run setup:auto

# 在VS Code中：
# Ctrl+Shift+P → 任务：运行任务 → 选择相应检查
```

### 方案3：Shell脚本
**特点**：手动运行，但脚本化
**适用**：需要精确控制检查时机的场景

```bash
# 开发前
./dev-start.sh

# 开发中
./dev-check.sh

# 开发后
./dev-finish.sh
```

### 方案4：NPM脚本
**特点**：使用npm命令运行
**适用**：熟悉npm命令的开发方式

```bash
# 开发前
npm run dev:pre

# 开发中
npm run dev:during

# 开发后
npm run dev:post

# 一键运行所有检查
npm run dev:auto
```

## 🔧 设置步骤

### 1. 运行自动设置
```bash
# 设置所有自动化钩子
npm run setup:auto
```

### 2. 验证设置
```bash
# 测试开发前检查
npm run dev:pre

# 测试开发中检查
npm run dev:during

# 测试开发后检查
npm run dev:post
```

### 3. 开始使用
```bash
# 方式1：使用Git hooks（推荐）
git add .
git commit -m "你的提交信息"
# 自动运行所有检查

# 方式2：使用npm脚本
npm run dev:auto

# 方式3：使用shell脚本
./dev-start.sh
```

## 📊 自动化检查内容

### 开发前检查（自动运行）
- ✅ API端点一致性
- ✅ 数据库事务使用
- ✅ 错误处理完整性
- ✅ 项目结构完整性

### 开发中检查（按需运行）
- ✅ 新修改的API端点
- ✅ 数据库操作事务
- ✅ 错误处理完整性
- ✅ 前端API调用

### 开发后检查（自动运行）
- ✅ 所有API端点一致性
- ✅ 完整的数据库事务检查
- ✅ 全面的错误处理检查
- ✅ 文档同步性检查

## 🎯 使用场景

### Chat开发前
```bash
# 自动运行（Git hooks）
git add .
git commit -m "开始新功能开发"
# 自动运行开发前检查

# 手动运行
npm run dev:pre
```

### Chat开发中
```bash
# 修改代码后
npm run dev:during

# 或者使用shell脚本
./dev-check.sh
```

### Chat开发后
```bash
# 自动运行（Git hooks）
git commit -m "完成功能开发"
# 自动运行开发后检查

# 手动运行
npm run dev:post
```

## 🚨 故障排除

### 检查失败
```bash
# 查看详细日志
cat logs/auto-hooks-*.log

# 运行详细检查
npm run check:all

# 检查配置文件
cat auto-config.json
```

### 权限问题
```bash
# 给脚本添加执行权限
chmod +x dev-*.sh

# 检查Git hooks权限
ls -la .git/hooks/
```

### 依赖问题
```bash
# 安装依赖
npm install

# 检查Node.js版本
node --version

# 检查npm版本
npm --version
```

## 📋 最佳实践

### 1. 开发前
- 运行 `npm run setup:auto` 设置自动化
- 使用Git hooks实现完全自动化
- 查看检查结果了解项目状态

### 2. 开发中
- 定期运行 `npm run dev:during`
- 及时修复发现的问题
- 保持代码质量

### 3. 开发后
- 运行 `npm run dev:post` 确保质量
- 查看详细日志确认所有问题已解决
- 记录变更和修复内容

## 🎉 总结

通过这个自动化系统，你可以：

1. **完全自动化**：Git hooks自动运行检查
2. **提高效率**：无需手动运行检查命令
3. **确保质量**：每次开发都自动检查
4. **减少错误**：避免类似API端点不匹配的问题

**重要提醒**：运行 `npm run setup:auto` 设置自动化后，每次Git提交都会自动运行检查，确保代码质量！
