#!/usr/bin/env node

/**
 * 设置自动开发钩子
 * 创建Git hooks和自动化脚本
 */

const fs = require('fs');
const path = require('path');

class AutoHooksSetup {
  constructor() {
    this.gitHooksDir = '.git/hooks';
    this.scriptsDir = 'scripts';
  }

  /**
   * 设置Git hooks
   */
  setupGitHooks() {
    console.log('🔧 设置Git hooks...');
    
    // 确保Git hooks目录存在
    if (!fs.existsSync(this.gitHooksDir)) {
      console.log('❌ 不是Git仓库，无法设置Git hooks');
      return false;
    }
    
    // 创建pre-commit hook
    const preCommitHook = `#!/bin/bash
# 开发前自动检查
echo "🚀 运行开发前自动检查..."
npm run auto:check
if [ $? -ne 0 ]; then
  echo "❌ 开发前检查失败，请修复问题后重试"
  exit 1
fi
echo "✅ 开发前检查通过"
`;
    
    fs.writeFileSync(path.join(this.gitHooksDir, 'pre-commit'), preCommitHook);
    fs.chmodSync(path.join(this.gitHooksDir, 'pre-commit'), '755');
    
    // 创建post-commit hook
    const postCommitHook = `#!/bin/bash
# 开发后自动检查
echo "🏁 运行开发后自动检查..."
npm run check:all
if [ $? -ne 0 ]; then
  echo "⚠️  开发后检查发现问题，请查看日志"
else
  echo "✅ 开发后检查通过"
fi
`;
    
    fs.writeFileSync(path.join(this.gitHooksDir, 'post-commit'), postCommitHook);
    fs.chmodSync(path.join(this.gitHooksDir, 'post-commit'), '755');
    
    console.log('✅ Git hooks设置完成');
    return true;
  }

  /**
   * 创建自动化脚本
   */
  createAutoScripts() {
    console.log('📝 创建自动化脚本...');
    
    // 创建开发前检查脚本
    const preDevScript = `#!/bin/bash
# 开发前自动检查脚本
echo "🚀 开始Chat开发前自动检查..."
npm run auto:check
if [ $? -eq 0 ]; then
  echo "✅ 开发前检查通过，可以开始开发"
else
  echo "❌ 开发前检查失败，请修复问题后开始开发"
  exit 1
fi
`;
    
    fs.writeFileSync('dev-start.sh', preDevScript);
    fs.chmodSync('dev-start.sh', '755');
    
    // 创建开发中检查脚本
    const duringDevScript = `#!/bin/bash
# 开发中自动检查脚本
echo "🔍 运行开发中自动检查..."
npm run check:pre-commit
if [ $? -eq 0 ]; then
  echo "✅ 开发中检查通过"
else
  echo "⚠️  开发中检查发现问题，请查看日志"
fi
`;
    
    fs.writeFileSync('dev-check.sh', duringDevScript);
    fs.chmodSync('dev-check.sh', '755');
    
    // 创建开发后检查脚本
    const postDevScript = `#!/bin/bash
# 开发后自动检查脚本
echo "🏁 运行开发后自动检查..."
npm run check:all
if [ $? -eq 0 ]; then
  echo "✅ 开发后检查通过，开发完成"
else
  echo "⚠️  开发后检查发现问题，请查看日志"
fi
`;
    
    fs.writeFileSync('dev-finish.sh', postDevScript);
    fs.chmodSync('dev-finish.sh', '755');
    
    console.log('✅ 自动化脚本创建完成');
  }

  /**
   * 创建IDE集成脚本
   */
  createIDEIntegration() {
    console.log('🔌 创建IDE集成脚本...');
    
    // 创建VS Code任务配置
    const vscodeTasks = {
      "version": "2.0.0",
      "tasks": [
        {
          "label": "开发前检查",
          "type": "shell",
          "command": "npm run auto:check",
          "group": "build",
          "presentation": {
            "echo": true,
            "reveal": "always",
            "focus": false,
            "panel": "shared"
          }
        },
        {
          "label": "开发中检查",
          "type": "shell",
          "command": "npm run check:pre-commit",
          "group": "build",
          "presentation": {
            "echo": true,
            "reveal": "always",
            "focus": false,
            "panel": "shared"
          }
        },
        {
          "label": "开发后检查",
          "type": "shell",
          "command": "npm run check:all",
          "group": "build",
          "presentation": {
            "echo": true,
            "reveal": "always",
            "focus": false,
            "panel": "shared"
          }
        }
      ]
    };
    
    // 确保.vscode目录存在
    if (!fs.existsSync('.vscode')) {
      fs.mkdirSync('.vscode');
    }
    
    fs.writeFileSync('.vscode/tasks.json', JSON.stringify(vscodeTasks, null, 2));
    
    console.log('✅ IDE集成脚本创建完成');
  }

  /**
   * 创建自动化配置文件
   */
  createAutoConfig() {
    console.log('⚙️  创建自动化配置文件...');
    
    const autoConfig = {
      "autoHooks": {
        "enabled": true,
        "preChat": {
          "command": "npm run auto:check",
          "description": "Chat开发前自动检查",
          "autoRun": true
        },
        "duringChat": {
          "command": "npm run check:pre-commit",
          "description": "开发过程中自动检查",
          "autoRun": true,
          "trigger": "file-change"
        },
        "postChat": {
          "command": "npm run check:all",
          "description": "开发完成后自动检查",
          "autoRun": true
        }
      },
      "fileWatchers": [
        "backend/routes/**/*.js",
        "frontend/src/**/*.tsx",
        "frontend/src/**/*.ts"
      ],
      "excludePatterns": [
        "node_modules/**",
        "logs/**",
        "*.log"
      ]
    };
    
    fs.writeFileSync('auto-config.json', JSON.stringify(autoConfig, null, 2));
    
    console.log('✅ 自动化配置文件创建完成');
  }

  /**
   * 创建使用说明
   */
  createUsageGuide() {
    console.log('📚 创建使用说明...');
    
    const usageGuide = `# 自动开发钩子使用说明

## 🚀 快速开始

### 1. 开发前自动检查
\`\`\`bash
# 运行开发前检查
./dev-start.sh

# 或者直接运行
npm run auto:check
\`\`\`

### 2. 开发中自动检查
\`\`\`bash
# 运行开发中检查
./dev-check.sh

# 或者直接运行
npm run check:pre-commit
\`\`\`

### 3. 开发后自动检查
\`\`\`bash
# 运行开发后检查
./dev-finish.sh

# 或者直接运行
npm run check:all
\`\`\`

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

1. **每次Chat开发前**：运行 \`./dev-start.sh\`
2. **开发过程中**：按需运行 \`./dev-check.sh\`
3. **开发完成后**：运行 \`./dev-finish.sh\`

## 🚨 故障排除

### 检查失败
- 查看日志文件：\`logs/auto-hooks-*.log\`
- 运行详细检查：\`npm run check:all\`
- 检查配置文件：\`auto-config.json\`

### 权限问题
\`\`\`bash
# 给脚本添加执行权限
chmod +x dev-*.sh
\`\`\`

### 依赖问题
\`\`\`bash
# 安装依赖
npm install

# 检查Node.js版本
node --version
\`\`\`
`;

    fs.writeFileSync('AUTO_HOOKS_USAGE.md', usageGuide);
    
    console.log('✅ 使用说明创建完成');
  }

  /**
   * 运行完整设置
   */
  async setup() {
    console.log('🎯 开始设置自动开发钩子...\n');
    
    // 设置Git hooks
    const gitHooksSuccess = this.setupGitHooks();
    
    // 创建自动化脚本
    this.createAutoScripts();
    
    // 创建IDE集成
    this.createIDEIntegration();
    
    // 创建配置文件
    this.createAutoConfig();
    
    // 创建使用说明
    this.createUsageGuide();
    
    console.log('\n✅ 自动开发钩子设置完成！');
    console.log('\n📋 可用的自动化脚本:');
    console.log('   ./dev-start.sh  - 开发前自动检查');
    console.log('   ./dev-check.sh - 开发中自动检查');
    console.log('   ./dev-finish.sh - 开发后自动检查');
    
    if (gitHooksSuccess) {
      console.log('\n🔧 Git hooks已设置:');
      console.log('   pre-commit  - 提交前自动检查');
      console.log('   post-commit - 提交后自动检查');
    }
    
    console.log('\n📚 详细使用说明请查看: AUTO_HOOKS_USAGE.md');
  }
}

// 运行设置
if (require.main === module) {
  const setup = new AutoHooksSetup();
  setup.setup().catch(console.error);
}

module.exports = AutoHooksSetup;
