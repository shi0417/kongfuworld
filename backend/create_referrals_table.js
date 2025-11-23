const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

const dbConfig = {
  host: 'localhost',
  user: 'root',
  password: '123456',
  database: 'kongfuworld',
  charset: 'utf8mb4'
};

async function createReferralsTable() {
  let db;
  try {
    console.log('开始创建 referrals 表...');
    db = await mysql.createConnection(dbConfig);
    console.log('✅ 数据库连接成功');

    // 读取SQL文件
    const sqlPath = path.join(__dirname, 'migrations', 'create_referrals_table.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    // 执行SQL
    await db.execute(sql);
    console.log('✅ referrals 表创建成功');

    // 验证表是否创建成功
    const [tables] = await db.execute(`
      SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'referrals'
    `, [dbConfig.database]);

    if (tables.length > 0) {
      console.log('✅ 确认：referrals 表已成功创建');
      
      // 显示表结构
      const [columns] = await db.execute(`
        SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT, COLUMN_COMMENT
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'referrals'
        ORDER BY ORDINAL_POSITION
      `, [dbConfig.database]);
      
      console.log('\n📋 表结构:');
      console.table(columns);
      
      // 显示索引信息
      const [indexes] = await db.execute(`
        SELECT INDEX_NAME, COLUMN_NAME, NON_UNIQUE, SEQ_IN_INDEX
        FROM INFORMATION_SCHEMA.STATISTICS
        WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'referrals'
        ORDER BY INDEX_NAME, SEQ_IN_INDEX
      `, [dbConfig.database]);
      
      console.log('\n📊 索引信息:');
      console.table(indexes);
    } else {
      console.error('❌ 确认失败：referrals 表未创建');
    }

  } catch (error) {
    console.error('❌ 创建 referrals 表失败:', error.message);
    if (error.code === 'ER_TABLE_EXISTS_ERROR') {
      console.log('⚠️ 表已存在，跳过创建');
    } else if (error.code === 'ER_DUP_ENTRY') {
      console.log('⚠️ 表或索引已存在');
    } else {
      console.error('详细错误:', error);
    }
  } finally {
    if (db) {
      await db.end();
      console.log('数据库连接已关闭');
    }
    console.log('\n✅ 操作完成');
  }
}

createReferralsTable();

