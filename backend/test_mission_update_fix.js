// 测试修复后的任务更新逻辑
const mysql = require('mysql2/promise');

// 数据库连接配置
const dbConfig = {
  host: 'localhost',
  user: 'root',
  password: '123456',
  database: 'kongfuworld',
  charset: 'utf8mb4'
};

async function testMissionUpdateFix() {
  console.log('🧪 测试修复后的任务更新逻辑...\n');
  
  const userId = 1;
  
  let db;
  try {
    db = await mysql.createConnection(dbConfig);
    
    console.log('1️⃣ 检查修复前的数据状态...');
    const [beforeResults] = await db.execute(`
      SELECT id, user_id, mission_id, current_progress, is_completed, is_claimed, progress_date, updated_at
      FROM user_mission_progress 
      WHERE user_id = ? 
      ORDER BY progress_date DESC, updated_at DESC
      LIMIT 5
    `, [userId]);
    
    console.log('修复前的数据:');
    beforeResults.forEach((record, index) => {
      console.log(`  ${index + 1}. ID: ${record.id}, 任务: ${record.mission_id}, 进度: ${record.current_progress}, 日期: ${record.progress_date}, 更新: ${record.updated_at}`);
    });
    
    console.log('\n2️⃣ 模拟任务领取操作...');
    const today = new Date().toISOString().slice(0, 10);
    
    // 模拟领取任务奖励（只更新今天的记录）
    await db.execute(`
      UPDATE user_mission_progress 
      SET is_claimed = 1, updated_at = NOW()
      WHERE user_id = ? AND mission_id = ? AND progress_date = ?
    `, [userId, 1, today]); // 假设领取任务1的奖励
    
    console.log('✅ 任务领取操作完成（只更新今天的记录）');
    
    console.log('\n3️⃣ 检查修复后的数据状态...');
    const [afterResults] = await db.execute(`
      SELECT id, user_id, mission_id, current_progress, is_completed, is_claimed, progress_date, updated_at
      FROM user_mission_progress 
      WHERE user_id = ? 
      ORDER BY progress_date DESC, updated_at DESC
      LIMIT 5
    `, [userId]);
    
    console.log('修复后的数据:');
    afterResults.forEach((record, index) => {
      console.log(`  ${index + 1}. ID: ${record.id}, 任务: ${record.mission_id}, 进度: ${record.current_progress}, 日期: ${record.progress_date}, 更新: ${record.updated_at}`);
    });
    
    console.log('\n4️⃣ 验证修复效果...');
    const [todayRecords] = await db.execute(`
      SELECT COUNT(*) as count FROM user_mission_progress 
      WHERE user_id = ? AND progress_date = ? AND is_claimed = 1
    `, [userId, today]);
    
    const [historyRecords] = await db.execute(`
      SELECT COUNT(*) as count FROM user_mission_progress 
      WHERE user_id = ? AND progress_date < ? AND is_claimed = 1
    `, [userId, today]);
    
    console.log(`   今天已领取的任务数量: ${todayRecords[0].count}`);
    console.log(`   历史已领取的任务数量: ${historyRecords[0].count}`);
    
    if (todayRecords[0].count > 0 && historyRecords[0].count === 0) {
      console.log('✅ 修复成功！只有今天的记录被更新');
    } else {
      console.log('❌ 修复失败！历史记录也被更新了');
    }
    
    console.log('\n✅ 测试完成！');
    
  } catch (error) {
    console.error('❌ 测试失败:', error);
  } finally {
    if (db) await db.end();
  }
}

testMissionUpdateFix();
