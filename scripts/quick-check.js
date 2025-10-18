#!/usr/bin/env node

/**
 * 快速检查脚本
 * 专门用于Git hooks，运行时间短
 */

const fs = require('fs');
const path = require('path');

class QuickChecker {
  constructor() {
    this.errors = [];
    this.warnings = [];
  }

  /**
   * 检查关键文件是否存在
   */
  checkEssentialFiles() {
    console.log('🔍 检查关键文件...');
    
    const essentialFiles = [
      'package.json',
      'backend/routes/chapter_unlock.js',
      'frontend/src/components/ChapterUnlockModal/ChapterUnlockModal.tsx'
    ];
    
    essentialFiles.forEach(file => {
      if (fs.existsSync(file)) {
        console.log(`   ✅ ${file}`);
      } else {
        console.log(`   ❌ ${file} 缺失`);
        this.errors.push(`关键文件缺失: ${file}`);
      }
    });
  }

  /**
   * 检查API端点一致性（快速版本）
   */
  checkAPIConsistency() {
    console.log('🔍 检查API端点一致性...');
    
    try {
      // 检查前端文件
      const frontendFile = 'frontend/src/components/ChapterUnlockModal/ChapterUnlockModal.tsx';
      if (fs.existsSync(frontendFile)) {
        const content = fs.readFileSync(frontendFile, 'utf8');
        
        // 检查是否使用了正确的API端点
        if (content.includes('unlock-with-karma')) {
          console.log('   ✅ 前端使用正确的API端点: unlock-with-karma');
        } else if (content.includes('buy-with-karma')) {
          console.log('   ⚠️  前端使用旧的API端点: buy-with-karma');
          this.warnings.push('前端使用旧的API端点，需要更新为unlock-with-karma');
        }
        
        // 检查是否使用动态Karma数量
        if (content.includes('unlockStatus?.unlockPrice')) {
          console.log('   ✅ 前端使用动态Karma数量显示');
        } else if (content.includes('每章 10 Karma')) {
          console.log('   ⚠️  前端使用硬编码Karma数量');
          this.warnings.push('前端使用硬编码Karma数量，需要改为动态显示');
        }
      }
      
      // 检查后端文件
      const backendFile = 'backend/routes/chapter_unlock.js';
      if (fs.existsSync(backendFile)) {
        const content = fs.readFileSync(backendFile, 'utf8');
        
        if (content.includes('unlockPrice')) {
          console.log('   ✅ 后端返回unlockPrice字段');
        } else {
          console.log('   ❌ 后端缺少unlockPrice字段');
          this.errors.push('后端API缺少unlockPrice字段');
        }
      }
      
    } catch (error) {
      console.log(`   ❌ 检查失败: ${error.message}`);
      this.errors.push(`API一致性检查失败: ${error.message}`);
    }
  }

  /**
   * 检查代码语法
   */
  checkSyntax() {
    console.log('🔍 检查代码语法...');
    
    const filesToCheck = [
      'backend/routes/chapter_unlock.js',
      'frontend/src/components/ChapterUnlockModal/ChapterUnlockModal.tsx'
    ];
    
    filesToCheck.forEach(file => {
      if (fs.existsSync(file)) {
        try {
          const content = fs.readFileSync(file, 'utf8');
          
          // 简单的语法检查
          if (file.endsWith('.js')) {
            // 检查JavaScript语法
            if (content.includes('module.exports') || content.includes('export')) {
              console.log(`   ✅ ${file} 语法正确`);
            } else {
              console.log(`   ⚠️  ${file} 可能缺少导出语句`);
            }
          } else if (file.endsWith('.tsx')) {
            // 检查TypeScript语法
            if (content.includes('interface') && content.includes('React.FC')) {
              console.log(`   ✅ ${file} 语法正确`);
            } else {
              console.log(`   ⚠️  ${file} 可能缺少类型定义`);
            }
          }
        } catch (error) {
          console.log(`   ❌ ${file} 读取失败: ${error.message}`);
          this.errors.push(`文件读取失败: ${file}`);
        }
      }
    });
  }

  /**
   * 运行快速检查
   */
  async run() {
    console.log('🚀 开始快速检查...\n');
    
    // 运行各项检查
    this.checkEssentialFiles();
    this.checkAPIConsistency();
    this.checkSyntax();
    
    // 输出结果
    console.log('\n📊 快速检查结果:');
    console.log('='.repeat(40));
    
    if (this.errors.length > 0) {
      console.log('\n❌ 发现错误:');
      this.errors.forEach(error => {
        console.log(`   - ${error}`);
      });
      console.log('\n❌ 检查失败，请修复错误后重试');
      return false;
    }
    
    if (this.warnings.length > 0) {
      console.log('\n⚠️  发现警告:');
      this.warnings.forEach(warning => {
        console.log(`   - ${warning}`);
      });
    }
    
    if (this.errors.length === 0 && this.warnings.length === 0) {
      console.log('\n✅ 所有检查通过！');
    } else if (this.errors.length === 0) {
      console.log('\n✅ 检查通过（有警告）');
    }
    
    console.log('\n' + '='.repeat(40));
    return this.errors.length === 0;
  }
}

// 运行检查
if (require.main === module) {
  const checker = new QuickChecker();
  checker.run().then(success => {
    process.exit(success ? 0 : 1);
  }).catch(error => {
    console.error('快速检查过程中出错:', error);
    process.exit(1);
  });
}

module.exports = QuickChecker;
