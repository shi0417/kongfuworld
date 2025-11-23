// 删除未使用的 chapter_karma_cost 表
const mysql = require('mysql2/promise');

// 数据库连接配置
const dbConfig = {
  host: 'localhost',
  user: 'root',
  password: '123456',
  database: 'kongfuworld',
  charset: 'utf8mb4'
};

async function dropChapterKarmaCostTable() {
  let db;
  try {
    console.log('开始删除 chapter_karma_cost 表...\n');
    
    // 创建数据库连接
    db = await mysql.createConnection(dbConfig);
    console.log('✅ 数据库连接成功');
    
    // 检查表是否存在
    const [tables] = await db.execute(`
      SELECT TABLE_NAME 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_SCHEMA = 'kongfuworld' 
      AND TABLE_NAME = 'chapter_karma_cost'
    `);
    
    if (tables.length === 0) {
      console.log('⚠️  chapter_karma_cost 表不存在，无需删除');
      return;
    }
    
    console.log('📋 找到 chapter_karma_cost 表，准备删除...');
    
    // 删除表
    await db.execute('DROP TABLE IF EXISTS `chapter_karma_cost`');
    console.log('✅ chapter_karma_cost 表删除成功');
    
    // 再次确认表已删除
    const [checkTables] = await db.execute(`
      SELECT TABLE_NAME 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_SCHEMA = 'kongfuworld' 
      AND TABLE_NAME = 'chapter_karma_cost'
    `);
    
    if (checkTables.length === 0) {
      console.log('✅ 确认：chapter_karma_cost 表已成功删除');
    } else {
      console.log('⚠️  警告：表可能未完全删除');
    }
    
  } catch (error) {
    console.error('❌ 删除表时出错:', error.message);
    process.exit(1);
  } finally {
    if (db) {
      await db.end();
      console.log('\n数据库连接已关闭');
    }
  }
}

// 执行删除操作
dropChapterKarmaCostTable()
  .then(() => {
    console.log('\n✅ 操作完成');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ 操作失败:', error);
    process.exit(1);
  });

