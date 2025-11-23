// 测试时间追踪API
const http = require('http');
const { URL } = require('url');

const BASE_URL = 'http://localhost:5000';

// HTTP请求辅助函数
function makeRequest(path, method = 'GET', data = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method: method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          const result = JSON.parse(body);
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });
    });

    req.on('error', reject);

    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

async function testTimingAPI() {
  try {
    console.log('🧪 测试时间追踪API\n');
    
    // 1. 测试更新阅读时间API
    console.log('1️⃣ 测试更新阅读时间API:');
    const testData = {
      recordId: 527, // 使用最新的记录ID
      enterTime: new Date('2025-10-21T18:23:52').toISOString(),
      exitTime: new Date('2025-10-21T18:28:52').toISOString(), // 5分钟后
      duration: 300 // 5分钟
    };
    
    console.log('📝 测试数据:', testData);
    
    const response = await makeRequest('/api/reading-timing/update-timing', 'POST', testData);
    const result = response;
    
    if (result.success) {
      console.log('✅ API调用成功:', result);
    } else {
      console.log('❌ API调用失败:', result);
    }
    
    // 2. 测试心跳检测API
    console.log('\n2️⃣ 测试心跳检测API:');
    const heartbeatData = {
      recordId: 527,
      currentDuration: 180 // 3分钟
    };
    
    const heartbeatResult = await makeRequest('/api/reading-timing/heartbeat', 'POST', heartbeatData);
    
    if (heartbeatResult.success) {
      console.log('✅ 心跳API调用成功:', heartbeatResult);
    } else {
      console.log('❌ 心跳API调用失败:', heartbeatResult);
    }
    
    // 3. 检查数据库更新结果
    console.log('\n3️⃣ 检查数据库更新结果:');
    const mysql = require('mysql2/promise');
    const dbConfig = {
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '123456',
      database: process.env.DB_NAME || 'kongfuworld',
      charset: 'utf8mb4'
    };
    
    const db = await mysql.createConnection(dbConfig);
    const [records] = await db.execute(`
      SELECT id, page_enter_time, page_exit_time, stay_duration 
      FROM reading_log 
      WHERE id = 527
    `);
    
    console.log('📊 数据库记录更新结果:');
    records.forEach(record => {
      console.log(`  ID:${record.id}`);
      console.log(`  进入时间: ${record.page_enter_time}`);
      console.log(`  离开时间: ${record.page_exit_time}`);
      console.log(`  停留时长: ${record.stay_duration} 秒`);
    });
    
    await db.end();
    
  } catch (error) {
    console.error('测试失败:', error.message);
    console.log('💡 请确保后端服务正在运行 (npm start)');
  }
}

testTimingAPI();
