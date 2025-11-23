// 测试时间追踪API
const fetch = require('node-fetch');

const BASE_URL = 'http://localhost:5000';

async function testTimingAPI() {
  try {
    console.log('🧪 测试时间追踪API\n');
    
    // 测试更新阅读时间API
    const testData = {
      userId: 1000,
      chapterId: 841,
      enterTime: new Date().toISOString(),
      exitTime: new Date(Date.now() + 300000).toISOString(), // 5分钟后
      duration: 300 // 5分钟
    };
    
    console.log('📝 测试数据:', testData);
    
    const response = await fetch(`${BASE_URL}/api/reading-timing/update-timing`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(testData)
    });
    
    const result = await response.json();
    
    if (response.ok) {
      console.log('✅ API调用成功:', result);
    } else {
      console.log('❌ API调用失败:', result);
    }
    
  } catch (error) {
    console.error('测试失败:', error.message);
    console.log('💡 请确保后端服务正在运行 (npm start)');
  }
}

testTimingAPI();
