// 测试章节解锁API
const axios = require('axios');

const BASE_URL = 'http://localhost:5000';

async function testChapterUnlockAPI() {
  console.log('\n🔓 测试章节解锁API\n');
  
  try {
    // 1. 测试获取章节解锁状态
    console.log('📝 测试获取章节解锁状态:');
    try {
      const statusResponse = await axios.get(`${BASE_URL}/api/chapter-unlock/status/1361/1`);
      console.log(`   ✅ 获取状态成功:`);
      console.log(`      章节ID: ${statusResponse.data.data?.chapterId}`);
      console.log(`      小说标题: ${statusResponse.data.data?.novelTitle}`);
      console.log(`      章节号: ${statusResponse.data.data?.chapterNumber}`);
      console.log(`      是否付费: ${statusResponse.data.data?.isPremium}`);
      console.log(`      Key消耗: ${statusResponse.data.data?.keyCost}`);
      console.log(`      是否已解锁: ${statusResponse.data.data?.isUnlocked}`);
      console.log(`      解锁方法: ${statusResponse.data.data?.unlockMethod}`);
      console.log(`      用户Key余额: ${statusResponse.data.data?.userKeyBalance}`);
      console.log(`      是否可用Key解锁: ${statusResponse.data.data?.canUnlockWithKey}`);
      console.log(`      是否有Champion会员: ${statusResponse.data.data?.hasChampionSubscription}`);
    } catch (error) {
      console.log(`   ❌ 获取状态失败: ${error.response?.data?.message || error.message}`);
    }
    
    // 2. 测试获取解锁记录
    console.log('\n📝 测试获取解锁记录:');
    try {
      const historyResponse = await axios.get(`${BASE_URL}/api/chapter-unlock/unlock-history/1?limit=5`);
      console.log(`   ✅ 获取记录成功: ${historyResponse.data.data?.unlocks?.length || 0}条记录`);
      if (historyResponse.data.data?.unlocks?.length > 0) {
        historyResponse.data.data.unlocks.forEach((unlock, index) => {
          console.log(`      ${index + 1}. ${unlock.novel_title} 第${unlock.chapter_number}章 - ${unlock.unlock_method} - ${unlock.unlocked_at}`);
        });
      }
    } catch (error) {
      console.log(`   ❌ 获取记录失败: ${error.response?.data?.message || error.message}`);
    }
    
    // 3. 测试用户信息API
    console.log('\n📝 测试用户信息API:');
    try {
      const userResponse = await axios.get(`${BASE_URL}/api/user/1`);
      console.log(`   ✅ 获取用户信息成功:`);
      console.log(`      用户ID: ${userResponse.data.data?.id}`);
      console.log(`      用户名: ${userResponse.data.data?.username}`);
      console.log(`      Key余额: ${userResponse.data.data?.points}`);
      console.log(`      金色Karma: ${userResponse.data.data?.golden_karma}`);
    } catch (error) {
      console.log(`   ❌ 获取用户信息失败: ${error.response?.data?.message || error.message}`);
    }
    
    console.log('\n✅ 章节解锁API测试完成');
    
  } catch (error) {
    console.error('测试失败:', error.message);
  }
}

// 运行测试
testChapterUnlockAPI();