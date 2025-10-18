#!/usr/bin/env node

/**
 * API端点一致性检查脚本
 * 用于检查前端、后端、文档中的API端点是否一致
 */

const fs = require('fs');
const path = require('path');

// 配置
const CONFIG = {
  // 要检查的目录
  directories: {
    frontend: './frontend/src',
    backend: './backend/routes',
    docs: './',
    tests: './backend'
  },
  
  // API端点模式
  apiPatterns: [
    /\/api\/[^\/]+\/[^\/]+/g,
    /fetch\(['"`]([^'"`]+)['"`]/g,
    /router\.(get|post|put|delete)\(['"`]([^'"`]+)['"`]/g
  ],
  
  // 需要检查的关键API端点
  criticalEndpoints: [
    'unlock-with-karma',
    'unlock-with-key', 
    'buy-with-karma',
    'purchase-karma',
    'chapter-unlock'
  ]
};

class APIConsistencyChecker {
  constructor() {
    this.endpoints = new Map();
    this.inconsistencies = [];
  }

  /**
   * 扫描目录中的API端点
   */
  scanDirectory(dirPath, fileType) {
    if (!fs.existsSync(dirPath)) {
      console.log(`⚠️  目录不存在: ${dirPath}`);
      return;
    }

    const files = this.getAllFiles(dirPath);
    
    files.forEach(file => {
      if (this.shouldCheckFile(file, fileType)) {
        this.extractEndpointsFromFile(file, fileType);
      }
    });
  }

  /**
   * 获取目录下所有文件
   */
  getAllFiles(dirPath) {
    const files = [];
    
    const scanDir = (currentPath) => {
      const items = fs.readdirSync(currentPath);
      
      items.forEach(item => {
        const fullPath = path.join(currentPath, item);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory() && !item.startsWith('.') && item !== 'node_modules') {
          scanDir(fullPath);
        } else if (stat.isFile()) {
          files.push(fullPath);
        }
      });
    };
    
    scanDir(dirPath);
    return files;
  }

  /**
   * 判断是否应该检查该文件
   */
  shouldCheckFile(filePath, fileType) {
    const ext = path.extname(filePath);
    
    switch (fileType) {
      case 'frontend':
        return ['.tsx', '.ts', '.js', '.jsx'].includes(ext);
      case 'backend':
        return ['.js'].includes(ext) && filePath.includes('routes');
      case 'docs':
        return ['.md'].includes(ext);
      case 'tests':
        return ['.js'].includes(ext) && filePath.includes('test');
      default:
        return false;
    }
  }

  /**
   * 从文件中提取API端点
   */
  extractEndpointsFromFile(filePath, fileType) {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      
      // 提取API端点
      const endpoints = this.findEndpoints(content);
      
      endpoints.forEach(endpoint => {
        if (!this.endpoints.has(endpoint)) {
          this.endpoints.set(endpoint, []);
        }
        this.endpoints.get(endpoint).push({
          file: filePath,
          type: fileType
        });
      });
      
    } catch (error) {
      console.log(`❌ 读取文件失败: ${filePath} - ${error.message}`);
    }
  }

  /**
   * 在内容中查找API端点
   */
  findEndpoints(content) {
    const endpoints = [];
    
    // 查找fetch调用
    const fetchMatches = content.match(/fetch\(['"`]([^'"`]+)['"`]/g);
    if (fetchMatches) {
      fetchMatches.forEach(match => {
        const url = match.match(/fetch\(['"`]([^'"`]+)['"`]/)[1];
        if (url.includes('/api/')) {
          endpoints.push(url);
        }
      });
    }
    
    // 查找路由定义
    const routeMatches = content.match(/router\.(get|post|put|delete)\(['"`]([^'"`]+)['"`]/g);
    if (routeMatches) {
      routeMatches.forEach(match => {
        const route = match.match(/router\.(get|post|put|delete)\(['"`]([^'"`]+)['"`]/)[2];
        endpoints.push(route);
      });
    }
    
    // 查找API文档中的端点
    const docMatches = content.match(/POST\s+\/api\/[^\s]+/g);
    if (docMatches) {
      docMatches.forEach(match => {
        const endpoint = match.replace(/POST\s+/, '');
        endpoints.push(endpoint);
      });
    }
    
    return endpoints;
  }

  /**
   * 检查一致性
   */
  checkConsistency() {
    console.log('\n🔍 检查API端点一致性...\n');
    
    // 检查关键端点
    CONFIG.criticalEndpoints.forEach(criticalEndpoint => {
      const relatedEndpoints = Array.from(this.endpoints.keys())
        .filter(endpoint => endpoint.includes(criticalEndpoint));
      
      if (relatedEndpoints.length > 1) {
        console.log(`⚠️  发现不一致的端点: ${criticalEndpoint}`);
        relatedEndpoints.forEach(endpoint => {
          const locations = this.endpoints.get(endpoint);
          console.log(`   ${endpoint}:`);
          locations.forEach(loc => {
            console.log(`     - ${loc.type}: ${loc.file}`);
          });
        });
        console.log('');
      }
    });
    
    // 检查未使用的端点
    this.endpoints.forEach((locations, endpoint) => {
      const types = [...new Set(locations.map(loc => loc.type))];
      if (types.length === 1) {
        console.log(`⚠️  端点可能未完整实现: ${endpoint}`);
        console.log(`   只在 ${types[0]} 中找到`);
        console.log('');
      }
    });
  }

  /**
   * 生成报告
   */
  generateReport() {
    console.log('\n📊 API端点一致性报告\n');
    console.log('='.repeat(50));
    
    console.log(`\n📈 统计信息:`);
    console.log(`   总端点数量: ${this.endpoints.size}`);
    
    const typeStats = {};
    this.endpoints.forEach((locations) => {
      locations.forEach(loc => {
        typeStats[loc.type] = (typeStats[loc.type] || 0) + 1;
      });
    });
    
    console.log(`   按类型分布:`);
    Object.entries(typeStats).forEach(([type, count]) => {
      console.log(`     ${type}: ${count} 个引用`);
    });
    
    console.log(`\n🔍 关键端点检查:`);
    CONFIG.criticalEndpoints.forEach(endpoint => {
      const found = Array.from(this.endpoints.keys())
        .some(ep => ep.includes(endpoint));
      console.log(`   ${found ? '✅' : '❌'} ${endpoint}`);
    });
    
    console.log('\n' + '='.repeat(50));
  }

  /**
   * 运行检查
   */
  async run() {
    console.log('🚀 开始API端点一致性检查...\n');
    
    // 扫描各个目录
    Object.entries(CONFIG.directories).forEach(([type, dirPath]) => {
      console.log(`📁 扫描 ${type} 目录: ${dirPath}`);
      this.scanDirectory(dirPath, type);
    });
    
    // 检查一致性
    this.checkConsistency();
    
    // 生成报告
    this.generateReport();
    
    console.log('\n✅ 检查完成！');
  }
}

// 运行检查
if (require.main === module) {
  const checker = new APIConsistencyChecker();
  checker.run().catch(console.error);
}

module.exports = APIConsistencyChecker;
