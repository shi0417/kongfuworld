// 为mission_completion_log表添加chapter_id字段
const mysql = require('mysql2/promise');

// 数据库配置
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '123456',
  database: process.env.DB_NAME || 'kongfuworld',
  charset: 'utf8mb4'
};

async function addChapterIdToMissionLog() {
  let db;
  try {
    db = await mysql.createConnection(dbConfig);
    
    console.log('\n🔧 为mission_completion_log表添加chapter_id字段\n');
    
    // 1. 添加chapter_id字段
    console.log('📝 添加字段: chapter_id (触发任务完成的章节ID)');
    try {
      await db.execute(`
        ALTER TABLE mission_completion_log 
        ADD COLUMN chapter_id INT NULL COMMENT '触发任务完成的章节ID'
      `);
      console.log('✅ 字段 chapter_id 添加成功');
    } catch (error) {
      if (error.code === 'ER_DUP_FIELDNAME') {
        console.log('⚠️  字段 chapter_id 已存在');
      } else {
        console.error('❌ 添加字段 chapter_id 失败:', error.message);
      }
    }
    
    // 2. 查看更新后的表结构
    console.log('\n📊 更新后的表结构:');
    const [columns] = await db.execute(`
      DESCRIBE mission_completion_log
    `);
    
    columns.forEach(column => {
      console.log(`   ${column.Field}: ${column.Type} ${column.Null === 'NO' ? 'NOT NULL' : 'NULL'} ${column.Key ? `(${column.Key})` : ''} ${column.Default ? `DEFAULT ${column.Default}` : ''} ${column.Comment ? `COMMENT '${column.Comment}'` : ''}`);
    });
    
    console.log('\n🎯 字段说明:');
    console.log('   chapter_id: 记录触发任务完成的章节ID，用于追踪具体的新章节阅读记录');
    
    // 3. 查看现有记录
    console.log('\n📖 现有记录（缺少章节ID）:');
    const [existingRecords] = await db.execute(`
      SELECT 
        mcl.*,
        mc.mission_key,
        mc.title as mission_title
      FROM mission_completion_log mcl
      JOIN mission_config mc ON mcl.mission_id = mc.id
      WHERE mcl.user_id = 1
      ORDER BY mcl.completed_at DESC
      LIMIT 3
    `);
    
    existingRecords.forEach((record, index) => {
      console.log(`   ${index + 1}. 任务: ${record.mission_key}`);
      console.log(`      完成时间: ${record.completed_at}`);
      console.log(`      章节ID: ${record.chapter_id || '未记录'}`);
      console.log('');
    });
    
    console.log('💡 下一步需要修改记录逻辑，在任务完成时记录章节ID');
    
  } catch (error) {
    console.error('操作失败:', error);
  } finally {
    if (db) await db.end();
  }
}

// 运行添加字段操作
addChapterIdToMissionLog();
