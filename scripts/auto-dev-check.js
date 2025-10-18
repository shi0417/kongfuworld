#!/usr/bin/env node

/**
 * 自动开发检查脚本
 * 在每次Chat开发时自动运行，确保代码质量
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class AutoDevChecker {
  constructor() {
    this.sessionId = this.generateSessionId();
    this.logFile = `logs/dev-check-${this.sessionId}.log`;
    this.ensureLogDir();
  }

  /**
   * 生成会话ID
   */
  generateSessionId() {
    return new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  }

  /**
   * 确保日志目录存在
   */
  ensureLogDir() {
    if (!fs.existsSync('logs')) {
      fs.mkdirSync('logs');
    }
  }

  /**
   * 记录日志
   */
  log(message, level = 'INFO') {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [${level}] ${message}\n`;
    
    console.log(message);
    fs.appendFileSync(this.logFile, logMessage);
  }

  /**
   * 检查项目状态
   */
  checkProjectStatus() {
    this.log('🔍 检查项目状态...');
    
    const status = {
      hasBackend: fs.existsSync('backend'),
      hasFrontend: fs.existsSync('frontend'),
      hasScripts: fs.existsSync('scripts'),
      hasPackageJson: fs.existsSync('package.json')
    };
    
    Object.entries(status).forEach(([key, value]) => {
      this.log(`   ${value ? '✅' : '❌'} ${key}: ${value}`);
    });
    
    return status;
  }

  /**
   * 检查API端点一致性
   */
  checkAPIConsistency() {
    this.log('🔍 检查API端点一致性...');
    
    try {
      // 搜索关键API端点
      const criticalEndpoints = [
        'unlock-with-karma',
        'unlock-with-key',
        'buy-with-karma',
        'chapter-unlock'
      ];
      
      const results = {};
      
      criticalEndpoints.forEach(endpoint => {
        try {
          const command = `grep -r "${endpoint}" . --include="*.js" --include="*.tsx" --include="*.ts" --include="*.md" 2>nul || echo ""`;
          const output = execSync(command, { encoding: 'utf8' });
          
          if (output.trim()) {
            const files = output.split('\n').filter(line => line.trim()).map(line => line.split(':')[0]);
            results[endpoint] = [...new Set(files)];
            this.log(`   ✅ ${endpoint}: 找到 ${results[endpoint].length} 个引用`);
          } else {
            results[endpoint] = [];
            this.log(`   ⚠️  ${endpoint}: 未找到引用`);
          }
        } catch (error) {
          results[endpoint] = [];
          this.log(`   ❌ ${endpoint}: 检查失败 - ${error.message}`);
        }
      });
      
      // 检查一致性
      const inconsistentEndpoints = [];
      Object.entries(results).forEach(([endpoint, files]) => {
        if (files.length > 0) {
          const hasFrontend = files.some(f => f.includes('frontend'));
          const hasBackend = files.some(f => f.includes('backend'));
          
          if (hasFrontend && !hasBackend) {
            inconsistentEndpoints.push(`${endpoint} - 前端有引用但后端可能缺失`);
          } else if (hasBackend && !hasFrontend) {
            inconsistentEndpoints.push(`${endpoint} - 后端有引用但前端可能缺失`);
          }
        }
      });
      
      if (inconsistentEndpoints.length > 0) {
        this.log('⚠️  发现可能的API端点不一致:');
        inconsistentEndpoints.forEach(issue => {
          this.log(`     - ${issue}`);
        });
      } else {
        this.log('✅ API端点一致性检查通过');
      }
      
      return { results, inconsistentEndpoints };
      
    } catch (error) {
      this.log(`❌ API一致性检查失败: ${error.message}`, 'ERROR');
      return { results: {}, inconsistentEndpoints: [] };
    }
  }

  /**
   * 检查数据库事务使用
   */
  checkDatabaseTransactions() {
    this.log('🔍 检查数据库事务使用...');
    
    try {
      const routeFiles = this.findFiles('./backend/routes', '.js');
      const issues = [];
      
      routeFiles.forEach(file => {
        try {
          const content = fs.readFileSync(file, 'utf8');
          
          // 检查是否有写操作但没有事务
          const hasWriteOperations = /INSERT|UPDATE|DELETE/.test(content);
          const hasTransaction = /START TRANSACTION|BEGIN/.test(content);
          
          if (hasWriteOperations && !hasTransaction) {
            issues.push(file);
            this.log(`   ⚠️  ${file} 有写操作但可能缺少事务`);
          } else if (hasWriteOperations && hasTransaction) {
            this.log(`   ✅ ${file} 正确使用了事务`);
          }
        } catch (error) {
          this.log(`   ❌ 读取文件失败: ${file} - ${error.message}`, 'ERROR');
        }
      });
      
      if (issues.length > 0) {
        this.log(`⚠️  发现 ${issues.length} 个文件可能需要添加事务`);
      } else {
        this.log('✅ 数据库事务检查通过');
      }
      
      return issues;
      
    } catch (error) {
      this.log(`❌ 数据库事务检查失败: ${error.message}`, 'ERROR');
      return [];
    }
  }

  /**
   * 检查错误处理
   */
  checkErrorHandling() {
    this.log('🔍 检查错误处理...');
    
    try {
      const routeFiles = this.findFiles('./backend/routes', '.js');
      const issues = [];
      
      routeFiles.forEach(file => {
        try {
          const content = fs.readFileSync(file, 'utf8');
          
          // 检查是否有try-catch块
          const hasTryCatch = /try\s*{/.test(content);
          const hasErrorHandling = /catch\s*\(/.test(content);
          
          if (hasTryCatch && !hasErrorHandling) {
            issues.push(file);
            this.log(`   ⚠️  ${file} 有try块但可能缺少catch处理`);
          } else if (hasTryCatch && hasErrorHandling) {
            this.log(`   ✅ ${file} 有完整的错误处理`);
          }
        } catch (error) {
          this.log(`   ❌ 读取文件失败: ${file} - ${error.message}`, 'ERROR');
        }
      });
      
      if (issues.length > 0) {
        this.log(`⚠️  发现 ${issues.length} 个文件可能需要添加错误处理`);
      } else {
        this.log('✅ 错误处理检查通过');
      }
      
      return issues;
      
    } catch (error) {
      this.log(`❌ 错误处理检查失败: ${error.message}`, 'ERROR');
      return [];
    }
  }

  /**
   * 查找文件
   */
  findFiles(dir, extension) {
    const files = [];
    
    if (!fs.existsSync(dir)) {
      return files;
    }
    
    try {
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
    } catch (error) {
      this.log(`❌ 扫描目录失败: ${dir} - ${error.message}`, 'ERROR');
    }
    
    return files;
  }

  /**
   * 生成检查报告
   */
  generateReport(apiResults, transactionIssues, errorHandlingIssues) {
    this.log('\n📊 开发检查报告');
    this.log('='.repeat(50));
    
    // API一致性
    if (apiResults.inconsistentEndpoints.length > 0) {
      this.log('\n⚠️  API端点不一致:');
      apiResults.inconsistentEndpoints.forEach(issue => {
        this.log(`   - ${issue}`);
      });
    } else {
      this.log('\n✅ API端点一致性检查通过');
    }
    
    // 数据库事务
    if (transactionIssues.length > 0) {
      this.log('\n⚠️  数据库事务问题:');
      transactionIssues.forEach(file => {
        this.log(`   - ${file}`);
      });
    } else {
      this.log('\n✅ 数据库事务检查通过');
    }
    
    // 错误处理
    if (errorHandlingIssues.length > 0) {
      this.log('\n⚠️  错误处理问题:');
      errorHandlingIssues.forEach(file => {
        this.log(`   - ${file}`);
      });
    } else {
      this.log('\n✅ 错误处理检查通过');
    }
    
    // 总结
    const totalIssues = apiResults.inconsistentEndpoints.length + transactionIssues.length + errorHandlingIssues.length;
    
    if (totalIssues === 0) {
      this.log('\n🎉 所有检查通过！项目状态良好');
    } else {
      this.log(`\n⚠️  发现 ${totalIssues} 个问题需要关注`);
    }
    
    this.log('\n' + '='.repeat(50));
    this.log(`📝 详细日志已保存到: ${this.logFile}`);
    
    return {
      totalIssues,
      apiIssues: apiResults.inconsistentEndpoints.length,
      transactionIssues: transactionIssues.length,
      errorHandlingIssues: errorHandlingIssues.length
    };
  }

  /**
   * 运行自动检查
   */
  async run() {
    this.log('🚀 开始自动开发检查...');
    this.log(`📅 会话ID: ${this.sessionId}`);
    
    // 检查项目状态
    const projectStatus = this.checkProjectStatus();
    
    if (!projectStatus.hasBackend || !projectStatus.hasFrontend) {
      this.log('❌ 项目结构不完整，请检查目录结构', 'ERROR');
      return;
    }
    
    // 运行各项检查
    const apiResults = this.checkAPIConsistency();
    const transactionIssues = this.checkDatabaseTransactions();
    const errorHandlingIssues = this.checkErrorHandling();
    
    // 生成报告
    const report = this.generateReport(apiResults, transactionIssues, errorHandlingIssues);
    
    // 返回检查结果
    return {
      sessionId: this.sessionId,
      logFile: this.logFile,
      ...report
    };
  }
}

// 运行检查
if (require.main === module) {
  const checker = new AutoDevChecker();
  checker.run().then(result => {
    if (result.totalIssues > 0) {
      console.log(`\n⚠️  发现 ${result.totalIssues} 个问题，请查看日志: ${result.logFile}`);
      process.exit(1);
    } else {
      console.log('\n✅ 自动检查完成，项目状态良好');
      process.exit(0);
    }
  }).catch(error => {
    console.error('自动检查过程中出错:', error);
    process.exit(1);
  });
}

module.exports = AutoDevChecker;
