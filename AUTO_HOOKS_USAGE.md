# 自动开发钩子使用说明

## 🚀 快速开始

### 1. 开发前自动检查
```bash
# 运行开发前检查
./dev-start.sh

# 或者直接运行
npm run auto:check
```

### 2. 开发中自动检查
```bash
# 运行开发中检查
./dev-check.sh

# 或者直接运行
npm run check:pre-commit
```

### 3. 开发后自动检查
```bash
# 运行开发后检查
./dev-finish.sh

# 或者直接运行
npm run check:all
```

## 🔧 自动化方式

### 方式1：Git Hooks（推荐）
- 每次提交前自动运行开发前检查
- 每次提交后自动运行开发后检查
- 已自动设置，无需手动操作

### 方式2：IDE集成
- 在VS Code中使用Ctrl+Shift+P
- 选择"任务：运行任务"
- 选择相应的检查任务

### 方式3：手动脚本
- 使用提供的shell脚本
- 在开发的不同阶段运行相应脚本

## 📊 检查内容

### 开发前检查
- API端点一致性
- 数据库事务使用
- 错误处理完整性
- 项目结构完整性

### 开发中检查
- 新修改的API端点
- 数据库操作事务
- 错误处理完整性
- 前端API调用

### 开发后检查
- 所有API端点一致性
- 完整的数据库事务检查
- 全面的错误处理检查
- 文档同步性检查

## 🎯 最佳实践

1. **每次Chat开发前**：运行 `./dev-start.sh`
2. **开发过程中**：按需运行 `./dev-check.sh`
3. **开发完成后**：运行 `./dev-finish.sh`

## 🚨 故障排除

### 检查失败
- 查看日志文件：`logs/auto-hooks-*.log`
- 运行详细检查：`npm run check:all`
- 检查配置文件：`auto-config.json`

### 权限问题
```bash
# 给脚本添加执行权限
chmod +x dev-*.sh
```

### 依赖问题
```bash
# 安装依赖
npm install

# 检查Node.js版本
node --version
```
