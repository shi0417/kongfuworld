#!/usr/bin/env node

/**
 * 提交前检查脚本
 * 在每次代码提交前运行，确保代码质量
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class PreCommitChecker {
  constructor() {
    this.errors = [];
    this.warnings = [];
  }

  /**
   * 检查API端点一致性
   */
  checkAPIConsistency() {
    console.log('🔍 检查API端点一致性...');
    
    try {
      // 搜索关键API端点
      const criticalEndpoints = [
        'unlock-with-karma',
        'unlock-with-key',
        'buy-with-karma',
        'chapter-unlock'
      ];
      
      criticalEndpoints.forEach(endpoint => {
        const results = this.searchInFiles(endpoint);
        if (results.length > 0) {
          console.log(`   ✅ 找到 ${endpoint} 的 ${results.length} 个引用`);
          
          // 检查是否有一致性问题
          const inconsistentFiles = results.filter(file => 
            !file.includes('unlock-with-karma') && endpoint === 'unlock-with-karma'
          );
          
          if (inconsistentFiles.length > 0) {
            this.warnings.push(`发现可能的API端点不一致: ${endpoint}`);
            console.log(`   ⚠️  可能的端点不一致`);
          }
        }
      });
      
    } catch (error) {
      this.errors.push(`API一致性检查失败: ${error.message}`);
    }
  }

  /**
   * 检查数据库事务使用
   */
  checkDatabaseTransactions() {
    console.log('🔍 检查数据库事务使用...');
    
    try {
      const routeFiles = this.findFiles('./backend/routes', '.js');
      
      routeFiles.forEach(file => {
        const content = fs.readFileSync(file, 'utf8');
        
        // 检查是否有写操作但没有事务
        const hasWriteOperations = /INSERT|UPDATE|DELETE/.test(content);
        const hasTransaction = /START TRANSACTION|BEGIN/.test(content);
        
        if (hasWriteOperations && !hasTransaction) {
          this.warnings.push(`文件 ${file} 有写操作但可能缺少事务`);
          console.log(`   ⚠️  ${file} 可能需要添加事务`);
        }
      });
      
    } catch (error) {
      this.errors.push(`数据库事务检查失败: ${error.message}`);
    }
  }

  /**
   * 检查错误处理
   */
  checkErrorHandling() {
    console.log('🔍 检查错误处理...');
    
    try {
      const routeFiles = this.findFiles('./backend/routes', '.js');
      
      routeFiles.forEach(file => {
        const content = fs.readFileSync(file, 'utf8');
        
        // 检查是否有try-catch块
        const hasTryCatch = /try\s*{/.test(content);
        const hasErrorHandling = /catch\s*\(/.test(content);
        
        if (hasTryCatch && !hasErrorHandling) {
          this.warnings.push(`文件 ${file} 有try块但可能缺少catch处理`);
          console.log(`   ⚠️  ${file} 可能需要添加错误处理`);
        }
      });
      
    } catch (error) {
      this.errors.push(`错误处理检查失败: ${error.message}`);
    }
  }

  /**
   * 检查前端API调用
   */
  checkFrontendAPICalls() {
    console.log('🔍 检查前端API调用...');
    
    try {
      const frontendFiles = this.findFiles('./frontend/src', '.tsx');
      
      frontendFiles.forEach(file => {
        const content = fs.readFileSync(file, 'utf8');
        
        // 检查fetch调用
        const fetchCalls = content.match(/fetch\(['"`]([^'"`]+)['"`]/g);
        if (fetchCalls) {
          fetchCalls.forEach(call => {
            const url = call.match(/fetch\(['"`]([^'"`]+)['"`]/)[1];
            if (url.includes('/api/')) {
              console.log(`   📡 找到API调用: ${url}`);
              
              // 检查是否有错误处理
              const hasErrorHandling = /catch\s*\(/.test(content);
              if (!hasErrorHandling) {
                this.warnings.push(`文件 ${file} 的API调用可能缺少错误处理`);
              }
            }
          });
        }
      });
      
    } catch (error) {
      this.errors.push(`前端API调用检查失败: ${error.message}`);
    }
  }

  /**
   * 检查文档同步性
   */
  checkDocumentationSync() {
    console.log('🔍 检查文档同步性...');
    
    try {
      const docFiles = this.findFiles('.', '.md');
      
      docFiles.forEach(file => {
        if (file.includes('IMPLEMENTATION') || file.includes('FIX_SUMMARY')) {
          const content = fs.readFileSync(file, 'utf8');
          
          // 检查是否有API端点文档
          const hasAPIEndpoints = /POST\s+\/api\/|GET\s+\/api\//.test(content);
          if (hasAPIEndpoints) {
            console.log(`   📚 文档 ${file} 包含API端点`);
          }
        }
      });
      
    } catch (error) {
      this.errors.push(`文档同步性检查失败: ${error.message}`);
    }
  }

  /**
   * 在文件中搜索内容
   */
  searchInFiles(searchTerm) {
    const results = [];
    
    try {
      const command = `grep -r "${searchTerm}" . --include="*.js" --include="*.tsx" --include="*.ts" --include="*.md"`;
      const output = execSync(command, { encoding: 'utf8' });
      
      if (output) {
        const lines = output.split('\n').filter(line => line.trim());
        lines.forEach(line => {
          const filePath = line.split(':')[0];
          if (filePath && !filePath.includes('node_modules')) {
            results.push(filePath);
          }
        });
      }
    } catch (error) {
      // grep没有找到结果时会有非零退出码，这是正常的
    }
    
    return results;
  }

  /**
   * 查找文件
   */
  findFiles(dir, extension) {
    const files = [];
    
    if (!fs.existsSync(dir)) {
      return files;
    }
    
    const items = fs.readdirSync(dir);
    
    items.forEach(item => {
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory() && !item.startsWith('.') && item !== 'node_modules') {
        files.push(...this.findFiles(fullPath, extension));
      } else if (stat.isFile() && item.endsWith(extension)) {
        files.push(fullPath);
      }
    });
    
    return files;
  }

  /**
   * 运行所有检查
   */
  async run() {
    console.log('🚀 开始提交前检查...\n');
    
    // 运行各项检查
    this.checkAPIConsistency();
    this.checkDatabaseTransactions();
    this.checkErrorHandling();
    this.checkFrontendAPICalls();
    this.checkDocumentationSync();
    
    // 输出结果
    console.log('\n📊 检查结果:');
    console.log('='.repeat(50));
    
    if (this.errors.length > 0) {
      console.log('\n❌ 发现错误:');
      this.errors.forEach(error => {
        console.log(`   - ${error}`);
      });
    }
    
    if (this.warnings.length > 0) {
      console.log('\n⚠️  发现警告:');
      this.warnings.forEach(warning => {
        console.log(`   - ${warning}`);
      });
    }
    
    if (this.errors.length === 0 && this.warnings.length === 0) {
      console.log('\n✅ 所有检查通过！');
    }
    
    console.log('\n' + '='.repeat(50));
    
    // 返回检查结果
    return {
      success: this.errors.length === 0,
      errors: this.errors,
      warnings: this.warnings
    };
  }
}

// 运行检查
if (require.main === module) {
  const checker = new PreCommitChecker();
  checker.run().then(result => {
    if (!result.success) {
      console.log('\n❌ 检查失败，请修复错误后重试');
      process.exit(1);
    } else {
      console.log('\n✅ 检查通过，可以提交代码');
      process.exit(0);
    }
  }).catch(error => {
    console.error('检查过程中出错:', error);
    process.exit(1);
  });
}

module.exports = PreCommitChecker;
