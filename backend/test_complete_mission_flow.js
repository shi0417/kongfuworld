// 测试完整的任务流程
const fetch = require('node-fetch');

const BASE_URL = 'http://localhost:5000/api';

async function testCompleteMissionFlow() {
  console.log('🧪 测试完整的任务流程...\n');
  
  const userId = 1;
  const chapterId = 1319;
  
  try {
    // 1. 测试获取用户任务列表
    console.log('1️⃣ 获取用户任务列表...');
    const missionsResponse = await fetch(`${BASE_URL}/mission-v2/user/${userId}`);
    const missionsData = await missionsResponse.json();
    
    if (missionsData.success) {
      console.log('✅ 任务列表获取成功');
      console.log(`   任务数量: ${missionsData.data.missions.length}`);
      console.log(`   用户任务状态: ${missionsData.data.userMissionStatus}`);
      console.log(`   所有任务完成: ${missionsData.data.allTasksCompleted}`);
    } else {
      console.log('❌ 任务列表获取失败:', missionsData.message);
      return;
    }
    
    // 2. 模拟阅读章节（通过API）
    console.log('\n2️⃣ 模拟阅读章节...');
    const readResponse = await fetch(`${BASE_URL}/user/${userId}/read-chapter`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chapterId: chapterId })
    });
    
    const readData = await readResponse.json();
    console.log('阅读章节结果:', JSON.stringify(readData, null, 2));
    
    if (readData.success && readData.isNewChapter) {
      console.log('✅ 章节被正确识别为新章节');
      console.log(`   原因: ${readData.reason}`);
      
      if (readData.missionResults) {
        console.log('   任务更新结果:');
        readData.missionResults.forEach((result, index) => {
          console.log(`     ${index + 1}. ${result.missionKey}: ${result.success ? '成功' : '失败'} - ${result.message}`);
        });
      }
    } else {
      console.log('❌ 章节没有被识别为新章节');
      console.log(`   原因: ${readData.reason || '未知'}`);
    }
    
    // 3. 再次获取任务列表查看更新结果
    console.log('\n3️⃣ 再次获取任务列表查看更新结果...');
    const updatedMissionsResponse = await fetch(`${BASE_URL}/mission-v2/user/${userId}`);
    const updatedMissionsData = await updatedMissionsResponse.json();
    
    if (updatedMissionsData.success) {
      console.log('✅ 更新后的任务列表:');
      updatedMissionsData.data.missions.forEach((mission, index) => {
        console.log(`   ${index + 1}. ${mission.title}: ${mission.currentProgress}/${mission.targetValue} (${mission.progressPercentage}%) - ${mission.isCompleted ? '已完成' : '进行中'}`);
      });
    }
    
    // 4. 检查任务完成状态
    console.log('\n4️⃣ 检查任务完成状态...');
    const completionResponse = await fetch(`${BASE_URL}/mission-v2/completion/${userId}`);
    const completionData = await completionResponse.json();
    console.log('任务完成状态:', JSON.stringify(completionData, null, 2));
    
    console.log('\n✅ 完整任务流程测试完成！');
    
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
    await testCompleteMissionFlow();
  } else {
    console.log('\n请先启动后端服务器，然后重新运行测试');
  }
}

main();
