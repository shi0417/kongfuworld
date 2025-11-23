# 自动运行程序启动指南

## 🎯 当前状态检查

### ✅ Git Hooks 已设置
- **pre-commit**: 提交前自动运行 `npm run quick:check`
- **post-commit**: 提交后自动运行 `npm run check:all`

### ✅ 自动检查程序已配置
- **开发前**: `npm run auto:start` → 运行 `scripts/simple-auto-runner.js`
- **开发中**: `npm run auto:during` → 运行 `scripts/simple-auto-runner.js`
- **开发后**: `npm run auto:post` → 运行 `scripts/simple-auto-runner.js`

## 🚀 如何启动自动运行程序

### 方式1：手动启动（推荐用于Chat开发）

#### 开发前检查
```bash
npm run auto:start
```
**功能**：
- 检查API端点一致性
- 检查数据库事务使用
- 检查数据库连接方式一致性 ⚠️ **新增**
- 检查错误处理完整性

#### 开发中检查
```bash
npm run auto:during
```
**功能**：
- 监控代码变更
- 检查新修改的API端点
- 验证数据库操作一致性

#### 开发后检查
```bash
npm run auto:post
```
**功能**：
- 全面检查所有功能
- 验证所有检查通过
- 生成最终报告

### 方式2：Git 自动触发

#### 提交前自动检查
```bash
git add .
git commit -m "你的提交信息"
```
**自动运行**：`pre-commit` hook 会运行 `npm run quick:check`

#### 提交后自动检查
```bash
git commit -m "你的提交信息"
```
**自动运行**：`post-commit` hook 会运行 `npm run check:all`

### 方式3：一键运行所有检查
```bash
npm run dev:auto
```
**功能**：依次运行开发前、开发中、开发后检查

## 📊 检查结果解读

### 成功情况
```
✅ API端点一致性检查通过
✅ 数据库事务检查通过
✅ 数据库连接方式一致性检查通过
✅ 错误处理检查通过
🎉 所有检查通过！项目状态良好
```

### 发现问题
```
⚠️  发现 8 个问题需要关注
- API端点不一致：1个
- 数据库事务问题：3个
- 数据库连接方式问题：4个 ⚠️ **新增**
- 错误处理问题：0个
```

## 🔧 故障排除

### 1. 检查程序不运行
```bash
# 检查Git hooks权限
ls -la .git/hooks/

# 重新设置Git hooks
npm run setup:auto
```

### 2. 检查失败
```bash
# 查看详细日志
ls logs/simple-auto-*.log

# 运行详细检查
npm run auto:start
```

### 3. 权限问题
```bash
# 给脚本添加执行权限
chmod +x dev-*.sh
chmod +x .git/hooks/*
```

## 🎯 最佳实践

### 每次Chat开发时

1. **开发前**：
   ```bash
   npm run auto:start
   ```
   确保项目状态良好后再开始开发

2. **开发中**：
   ```bash
   npm run auto:during
   ```
   修改代码后及时检查

3. **开发后**：
   ```bash
   npm run auto:post
   ```
   确保所有检查通过

### Git 提交时

1. **提交前**：自动运行快速检查
2. **提交后**：自动运行完整检查
3. **发现问题**：查看日志并修复

## 📋 快速命令参考

```bash
# 开发前检查
npm run auto:start

# 开发中检查
npm run auto:during

# 开发后检查
npm run auto:post

# 运行所有检查
npm run dev:auto

# 查看检查菜单
npm run dev:menu

# 查看日志
ls logs/simple-auto-*.log
```

## 🎉 总结

**自动运行程序已完全设置并可用！**

- ✅ Git hooks 自动触发
- ✅ 手动命令随时可用
- ✅ 数据库连接方式检查已增强
- ✅ 详细日志和报告生成

**重要提醒**：每次Chat开发前请运行 `npm run auto:start`，确保项目状态良好后再开始开发！
