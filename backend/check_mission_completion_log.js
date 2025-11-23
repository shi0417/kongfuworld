// 检查mission_completion_log表的记录逻辑和结构
const mysql = require('mysql2/promise');

// 数据库配置
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '123456',
  database: process.env.DB_NAME || 'kongfuworld',
  charset: 'utf8mb4'
};

async function checkMissionCompletionLog() {
  let db;
  try {
    db = await mysql.createConnection(dbConfig);
    
    console.log('\n🔍 检查mission_completion_log表的记录逻辑和结构\n');
    
    // 1. 查看表结构
    const [columns] = await db.execute(`
      DESCRIBE mission_completion_log
    `);
    
    console.log('📊 当前表结构:');
    columns.forEach(column => {
      console.log(`   ${column.Field}: ${column.Type} ${column.Null === 'NO' ? 'NOT NULL' : 'NULL'} ${column.Key ? `(${column.Key})` : ''} ${column.Default ? `DEFAULT ${column.Default}` : ''} ${column.Comment ? `COMMENT '${column.Comment}'` : ''}`);
    });
    
    // 2. 查看记录逻辑（从mission.js中）
    console.log('\n📝 记录逻辑分析:');
    console.log('   根据代码，mission_completion_log表在以下情况记录:');
    console.log('   1. 任务完成且未领取奖励时 (isCompleted && !isClaimed)');
    console.log('   2. 记录用户ID、任务ID、奖励钥匙、奖励Karma');
    console.log('   3. 但是缺少章节ID信息！');
    
    // 3. 查看现有记录
    const [existingRecords] = await db.execute(`
      SELECT 
        mcl.*,
        mc.mission_key,
        mc.title as mission_title
      FROM mission_completion_log mcl
      JOIN mission_config mc ON mcl.mission_id = mc.id
      WHERE mcl.user_id = 1
      ORDER BY mcl.completed_at DESC
      LIMIT 5
    `);
    
    console.log('\n📖 现有记录示例:');
    if (existingRecords.length > 0) {
      existingRecords.forEach((record, index) => {
        console.log(`   ${index + 1}. 用户: ${record.user_id}, 任务: ${record.mission_key} (${record.mission_title})`);
        console.log(`      完成时间: ${record.completed_at}`);
        console.log(`      奖励: ${record.reward_keys} 钥匙, ${record.reward_karma} Karma`);
        console.log(`      领取时间: ${record.claimed_at || '未领取'}`);
        console.log('');
      });
    } else {
      console.log('   无现有记录');
    }
    
    // 4. 分析问题
    console.log('🎯 问题分析:');
    console.log('   ❌ 缺少章节ID字段，无法知道是哪个章节触发的任务完成');
    console.log('   ❌ 无法追踪具体的新章节阅读记录');
    console.log('   ❌ 无法分析用户阅读行为');
    
    console.log('\n💡 建议解决方案:');
    console.log('   1. 添加 chapter_id 字段记录触发任务完成的章节ID');
    console.log('   2. 修改记录逻辑，在任务完成时记录章节ID');
    console.log('   3. 更新现有的记录逻辑');
    
  } catch (error) {
    console.error('检查失败:', error);
  } finally {
    if (db) await db.end();
  }
}

// 运行检查
checkMissionCompletionLog();
