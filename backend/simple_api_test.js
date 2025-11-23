// 简单测试API
const fetch = require('node-fetch');

async function testAPI() {
  try {
    console.log('测试API...');
    
    const response = await fetch('http://localhost:5000/api/user/1/notifications?page=1&type=all&limit=10');
    const data = await response.json();
    
    console.log('响应状态:', response.status);
    console.log('响应数据:', data);
    
  } catch (error) {
    console.error('API测试失败:', error.message);
  }
}

testAPI();