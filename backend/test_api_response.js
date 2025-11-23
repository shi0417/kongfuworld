const fetch = require('node-fetch');

async function testAPI() {
  try {
    console.log('🔍 测试章节解锁状态API...');
    const response = await fetch('http://localhost:5000/api/chapter-unlock/status/1362/1');
    const data = await response.json();
    console.log('📊 API响应:', JSON.stringify(data, null, 2));
    
    if (data.success && data.data.timeUnlock) {
      console.log('✅ 找到timeUnlock信息:');
      console.log('  - status:', data.data.timeUnlock.status);
      console.log('  - unlockAt:', data.data.timeUnlock.unlockAt);
      console.log('  - firstClickedAt:', data.data.timeUnlock.firstClickedAt);
      console.log('  - timeRemaining:', data.data.timeUnlock.timeRemaining);
      console.log('  - countdown:', data.data.timeUnlock.countdown);
    } else {
      console.log('❌ 没有找到timeUnlock信息');
      console.log('📊 完整响应数据:', data);
    }
  } catch (error) {
    console.error('❌ 测试失败:', error.message);
  }
}

testAPI();