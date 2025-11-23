// 测试任务进度更新时记录chapter_id
const { updateMissionProgress } = require('./mission_manager');

async function testMissionWithChapterId() {
  console.log('🧪 测试任务进度更新时记录chapter_id...\n');
  
  const userId = 1;
  const chapterId = 1210;
  const missionKey = 'read_2_chapters';
  
  try {
    console.log(`1️⃣ 测试任务进度更新...`);
    console.log(`   用户ID: ${userId}`);
    console.log(`   章节ID: ${chapterId}`);
    console.log(`   任务标识: ${missionKey}`);
    
    const result = await updateMissionProgress(userId, missionKey, 1, chapterId);
    
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
    
    console.log('\n✅ 测试完成！');
    
  } catch (error) {
    console.error('❌ 测试失败:', error);
  }
}

testMissionWithChapterId();
