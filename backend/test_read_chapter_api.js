// 测试阅读章节API
const fetch = require('node-fetch');

const BASE_URL = 'http://localhost:5000/api';

async function testReadChapterAPI() {
  console.log('🧪 测试阅读章节API...\n');
  
  const userId = 1;
  const chapterId = 1320;
  
  try {
    console.log('1️⃣ 调用阅读章节API...');
    const response = await fetch(`${BASE_URL}/user/${userId}/read-chapter`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chapterId: chapterId })
    });
    
    const data = await response.json();
    console.log('API响应:', JSON.stringify(data, null, 2));
    
    if (data.success) {
      console.log('✅ 阅读章节API调用成功');
      console.log(`   是否为新章节: ${data.isNewChapter}`);
      console.log(`   原因: ${data.reason}`);
      
      if (data.missionResults) {
        console.log('   任务更新结果:');
        data.missionResults.forEach((result, index) => {
          console.log(`     ${index + 1}. ${result.missionKey}: ${result.success ? '成功' : '失败'} - ${result.message}`);
        });
      }
    } else {
      console.log('❌ 阅读章节API调用失败');
      console.log(`   错误: ${data.message}`);
    }
    
    console.log('\n2️⃣ 检查任务进度更新...');
    const missionsResponse = await fetch(`${BASE_URL}/mission-v2/user/${userId}`);
    const missionsData = await missionsResponse.json();
    
    if (missionsData.success) {
      console.log('✅ 任务列表获取成功');
      missionsData.data.missions.forEach((mission, index) => {
        console.log(`   ${index + 1}. ${mission.title}: ${mission.currentProgress}/${mission.targetValue} (${mission.progressPercentage}%) - ${mission.isCompleted ? '已完成' : '进行中'}`);
      });
    }
    
    console.log('\n✅ 测试完成！');
    
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
    await testReadChapterAPI();
  } else {
    console.log('\n请先启动后端服务器，然后重新运行测试');
  }
}

main();
