// 为reading_log表添加新字段
const mysql = require('mysql2/promise');

// 数据库配置
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '123456',
  database: process.env.DB_NAME || 'kongfuworld',
  charset: 'utf8mb4'
};

async function addReadingLogFields() {
  let db;
  try {
    db = await mysql.createConnection(dbConfig);
    
    console.log('\n🔧 为reading_log表添加新字段\n');
    
    // 1. 添加字段：用户阅读该章节时，该章节是否为用户所解锁（是否永久拥有）
    console.log('📝 添加字段: is_unlocked (是否永久拥有)');
    try {
      await db.execute(`
        ALTER TABLE reading_log 
        ADD COLUMN is_unlocked TINYINT(1) DEFAULT 0 COMMENT '用户阅读时章节是否已解锁（是否永久拥有）'
      `);
      console.log('✅ 字段 is_unlocked 添加成功');
    } catch (error) {
      if (error.code === 'ER_DUP_FIELDNAME') {
        console.log('⚠️  字段 is_unlocked 已存在');
      } else {
        console.error('❌ 添加字段 is_unlocked 失败:', error.message);
      }
    }
    
    // 2. 添加字段：该章节的解锁时间
    console.log('\n📝 添加字段: unlock_time (解锁时间)');
    try {
      await db.execute(`
        ALTER TABLE reading_log 
        ADD COLUMN unlock_time DATETIME NULL COMMENT '该章节的解锁时间'
      `);
      console.log('✅ 字段 unlock_time 添加成功');
    } catch (error) {
      if (error.code === 'ER_DUP_FIELDNAME') {
        console.log('⚠️  字段 unlock_time 已存在');
      } else {
        console.error('❌ 添加字段 unlock_time 失败:', error.message);
      }
    }
    
    // 3. 查看更新后的表结构
    console.log('\n📊 更新后的表结构:');
    const [columns] = await db.execute(`
      DESCRIBE reading_log
    `);
    
    columns.forEach(column => {
      console.log(`   ${column.Field}: ${column.Type} ${column.Null === 'NO' ? 'NOT NULL' : 'NULL'} ${column.Key ? `(${column.Key})` : ''} ${column.Default ? `DEFAULT ${column.Default}` : ''} ${column.Comment ? `COMMENT '${column.Comment}'` : ''}`);
    });
    
    console.log('\n🎯 字段说明:');
    console.log('   is_unlocked: 记录用户阅读该章节时，该章节是否为用户所解锁（是否永久拥有）');
    console.log('   unlock_time: 记录该章节的解锁时间');
    
  } catch (error) {
    console.error('操作失败:', error);
  } finally {
    if (db) await db.end();
  }
}

// 运行添加字段操作
addReadingLogFields();
