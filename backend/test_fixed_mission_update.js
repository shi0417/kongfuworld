// 测试修复后的任务更新逻辑（使用新的章节ID）
const { updateMissionProgress } = require('./mission_manager');

async function testFixedMissionUpdate() {
  console.log('🧪 测试修复后的任务更新逻辑...\n');
  
  const userId = 1;
  const chapterId = 1212; // 使用一个新的章节ID
  const missionKey = 'read_5_chapters';
  
  try {
    console.log('1️⃣ 测试任务进度更新...');
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
    
    console.log('\n2️⃣ 检查数据库记录...');
    const mysql = require('mysql2/promise');
    const db = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: '123456',
      database: 'kongfuworld',
      charset: 'utf8mb4'
    });
    
    const [todayRecords] = await db.execute(`
      SELECT id, user_id, mission_id, current_progress, is_completed, is_claimed, progress_date, updated_at
      FROM user_mission_progress 
      WHERE user_id = ? AND progress_date = CURDATE()
      ORDER BY updated_at DESC
      LIMIT 3
    `, [userId]);
    
    console.log('今天的任务记录:');
    todayRecords.forEach((record, index) => {
      console.log(`  ${index + 1}. 任务: ${record.mission_id}, 进度: ${record.current_progress}, 完成: ${record.is_completed}, 更新: ${record.updated_at}`);
    });
    
    const [historyRecords] = await db.execute(`
      SELECT id, user_id, mission_id, current_progress, is_completed, is_claimed, progress_date, updated_at
      FROM user_mission_progress 
      WHERE user_id = ? AND progress_date < CURDATE()
      ORDER BY progress_date DESC, updated_at DESC
      LIMIT 3
    `, [userId]);
    
    console.log('\n历史任务记录:');
    historyRecords.forEach((record, index) => {
      console.log(`  ${index + 1}. 任务: ${record.mission_id}, 进度: ${record.current_progress}, 完成: ${record.is_completed}, 日期: ${record.progress_date}, 更新: ${record.updated_at}`);
    });
    
    await db.end();
    
    console.log('\n✅ 测试完成！');
    
  } catch (error) {
    console.error('❌ 测试失败:', error);
  }
}

testFixedMissionUpdate();
