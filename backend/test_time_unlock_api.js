// 测试时间解锁API

async function testTimeUnlockAPI() {
  try {
    console.log('🔧 测试时间解锁API\n');
    
    // 1. 测试启动时间解锁
    console.log('1. 测试启动时间解锁...');
    const startResponse = await fetch('http://localhost:5000/api/chapter-unlock/start-time-unlock/1362/1', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    const startData = await startResponse.json();
    console.log('启动时间解锁响应:', startData);
    
    if (startData.success) {
      console.log('✅ 时间解锁启动成功');
      console.log(`解锁时间: ${startData.data.unlockAt}`);
      console.log(`剩余时间: ${Math.floor(startData.data.timeRemaining / (1000 * 60 * 60))}小时`);
    } else {
      console.log('❌ 时间解锁启动失败:', startData.message);
    }
    
    // 2. 测试获取解锁状态
    console.log('\n2. 测试获取解锁状态...');
    const statusResponse = await fetch('http://localhost:5000/api/chapter-unlock/status/1362/1');
    const statusData = await statusResponse.json();
    console.log('解锁状态响应:', statusData);
    
    if (statusData.success && statusData.data.timeUnlock) {
      console.log('✅ 时间解锁信息获取成功');
      console.log(`解锁方法: ${statusData.data.unlockMethod}`);
      console.log(`是否解锁: ${statusData.data.isUnlocked}`);
      console.log(`时间解锁状态: ${statusData.data.timeUnlock.status}`);
      console.log(`解锁时间: ${statusData.data.timeUnlock.unlockAt}`);
      console.log(`倒计时: ${statusData.data.timeUnlock.countdown.formatted}`);
    } else {
      console.log('❌ 时间解锁信息获取失败');
    }
    
  } catch (error) {
    console.error('测试失败:', error.message);
  }
}

// 运行测试
testTimeUnlockAPI();
