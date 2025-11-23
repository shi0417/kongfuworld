// 测试前端API连接
const fetch = require('node-fetch');

async function testFrontendAPIConnection() {
  try {
    console.log('🧪 测试前端API连接...\n');
    
    // 测试章节解锁API
    console.log('1. 测试章节解锁API:');
    const response = await fetch('http://localhost:5000/api/chapter-unlock/status/844/1');
    
    console.log('📡 响应状态:', response.status);
    console.log('📡 响应头:', response.headers.get('content-type'));
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ API调用成功');
      console.log('📊 返回数据:', JSON.stringify(data, null, 2));
    } else {
      console.log('❌ API调用失败:', response.status, response.statusText);
      const errorText = await response.text();
      console.log('❌ 错误信息:', errorText);
    }
    
  } catch (error) {
    console.error('❌ 连接失败:', error.message);
  }
}

// 开始测试
testFrontendAPIConnection();
