// 测试简化的时间追踪API
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

async function testSimpleTiming() {
  try {
    console.log('🧪 测试简化的时间追踪API\n');
    
    // 测试更新离开时间API
    console.log('1️⃣ 测试更新离开时间API:');
    const testData = {
      recordId: 527, // 使用现有的记录ID
      exitTime: new Date().toISOString()
    };
    
    console.log('📝 测试数据:', testData);
    
    const result = await makeRequest('/api/reading-timing/update-exit-time', 'POST', testData);
    
    if (result.success) {
      console.log('✅ API调用成功:', result);
    } else {
      console.log('❌ API调用失败:', result);
    }
    
    // 检查数据库更新结果
    console.log('\n2️⃣ 检查数据库更新结果:');
    const mysql = require('mysql2/promise');
    const dbConfig = {
      host: 'localhost',
      user: 'root',
      password: '123456',
      database: 'kongfuworld'
    };

    const db = await mysql.createConnection(dbConfig);
    const [rows] = await db.execute(`
      SELECT id, page_enter_time, page_exit_time, stay_duration
      FROM reading_log 
      WHERE id = ?
    `, [527]);

    if (rows.length > 0) {
      const record = rows[0];
      console.log('📊 数据库记录更新结果:');
      console.log(`  ID: ${record.id}`);
      console.log(`  进入时间: ${record.page_enter_time}`);
      console.log(`  离开时间: ${record.page_exit_time}`);
      console.log(`  停留时长: ${record.stay_duration} 秒`);
    } else {
      console.log('❌ 未找到记录');
    }

    await db.end();
    
  } catch (error) {
    console.error('测试失败:', error.message);
    console.log('\n💡 请确保后端服务正在运行 (npm start)');
  }
}

testSimpleTiming();
