#!/usr/bin/env node

/**
 * 自动开发运行器
 * 在Chat开发时自动运行检查
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class AutoDevRunner {
  constructor() {
    this.sessionId = this.generateSessionId();
    this.logFile = `logs/auto-runner-${this.sessionId}.log`;
    this.ensureLogDir();
    this.setupAutoRunner();
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
   * 设置自动运行器
   */
  setupAutoRunner() {
    this.log('🔧 设置自动开发运行器...');
    
    // 创建自动运行配置文件
    const autoConfig = {
      "autoRunner": {
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
    
    fs.writeFileSync('auto-runner-config.json', JSON.stringify(autoConfig, null, 2));
    this.log('✅ 自动运行器配置已保存');
  }

  /**
   * 运行开发前检查
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
   * 启动自动运行器
   */
  async start() {
    this.log('🎯 启动自动开发运行器...');
    
    // 1. 运行开发前检查
    const preResult = await this.runPreChatCheck();
    
    if (!preResult.success) {
      this.log('❌ 开发前检查失败，请修复问题后重试', 'ERROR');
      return;
    }
    
    this.log('✅ 开发前检查通过，可以开始开发');
    this.log('💡 开发过程中请运行: npm run dev:during');
    this.log('💡 开发完成后请运行: npm run dev:post');
    
    return {
      sessionId: this.sessionId,
      logFile: this.logFile,
      preResult
    };
  }

  /**
   * 运行开发中检查
   */
  async runDuring() {
    return await this.runDuringChatCheck();
  }

  /**
   * 运行开发后检查
   */
  async runPost() {
    return await this.runPostChatCheck();
  }
}

// 运行自动运行器
if (require.main === module) {
  const runner = new AutoDevRunner();
  runner.start().catch(console.error);
}

module.exports = AutoDevRunner;
