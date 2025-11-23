// 更新Git Hooks以包含新的认证系统检查
const fs = require('fs');
const path = require('path');

console.log('🔧 更新Git Hooks以包含认证系统检查...\n');

class GitHooksUpdater {
  constructor() {
    this.gitHooksDir = '.git/hooks';
  }

  /**
   * 更新pre-commit hook
   */
  updatePreCommitHook() {
    console.log('📝 更新pre-commit hook...');
    
    const preCommitContent = `#!/bin/bash
# 开发前自动检查（包含认证系统检查）
echo "🚀 运行开发前自动检查..."
npm run auto:start
if [ $? -ne 0 ]; then
  echo "❌ 开发前检查失败，请修复问题后重试"
  exit 1
fi
echo "✅ 开发前检查通过"
`;

    try {
      fs.writeFileSync(path.join(this.gitHooksDir, 'pre-commit'), preCommitContent);
      fs.chmodSync(path.join(this.gitHooksDir, 'pre-commit'), '755');
      console.log('✅ pre-commit hook更新成功');
      return true;
    } catch (error) {
      console.error('❌ pre-commit hook更新失败:', error.message);
      return false;
    }
  }

  /**
   * 更新post-commit hook
   */
  updatePostCommitHook() {
    console.log('📝 更新post-commit hook...');
    
    const postCommitContent = `#!/bin/bash
# 开发后自动检查（包含认证系统检查）
echo "🏁 运行开发后自动检查..."
npm run auto:post
if [ $? -ne 0 ]; then
  echo "⚠️  开发后检查发现问题，请查看日志"
else
  echo "✅ 开发后检查通过"
fi
`;

    try {
      fs.writeFileSync(path.join(this.gitHooksDir, 'post-commit'), postCommitContent);
      fs.chmodSync(path.join(this.gitHooksDir, 'post-commit'), '755');
      console.log('✅ post-commit hook更新成功');
      return true;
    } catch (error) {
      console.error('❌ post-commit hook更新失败:', error.message);
      return false;
    }
  }

  /**
   * 验证Git hooks
   */
  verifyGitHooks() {
    console.log('🔍 验证Git hooks...');
    
    const hooks = ['pre-commit', 'post-commit'];
    let allGood = true;
    
    hooks.forEach(hook => {
      const hookPath = path.join(this.gitHooksDir, hook);
      if (fs.existsSync(hookPath)) {
        const content = fs.readFileSync(hookPath, 'utf8');
        if (content.includes('auto:start') || content.includes('auto:post')) {
          console.log(`✅ ${hook} 已更新为新的认证系统检查`);
        } else {
          console.log(`⚠️  ${hook} 仍使用旧的检查脚本`);
          allGood = false;
        }
      } else {
        console.log(`❌ ${hook} 不存在`);
        allGood = false;
      }
    });
    
    return allGood;
  }

  /**
   * 运行更新
   */
  async run() {
    console.log('🎯 开始更新Git Hooks...\n');
    
    // 检查Git仓库
    if (!fs.existsSync(this.gitHooksDir)) {
      console.log('❌ 不是Git仓库，无法更新Git hooks');
      return false;
    }
    
    // 更新hooks
    const preCommitSuccess = this.updatePreCommitHook();
    const postCommitSuccess = this.updatePostCommitHook();
    
    if (preCommitSuccess && postCommitSuccess) {
      console.log('\n✅ Git Hooks更新完成！');
      
      // 验证更新
      const verification = this.verifyGitHooks();
      if (verification) {
        console.log('\n🎉 所有Git Hooks已成功更新为新的认证系统检查！');
        console.log('\n📋 更新内容:');
        console.log('  - pre-commit: 现在运行 npm run auto:start (包含认证系统检查)');
        console.log('  - post-commit: 现在运行 npm run auto:post (包含认证系统检查)');
        console.log('\n🚀 现在每次Git提交都会自动运行完整的认证系统检查！');
      } else {
        console.log('\n⚠️  Git Hooks更新完成，但验证时发现问题');
      }
      
      return true;
    } else {
      console.log('\n❌ Git Hooks更新失败');
      return false;
    }
  }
}

// 运行更新
if (require.main === module) {
  const updater = new GitHooksUpdater();
  updater.run().then(success => {
    process.exit(success ? 0 : 1);
  }).catch(error => {
    console.error('更新Git Hooks时出错:', error);
    process.exit(1);
  });
}

module.exports = GitHooksUpdater;
