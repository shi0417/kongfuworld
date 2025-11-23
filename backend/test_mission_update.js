// 测试任务进度更新
const { updateMissionProgress } = require('./mission_manager');

async function testMissionUpdate() {
  console.log('🧪 测试任务进度更新...\n');
  
  const userId = 1;
  const missionKeys = ['read_2_chapters', 'read_5_chapters', 'read_10_chapters'];
  
  try {
    for (const missionKey of missionKeys) {
      console.log(`\n测试任务: ${missionKey}`);
      const result = await updateMissionProgress(userId, missionKey, 1);
      
      if (result.success) {
        console.log('✅ 任务进度更新成功');
        console.log(`   当前进度: ${result.data.currentProgress}/${result.data.targetValue}`);
        console.log(`   完成度: ${result.data.progressPercentage}%`);
        console.log(`   是否完成: ${result.data.isCompleted}`);
        console.log(`   所有任务完成: ${result.data.allTasksCompleted}`);
      } else {
        console.log('❌ 任务进度更新失败');
        console.log(`   错误: ${result.message}`);
      }
    }
    
    console.log('\n✅ 测试完成！');
    
  } catch (error) {
    console.error('❌ 测试失败:', error);
  }
}

testMissionUpdate();
