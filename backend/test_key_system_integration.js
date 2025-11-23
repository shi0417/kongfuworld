// 测试Key系统集成
const axios = require('axios');

const BASE_URL = 'http://localhost:5000';

async function testKeySystemIntegration() {
  console.log('\n🔑 测试Key系统集成\n');
  
  try {
    // 1. 测试签到API
    console.log('📝 测试签到API:');
    try {
      const checkinResponse = await axios.post(`${BASE_URL}/api/checkin/1`, {
        timezone: 'Asia/Shanghai'
      });
      console.log(`   ✅ 签到成功: ${JSON.stringify(checkinResponse.data)}`);
    } catch (error) {
      console.log(`   ❌ 签到失败: ${error.response?.data?.message || error.message}`);
    }
    
    // 2. 测试任务API
    console.log('\n📝 测试任务API:');
    try {
      const missionResponse = await axios.get(`${BASE_URL}/api/mission-v2/user/1`);
      console.log(`   ✅ 获取任务列表成功: ${missionResponse.data.data?.length || 0}个任务`);
      
      // 如果有完成的任务，尝试领取奖励
      const missions = missionResponse.data.data || [];
      const completedMission = missions.find(m => m.isCompleted && !m.isClaimed);
      if (completedMission) {
        console.log(`   📋 尝试领取任务奖励: ${completedMission.title}`);
        const claimResponse = await axios.post(`${BASE_URL}/api/mission/claim/1/${completedMission.id}`);
        console.log(`   ✅ 任务奖励领取成功: ${JSON.stringify(claimResponse.data)}`);
      } else {
        console.log(`   ℹ️  没有可领取的任务奖励`);
      }
    } catch (error) {
      console.log(`   ❌ 任务API失败: ${error.response?.data?.message || error.message}`);
    }
    
    // 3. 测试章节解锁API
    console.log('\n📝 测试章节解锁API:');
    try {
      // 先获取章节解锁状态
      const statusResponse = await axios.get(`${BASE_URL}/api/chapter-unlock/status/1/100`);
      console.log(`   ✅ 获取章节状态成功: ${JSON.stringify(statusResponse.data.data)}`);
      
      // 如果章节未解锁且用户有足够Key，尝试解锁
      const status = statusResponse.data.data;
      if (!status.isUnlocked && status.canUnlockWithKey) {
        console.log(`   🔓 尝试解锁章节: 需要${status.keyCost}个Key，用户有${status.userKeyBalance}个`);
        const unlockResponse = await axios.post(`${BASE_URL}/api/chapter-unlock/unlock-with-key/1/100`);
        console.log(`   ✅ 章节解锁成功: ${JSON.stringify(unlockResponse.data)}`);
      } else if (status.isUnlocked) {
        console.log(`   ℹ️  章节已经解锁`);
      } else if (!status.canUnlockWithKey) {
        console.log(`   ℹ️  用户Key余额不足，无法解锁`);
      }
    } catch (error) {
      console.log(`   ❌ 章节解锁API失败: ${error.response?.data?.message || error.message}`);
    }
    
    // 4. 测试用户信息API
    console.log('\n📝 测试用户信息API:');
    try {
      const userResponse = await axios.get(`${BASE_URL}/api/user/1`);
      console.log(`   ✅ 获取用户信息成功: points=${userResponse.data.data?.points}, golden_karma=${userResponse.data.data?.golden_karma}`);
    } catch (error) {
      console.log(`   ❌ 用户信息API失败: ${error.response?.data?.message || error.message}`);
    }
    
    // 5. 测试解锁记录API
    console.log('\n📝 测试解锁记录API:');
    try {
      const historyResponse = await axios.get(`${BASE_URL}/api/chapter-unlock/unlock-history/1?limit=5`);
      console.log(`   ✅ 获取解锁记录成功: ${historyResponse.data.data?.unlocks?.length || 0}条记录`);
    } catch (error) {
      console.log(`   ❌ 解锁记录API失败: ${error.response?.data?.message || error.message}`);
    }
    
    console.log('\n✅ Key系统集成测试完成');
    
  } catch (error) {
    console.error('测试失败:', error.message);
  }
}

// 运行测试
testKeySystemIntegration();
