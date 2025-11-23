const fetch = require('node-fetch');

async function testAPIDirect() {
  try {
    console.log('🌐 直接测试API调用...');
    
    const response = await fetch('http://localhost:5000/api/chapter-unlock/start-time-unlock/1362/1', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    
    const data = await response.json();
    console.log('📊 API响应:', JSON.stringify(data, null, 2));
    
    if (!data.success) {
      console.log('❌ API调用失败，错误信息:', data.message);
    }
    
  } catch (error) {
    console.error('❌ 测试失败:', error.message);
  }
}

testAPIDirect();