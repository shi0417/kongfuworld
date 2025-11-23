// 测试阅读章节API与任务进度更新
const fetch = require('node-fetch');

const BASE_URL = 'http://localhost:5000/api';

async function testReadChapterWithMission() {
  console.log('🧪 测试阅读章节API与任务进度更新...\n');
  
  const userId = 1;
  const chapterId = 1211; // 使用一个新的章节ID进行测试
  
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
      
      if (data.isNewChapter) {
        console.log('✅ 章节被正确识别为新章节');
        
        // 等待一下让任务更新完成
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        console.log('\n2️⃣ 检查任务完成日志...');
        const checkResponse = await fetch(`${BASE_URL}/mission-v2/completion/${userId}`);
        const checkData = await checkResponse.json();
        
        if (checkData.success) {
          console.log('✅ 任务完成状态检查成功');
          console.log(`   今日任务完成: ${checkData.data.isCompleted}`);
          console.log(`   完成的任务数量: ${checkData.data.completedMissions.length}`);
          
          if (checkData.data.completedMissions.length > 0) {
            console.log('   完成的任务:');
            checkData.data.completedMissions.forEach((mission, index) => {
              console.log(`     ${index + 1}. ${mission.title} - 奖励: ${mission.reward_keys} keys`);
            });
          }
        }
      } else {
        console.log('❌ 章节没有被识别为新章节');
        console.log(`   原因: ${data.reason || '未知'}`);
      }
    } else {
      console.log('❌ 阅读章节API调用失败');
      console.log(`   错误: ${data.message}`);
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
    await testReadChapterWithMission();
  } else {
    console.log('\n请先启动后端服务器，然后重新运行测试');
  }
}

main();
