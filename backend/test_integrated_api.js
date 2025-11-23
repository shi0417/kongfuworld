// 测试集成后的任务管理系统API
const fetch = require('node-fetch');

const BASE_URL = 'http://localhost:5000/api';

async function testIntegratedAPI() {
  console.log('🧪 开始测试集成后的任务管理系统API...\n');
  
  const userId = 1; // 测试用户ID
  
  try {
    // 1. 测试获取用户任务列表（自动初始化）
    console.log('1️⃣ 测试获取用户任务列表...');
    const missionsResponse = await fetch(`${BASE_URL}/mission-v2/user/${userId}`);
    const missionsData = await missionsResponse.json();
    
    if (missionsData.success) {
      console.log('✅ 任务列表获取成功');
      console.log(`   任务数量: ${missionsData.data.missions.length}`);
      console.log(`   用户任务状态: ${missionsData.data.userMissionStatus}`);
      console.log(`   所有任务完成: ${missionsData.data.allTasksCompleted}`);
      console.log(`   完成消息: ${missionsData.data.completionMessage}`);
      
      // 显示任务详情
      missionsData.data.missions.forEach((mission, index) => {
        console.log(`   ${index + 1}. ${mission.title}: ${mission.currentProgress}/${mission.targetValue} (${mission.progressPercentage}%)`);
      });
    } else {
      console.log('❌ 任务列表获取失败:', missionsData.message);
      return;
    }
    
    // 2. 测试任务进度更新
    console.log('\n2️⃣ 测试任务进度更新...');
    
    // 模拟阅读章节任务
    const readProgressResponse = await fetch(`${BASE_URL}/mission-v2/progress`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: userId,
        missionKey: 'read_2_chapters',
        progressValue: 1
      })
    });
    
    const readProgressData = await readProgressResponse.json();
    console.log('阅读任务进度更新结果:', JSON.stringify(readProgressData, null, 2));
    
    // 模拟签到任务
    const checkinProgressResponse = await fetch(`${BASE_URL}/mission-v2/progress`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: userId,
        missionKey: 'daily_checkin',
        progressValue: 1
      })
    });
    
    const checkinProgressData = await checkinProgressResponse.json();
    console.log('签到任务进度更新结果:', JSON.stringify(checkinProgressData, null, 2));
    
    // 3. 测试任务完成状态检查
    console.log('\n3️⃣ 测试任务完成状态检查...');
    const completionResponse = await fetch(`${BASE_URL}/mission-v2/completion/${userId}`);
    const completionData = await completionResponse.json();
    console.log('任务完成状态:', JSON.stringify(completionData, null, 2));
    
    // 4. 再次获取任务列表查看更新结果
    console.log('\n4️⃣ 再次获取任务列表查看更新结果...');
    const updatedMissionsResponse = await fetch(`${BASE_URL}/mission-v2/user/${userId}`);
    const updatedMissionsData = await updatedMissionsResponse.json();
    
    if (updatedMissionsData.success) {
      console.log('✅ 更新后的任务列表:');
      updatedMissionsData.data.missions.forEach((mission, index) => {
        console.log(`   ${index + 1}. ${mission.title}: ${mission.currentProgress}/${mission.targetValue} (${mission.progressPercentage}%) - ${mission.isCompleted ? '已完成' : '进行中'}`);
      });
    }
    
    console.log('\n✅ 集成API测试完成！');
    
  } catch (error) {
    console.error('❌ 测试失败:', error);
  }
}

// 检查服务器是否运行
async function checkServer() {
  try {
    const response = await fetch(`${BASE_URL}/`);
    if (response.ok) {
      console.log('✅ 服务器运行正常');
      return true;
    } else {
      console.log('❌ 服务器响应异常');
      return false;
    }
  } catch (error) {
    console.log('❌ 无法连接到服务器，请确保后端服务器正在运行');
    console.log('   启动命令: cd backend && npm start');
    return false;
  }
}

async function main() {
  console.log('🔍 检查服务器状态...');
  const serverRunning = await checkServer();
  
  if (serverRunning) {
    await testIntegratedAPI();
  } else {
    console.log('\n请先启动后端服务器，然后重新运行测试');
  }
}

main();
