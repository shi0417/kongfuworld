// 测试新的任务管理系统
const { 
  checkAndInitializeTodayMissions, 
  checkMissionCompletion, 
  updateMissionProgress 
} = require('./mission_manager');

async function testMissionSystem() {
  console.log('🧪 开始测试新的任务管理系统...\n');
  
  const userId = 1; // 测试用户ID
  
  try {
    // 1. 测试任务初始化
    console.log('1️⃣ 测试任务初始化...');
    const initResult = await checkAndInitializeTodayMissions(userId);
    console.log('初始化结果:', JSON.stringify(initResult, null, 2));
    
    if (!initResult.success) {
      console.log('❌ 任务初始化失败');
      return;
    }
    
    // 2. 测试任务完成状态检查
    console.log('\n2️⃣ 测试任务完成状态检查...');
    const completionResult = await checkMissionCompletion(userId);
    console.log('完成状态:', JSON.stringify(completionResult, null, 2));
    
    // 3. 测试任务进度更新
    console.log('\n3️⃣ 测试任务进度更新...');
    
    // 模拟阅读章节任务
    const readResult = await updateMissionProgress(userId, 'read_2_chapters', 1);
    console.log('阅读任务更新结果:', JSON.stringify(readResult, null, 2));
    
    // 模拟签到任务
    const checkinResult = await updateMissionProgress(userId, 'daily_checkin', 1);
    console.log('签到任务更新结果:', JSON.stringify(checkinResult, null, 2));
    
    // 4. 再次检查任务完成状态
    console.log('\n4️⃣ 再次检查任务完成状态...');
    const finalCompletionResult = await checkMissionCompletion(userId);
    console.log('最终完成状态:', JSON.stringify(finalCompletionResult, null, 2));
    
    console.log('\n✅ 任务管理系统测试完成！');
    
  } catch (error) {
    console.error('❌ 测试失败:', error);
  }
}

testMissionSystem();
