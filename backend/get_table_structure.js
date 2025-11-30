/**
 * 获取 user_champion_subscription_record 表结构
 */

const mysql = require('mysql2/promise');

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '123456',
  database: process.env.DB_NAME || 'kongfuworld',
  charset: 'utf8mb4'
};

async function getTableStructure() {
  let db;
  
  try {
    db = await mysql.createConnection(dbConfig);
    
    const [result] = await db.execute('SHOW CREATE TABLE user_champion_subscription_record');
    console.log('=== 表结构 ===');
    console.log(result[0]['Create Table']);
    
    // 获取字段详情
    const [columns] = await db.execute(
      `SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT, COLUMN_COMMENT
       FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'user_champion_subscription_record'
       ORDER BY ORDINAL_POSITION`,
      [dbConfig.database]
    );
    
    console.log('\n=== 字段列表（按顺序） ===');
    columns.forEach(col => {
      console.log(`${col.COLUMN_NAME}: ${col.COLUMN_TYPE} ${col.IS_NULLABLE === 'NO' ? 'NOT NULL' : 'NULL'} ${col.COLUMN_DEFAULT ? `DEFAULT ${col.COLUMN_DEFAULT}` : ''}`);
    });
    
  } catch (error) {
    console.error('查询失败:', error);
  } finally {
    if (db) await db.end();
  }
}

getTableStructure();

