#!/usr/bin/env node

/**
 * 自动开发钩子脚本
 * 在Chat开发的不同阶段自动运行检查
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class AutoDevHooks {
  constructor() {
    this.sessionId = this.generateSessionId();
    this.logFile = `logs/auto-hooks-${this.sessionId}.log`;
    this.ensureLogDir();
    this.setupHooks();
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
   * 设置自动钩子
   */
  setupHooks() {
    this.log('🔧 设置自动开发钩子...');
    
    // 创建钩子配置文件
    const hooksConfig = {
      preChat: {
        command: 'npm run auto:check',
        description: 'Chat开发前自动检查',
        enabled: true
      },
      duringChat: {
        command: 'npm run check:pre-commit',
        description: '开发过程中自动检查',
        enabled: true,
        trigger: 'file-change'
      },
      postChat: {
        command: 'npm run check:all',
        description: '开发完成后自动检查',
        enabled: true
      }
    };
    
    // 保存钩子配置
    fs.writeFileSync('hooks-config.json', JSON.stringify(hooksConfig, null, 2));
    this.log('✅ 钩子配置已保存到 hooks-config.json');
  }

  /**
   * 运行预开发检查
   */
  async runPreChatCheck() {
    this.log('🚀 运行Chat开发前自动检查...');
    
    try {
      const output = execSync('npm run auto:check', { encoding: 'utf8' });
      this.log('✅ 开发前检查完成');
      this.log(`📊 检查结果:\n${output}`);
      return { success: true, output };
    } catch (error) {
      this.log(`❌ 开发前检查失败: ${error.message}`, 'ERROR');
      return { success: false, error: error.message };
    }
  }

  /**
   * 运行开发中检查
   */
  async runDuringChatCheck() {
    this.log('🔍 运行开发过程中自动检查...');
    
    try {
      const output = execSync('npm run check:pre-commit', { encoding: 'utf8' });
      this.log('✅ 开发中检查完成');
      this.log(`📊 检查结果:\n${output}`);
      return { success: true, output };
    } catch (error) {
      this.log(`❌ 开发中检查失败: ${error.message}`, 'ERROR');
      return { success: false, error: error.message };
    }
  }

  /**
   * 运行开发后检查
   */
  async runPostChatCheck() {
    this.log('🏁 运行开发完成后自动检查...');
    
    try {
      const output = execSync('npm run check:all', { encoding: 'utf8' });
      this.log('✅ 开发后检查完成');
      this.log(`📊 检查结果:\n${output}`);
      return { success: true, output };
    } catch (error) {
      this.log(`❌ 开发后检查失败: ${error.message}`, 'ERROR');
      return { success: false, error: error.message };
    }
  }

  /**
   * 监听文件变化
   */
  setupFileWatcher() {
    this.log('👀 设置文件变化监听...');
    
    const chokidar = require('chokidar');
    
    const watcher = chokidar.watch([
      'backend/routes/**/*.js',
      'frontend/src/**/*.tsx',
      'frontend/src/**/*.ts'
    ], {
      ignored: /node_modules/,
      persistent: true
    });
    
    let timeout;
    watcher.on('change', (path) => {
      this.log(`📝 文件变化: ${path}`);
      
      // 防抖处理，避免频繁触发
      clearTimeout(timeout);
      timeout = setTimeout(async () => {
        await this.runDuringChatCheck();
      }, 1000);
    });
    
    this.log('✅ 文件变化监听已启动');
    return watcher;
  }

  /**
   * 启动自动钩子
   */
  async start() {
    this.log('🎯 启动自动开发钩子...');
    
    // 1. 运行开发前检查
    await this.runPreChatCheck();
    
    // 2. 设置文件变化监听
    const watcher = this.setupFileWatcher();
    
    // 3. 设置退出处理
    process.on('SIGINT', async () => {
      this.log('🛑 收到退出信号，运行开发后检查...');
      await this.runPostChatCheck();
      watcher.close();
      process.exit(0);
    });
    
    this.log('✅ 自动钩子已启动，开始监听文件变化...');
    this.log('💡 按 Ctrl+C 退出并运行开发后检查');
  }
}

// 运行自动钩子
if (require.main === module) {
  const hooks = new AutoDevHooks();
  hooks.start().catch(console.error);
}

module.exports = AutoDevHooks;
