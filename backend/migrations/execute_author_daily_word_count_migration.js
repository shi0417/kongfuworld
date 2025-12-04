// 执行创建 author_daily_word_count 表的迁移
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '123456',
  database: process.env.DB_NAME || 'kongfuworld',
  charset: 'utf8mb4',
  multipleStatements: true
};

async function executeMigration() {
  let db;
  try {
    console.log('开始执行 author_daily_word_count 表迁移...');
    
    db = await mysql.createConnection(dbConfig);
    
    // 读取 SQL 文件
    const sqlPath = path.join(__dirname, 'create_author_daily_word_count_table.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    console.log('执行 SQL 语句...');
    await db.query(sql);
    
    // 验证表是否创建成功
    const [tables] = await db.query(
      `SELECT TABLE_NAME 
       FROM INFORMATION_SCHEMA.TABLES 
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'author_daily_word_count'`,
      [dbConfig.database]
    );
    
    if (tables.length > 0) {
      console.log('✅ author_daily_word_count 表已成功创建');
      
      // 检查表结构
      const [columns] = await db.query(
        `SELECT COLUMN_NAME, DATA_TYPE, COLUMN_COMMENT 
         FROM INFORMATION_SCHEMA.COLUMNS 
         WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'author_daily_word_count' 
         ORDER BY ORDINAL_POSITION`,
        [dbConfig.database]
      );
      
      console.log('\n表结构:');
      columns.forEach(col => {
        console.log(`  - ${col.COLUMN_NAME} (${col.DATA_TYPE}): ${col.COLUMN_COMMENT || ''}`);
      });
      
      // 检查索引
      const [indexes] = await db.query(
        `SELECT INDEX_NAME, COLUMN_NAME 
         FROM INFORMATION_SCHEMA.STATISTICS 
         WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'author_daily_word_count' 
         ORDER BY INDEX_NAME, SEQ_IN_INDEX`,
        [dbConfig.database]
      );
      
      console.log('\n索引:');
      const indexMap = new Map();
      indexes.forEach(idx => {
        if (!indexMap.has(idx.INDEX_NAME)) {
          indexMap.set(idx.INDEX_NAME, []);
        }
        indexMap.get(idx.INDEX_NAME).push(idx.COLUMN_NAME);
      });
      indexMap.forEach((cols, name) => {
        console.log(`  - ${name}: (${cols.join(', ')})`);
      });
      
    } else {
      throw new Error('author_daily_word_count 表未找到');
    }
    
    console.log('\n✅ 迁移完成！');
  } catch (error) {
    console.error('❌ 迁移失败:', error.message);
    if (error.code === 'ER_TABLE_EXISTS_ERROR') {
      console.log('⚠️  表已存在，如果需要重新创建，请先手动删除该表');
    }
    process.exit(1);
  } finally {
    if (db) await db.end();
  }
}

// 执行迁移
executeMigration();

