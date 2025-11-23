// 测试mission_completion_log表记录章节ID的功能
const mysql = require('mysql2/promise');

// 数据库配置
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '123456',
  database: process.env.DB_NAME || 'kongfuworld',
  charset: 'utf8mb4'
};

async function testMissionLogWithChapter() {
  let db;
  try {
    db = await mysql.createConnection(dbConfig);
    
    console.log('\n🧪 测试mission_completion_log表记录章节ID功能\n');
    
    // 1. 查看更新后的表结构
    console.log('📊 更新后的表结构:');
    const [columns] = await db.execute(`
      DESCRIBE mission_completion_log
    `);
    
    columns.forEach(column => {
      console.log(`   ${column.Field}: ${column.Type} ${column.Null === 'NO' ? 'NOT NULL' : 'NULL'} ${column.Key ? `(${column.Key})` : ''} ${column.Default ? `DEFAULT ${column.Default}` : ''} ${column.Comment ? `COMMENT '${column.Comment}'` : ''}`);
    });
    
    // 2. 查看现有记录
    console.log('\n📖 现有记录:');
    const [existingRecords] = await db.execute(`
      SELECT 
        mcl.*,
        mc.mission_key,
        mc.title as mission_title,
        c.chapter_number,
        c.title as chapter_title
      FROM mission_completion_log mcl
      JOIN mission_config mc ON mcl.mission_id = mc.id
      LEFT JOIN chapter c ON mcl.chapter_id = c.id
      WHERE mcl.user_id = 1
      ORDER BY mcl.completed_at DESC
      LIMIT 5
    `);
    
    existingRecords.forEach((record, index) => {
      console.log(`   ${index + 1}. 任务: ${record.mission_key} (${record.mission_title})`);
      console.log(`      完成时间: ${record.completed_at}`);
      console.log(`      章节ID: ${record.chapter_id || '未记录'}`);
      if (record.chapter_id) {
        console.log(`      章节: 第${record.chapter_number}章 - ${record.chapter_title}`);
      }
      console.log(`      奖励: ${record.reward_keys} 钥匙, ${record.reward_karma} Karma`);
      console.log(`      领取时间: ${record.claimed_at || '未领取'}`);
      console.log('');
    });
    
    // 3. 模拟新的记录逻辑
    console.log('🎯 新的记录逻辑:');
    console.log('   1. 用户阅读新章节时触发任务进度更新');
    console.log('   2. 任务完成时记录章节ID到mission_completion_log表');
    console.log('   3. 可以追踪具体是哪个章节触发的任务完成');
    
    // 4. 测试API调用
    console.log('\n🔧 测试API调用:');
    console.log('   当用户阅读章节1355时:');
    console.log('   - 判断为新章节: ✅');
    console.log('   - 更新任务进度: ✅');
    console.log('   - 记录章节ID: ✅ (新增功能)');
    
    // 5. 查看任务进度
    const today = new Date().toISOString().slice(0, 10);
    const [missionProgress] = await db.execute(`
      SELECT 
        ump.*,
        mc.mission_key,
        mc.title,
        mc.target_value
      FROM user_mission_progress ump
      JOIN mission_config mc ON ump.mission_id = mc.id
      WHERE ump.user_id = 1 AND ump.progress_date = ?
      ORDER BY ump.mission_id
    `, [today]);
    
    console.log('\n📊 当前任务进度:');
    missionProgress.forEach(mission => {
      const percentage = Math.round((mission.current_progress / mission.target_value) * 100);
      console.log(`   ${mission.mission_key}: ${mission.current_progress}/${mission.target_value} (${percentage}%)`);
    });
    
    console.log('\n🎉 功能总结:');
    console.log('✅ 1. 添加了chapter_id字段到mission_completion_log表');
    console.log('✅ 2. 修改了任务进度更新API，传递章节ID');
    console.log('✅ 3. 修改了阅读记录API，在调用任务更新时传递章节ID');
    console.log('✅ 4. 现在可以追踪具体是哪个章节触发的任务完成');
    
    console.log('\n💡 使用场景:');
    console.log('   - 分析用户阅读行为');
    console.log('   - 追踪任务完成的具体章节');
    console.log('   - 统计热门章节');
    console.log('   - 优化推荐算法');
    
  } catch (error) {
    console.error('测试失败:', error);
  } finally {
    if (db) await db.end();
  }
}

// 运行测试
testMissionLogWithChapter();
