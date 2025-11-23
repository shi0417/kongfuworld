#!/usr/bin/env node

/**
 * 简单自动运行器
 * 在Chat开发时自动运行检查
 */

const fs = require('fs');
const path = require('path');

class SimpleAutoRunner {
  constructor() {
    this.sessionId = this.generateSessionId();
    this.logFile = `logs/simple-auto-${this.sessionId}.log`;
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
   * 检查API端点一致性
   */
  checkAPIConsistency() {
    this.log('🔍 检查API端点一致性...');
    
    const criticalEndpoints = [
      'unlock-with-karma',
      'unlock-with-key',
      'buy-with-karma',
      'chapter-unlock'
    ];
    
    const results = {};
    
    criticalEndpoints.forEach(endpoint => {
      try {
        // 搜索前端文件
        const frontendFiles = this.searchInDirectory('frontend/src', endpoint);
        // 搜索后端文件
        const backendFiles = this.searchInDirectory('backend/routes', endpoint);
        // 搜索文档文件
        const docFiles = this.searchInDirectory('.', endpoint, ['.md']);
        
        results[endpoint] = {
          frontend: frontendFiles,
          backend: backendFiles,
          docs: docFiles,
          total: frontendFiles.length + backendFiles.length + docFiles.length
        };
        
        this.log(`   📊 ${endpoint}: 前端${frontendFiles.length}个, 后端${backendFiles.length}个, 文档${docFiles.length}个`);
        
        // 检查一致性
        if (frontendFiles.length > 0 && backendFiles.length === 0) {
          this.log(`   ⚠️  ${endpoint}: 前端有引用但后端可能缺失`);
        } else if (backendFiles.length > 0 && frontendFiles.length === 0) {
          this.log(`   ⚠️  ${endpoint}: 后端有引用但前端可能缺失`);
        } else if (frontendFiles.length > 0 && backendFiles.length > 0) {
          this.log(`   ✅ ${endpoint}: 前后端都有引用`);
        }
        
      } catch (error) {
        this.log(`   ❌ ${endpoint}: 检查失败 - ${error.message}`, 'ERROR');
      }
    });
    
    return results;
  }

  /**
   * 在目录中搜索内容
   */
  searchInDirectory(dirPath, searchTerm, extensions = ['.js', '.tsx', '.ts', '.md']) {
    const results = [];
    
    if (!fs.existsSync(dirPath)) {
      return results;
    }
    
    try {
      const files = this.getAllFiles(dirPath, extensions);
      
      files.forEach(file => {
        try {
          const content = fs.readFileSync(file, 'utf8');
          if (content.includes(searchTerm)) {
            results.push(file);
          }
        } catch (error) {
          // 忽略读取错误
        }
      });
    } catch (error) {
      this.log(`❌ 搜索目录失败: ${dirPath} - ${error.message}`, 'ERROR');
    }
    
    return results;
  }

  /**
   * 获取目录下所有文件
   */
  getAllFiles(dirPath, extensions) {
    const files = [];
    
    try {
      const items = fs.readdirSync(dirPath);
      
      items.forEach(item => {
        const fullPath = path.join(dirPath, item);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory() && !item.startsWith('.') && item !== 'node_modules') {
          files.push(...this.getAllFiles(fullPath, extensions));
        } else if (stat.isFile()) {
          const ext = path.extname(item);
          if (extensions.includes(ext)) {
            files.push(fullPath);
          }
        }
      });
    } catch (error) {
      // 忽略目录访问错误
    }
    
    return files;
  }

  /**
   * 检查数据库事务使用
   */
  checkDatabaseTransactions() {
    this.log('🔍 检查数据库事务使用...');
    
    const routeFiles = this.getAllFiles('backend/routes', ['.js']);
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
  }

  /**
   * 检查错误处理
   */
  checkErrorHandling() {
    this.log('🔍 检查错误处理...');
    
    const routeFiles = this.getAllFiles('backend/routes', ['.js']);
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
  }

  /**
   * 检查数据库连接方式一致性 ⚠️ 新增
   */
  checkDatabaseConnectionConsistency() {
    this.log('🔍 检查数据库连接方式一致性...');
    
    const dbFiles = [
      ...this.getAllFiles('backend', ['.js']).filter(f => 
        f.includes('daily_checkin') || 
        f.includes('key_transaction') || 
        f.includes('routes')
      )
    ];
    
    const issues = [];
    const connectionTypes = {};
    
    dbFiles.forEach(file => {
      try {
        const content = fs.readFileSync(file, 'utf8');
        
        // 检查连接方式
        const usesPromise = /require\(['"]mysql2\/promise['"]\)/.test(content);
        const usesCallback = /require\(['"]mysql2['"]\)/.test(content);
        const usesExecute = /db\.execute\(/.test(content);
        const usesQuery = /db\.query\(/.test(content);
        
        if (usesCallback && !usesPromise) {
          issues.push(`${file} - 使用回调式连接，应改为Promise式`);
          this.log(`   ❌ ${file} 使用回调式连接 (mysql2)`);
        } else if (usesPromise) {
          this.log(`   ✅ ${file} 使用Promise式连接 (mysql2/promise)`);
        }
        
        if (usesQuery && !usesExecute) {
          issues.push(`${file} - 使用db.query()，应改为db.execute()`);
          this.log(`   ❌ ${file} 使用db.query()，应改为db.execute()`);
        } else if (usesExecute) {
          this.log(`   ✅ ${file} 使用db.execute()`);
        }
        
        // 记录连接类型
        if (usesPromise) {
          connectionTypes[file] = 'promise';
        } else if (usesCallback) {
          connectionTypes[file] = 'callback';
        }
        
      } catch (error) {
        this.log(`   ❌ 读取文件失败: ${file} - ${error.message}`, 'ERROR');
      }
    });
    
    // 检查一致性
    const promiseFiles = Object.values(connectionTypes).filter(type => type === 'promise').length;
    const callbackFiles = Object.values(connectionTypes).filter(type => type === 'callback').length;
    
    if (promiseFiles > 0 && callbackFiles > 0) {
      this.log(`⚠️  发现混合使用连接方式：${promiseFiles}个Promise式，${callbackFiles}个回调式`);
    } else if (issues.length > 0) {
      this.log(`⚠️  发现 ${issues.length} 个数据库连接方式问题`);
    } else {
      this.log('✅ 数据库连接方式一致性检查通过');
    }
    
    return issues;
  }

  /**
   * 生成检查报告
   */
  generateReport(apiResults, transactionIssues, errorHandlingIssues, dbConnectionIssues) {
    this.log('\n📊 自动开发检查报告');
    this.log('='.repeat(50));
    
    // API一致性
    let apiIssues = 0;
    Object.entries(apiResults).forEach(([endpoint, result]) => {
      if (result.frontend.length > 0 && result.backend.length === 0) {
        apiIssues++;
      } else if (result.backend.length > 0 && result.frontend.length === 0) {
        apiIssues++;
      }
    });
    
    if (apiIssues > 0) {
      this.log(`\n⚠️  发现 ${apiIssues} 个API端点不一致问题`);
    } else {
      this.log('\n✅ API端点一致性检查通过');
    }
    
    // 数据库事务
    if (transactionIssues.length > 0) {
      this.log(`\n⚠️  发现 ${transactionIssues.length} 个数据库事务问题`);
    } else {
      this.log('\n✅ 数据库事务检查通过');
    }
    
    // 数据库连接方式一致性 ⚠️ 新增
    if (dbConnectionIssues.length > 0) {
      this.log(`\n⚠️  发现 ${dbConnectionIssues.length} 个数据库连接方式问题`);
      dbConnectionIssues.forEach(issue => {
        this.log(`   - ${issue}`);
      });
    } else {
      this.log('\n✅ 数据库连接方式一致性检查通过');
    }
    
    // 错误处理
    if (errorHandlingIssues.length > 0) {
      this.log(`\n⚠️  发现 ${errorHandlingIssues.length} 个错误处理问题`);
    } else {
      this.log('\n✅ 错误处理检查通过');
    }
    
    // 总结
    const totalIssues = apiIssues + transactionIssues.length + errorHandlingIssues.length + dbConnectionIssues.length;
    
    if (totalIssues === 0) {
      this.log('\n🎉 所有检查通过！项目状态良好');
    } else {
      this.log(`\n⚠️  发现 ${totalIssues} 个问题需要关注`);
    }
    
    this.log('\n' + '='.repeat(50));
    this.log(`📝 详细日志已保存到: ${this.logFile}`);
    
    return {
      totalIssues,
      apiIssues,
      transactionIssues: transactionIssues.length,
      dbConnectionIssues: dbConnectionIssues.length,
      errorHandlingIssues: errorHandlingIssues.length
    };
  }

  /**
   * 运行自动检查
   */
  async run() {
    this.log('🚀 开始自动开发检查...');
    this.log(`📅 会话ID: ${this.sessionId}`);
    
    // 运行各项检查
    const apiResults = this.checkAPIConsistency();
    const transactionIssues = this.checkDatabaseTransactions();
    const errorHandlingIssues = this.checkErrorHandling();
    const dbConnectionIssues = this.checkDatabaseConnectionConsistency(); // ⚠️ 新增
    
    // 生成报告
    const report = this.generateReport(apiResults, transactionIssues, errorHandlingIssues, dbConnectionIssues);
    
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
  const runner = new SimpleAutoRunner();
  runner.run().then(result => {
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

module.exports = SimpleAutoRunner;
