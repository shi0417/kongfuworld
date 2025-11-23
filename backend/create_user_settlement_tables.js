const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

async function createTables() {
  const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '123456',
    database: process.env.DB_NAME || 'kongfuworld',
    charset: 'utf8mb4',
    multipleStatements: true
  };

  let connection;
  try {
    connection = await mysql.createConnection(dbConfig);
    
    // 读取SQL文件
    const sqlFile = path.join(__dirname, 'create_user_settlement_tables.sql');
    const sql = fs.readFileSync(sqlFile, 'utf8');
    
    // 执行SQL
    await connection.query(sql);
    
    console.log('✅ 所有表创建成功！');
    
    // 验证表是否创建成功
    const [tables] = await connection.query(`
      SELECT TABLE_NAME 
      FROM information_schema.TABLES 
      WHERE TABLE_SCHEMA = ? 
      AND TABLE_NAME IN (
        'user_income_monthly',
        'user_payout',
        'user_payout_item',
        'user_payout_account',
        'payout_gateway_transaction'
      )
    `, [dbConfig.database]);
    
    console.log('\n已创建的表:');
    tables.forEach(table => {
      console.log(`  - ${table.TABLE_NAME}`);
    });
    
  } catch (error) {
    console.error('❌ 创建表失败:', error.message);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

createTables();

