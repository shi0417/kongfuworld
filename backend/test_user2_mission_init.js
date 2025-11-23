// 测试userid=2的任务初始化
const { checkAndInitializeTodayMissions } = require('./mission_manager');

async function testUser2MissionInit() {
  console.log('🧪 测试userid=2的任务初始化...\n');
  
  const userId = 2;
  
  try {
    console.log('1️⃣ 检查用户任务状态...');
    const mysql = require('mysql2/promise');
    const db = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: '123456',
      database: 'kongfuworld',
      charset: 'utf8mb4'
    });
    
    const [userResults] = await db.execute('SELECT id, username, mission FROM user WHERE id = ?', [userId]);
    if (userResults.length > 0) {
      console.log('用户信息:', userResults[0]);
    } else {
      console.log('❌ 用户不存在');
      return;
    }
    
    console.log('\n2️⃣ 检查现有任务记录...');
    const [existingRecords] = await db.execute(`
      SELECT * FROM user_mission_progress 
      WHERE user_id = ? 
      ORDER BY progress_date DESC
    `, [userId]);
    
    console.log(`现有任务记录数量: ${existingRecords.length}`);
    existingRecords.forEach((record, index) => {
      console.log(`  ${index + 1}. 任务: ${record.mission_id}, 进度: ${record.current_progress}, 日期: ${record.progress_date}`);
    });
    
    await db.end();
    
    console.log('\n3️⃣ 执行任务初始化...');
    const result = await checkAndInitializeTodayMissions(userId);
    
    console.log('初始化结果:', JSON.stringify(result, null, 2));
    
    if (result.success) {
      console.log('✅ 任务初始化成功');
      console.log(`   状态: ${result.status}`);
      console.log(`   消息: ${result.message}`);
      
      if (result.missions) {
        console.log(`   任务数量: ${result.missions.length}`);
        result.missions.forEach((mission, index) => {
          console.log(`     ${index + 1}. ${mission.title} (${mission.mission_key})`);
        });
      }
    } else {
      console.log('❌ 任务初始化失败');
      console.log(`   错误: ${result.message}`);
    }
    
    console.log('\n4️⃣ 检查初始化后的任务记录...');
    const db2 = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: '123456',
      database: 'kongfuworld',
      charset: 'utf8mb4'
    });
    
    const [newRecords] = await db2.execute(`
      SELECT * FROM user_mission_progress 
      WHERE user_id = ? 
      ORDER BY progress_date DESC, created_at DESC
    `, [userId]);
    
    console.log(`初始化后任务记录数量: ${newRecords.length}`);
    newRecords.forEach((record, index) => {
      console.log(`  ${index + 1}. 任务: ${record.mission_id}, 进度: ${record.current_progress}, 日期: ${record.progress_date}, 创建: ${record.created_at}`);
    });
    
    await db2.end();
    
    console.log('\n✅ 测试完成！');
    
  } catch (error) {
    console.error('❌ 测试失败:', error);
  }
}

testUser2MissionInit();
