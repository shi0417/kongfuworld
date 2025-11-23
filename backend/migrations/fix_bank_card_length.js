const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

// 数据库配置
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '123456',
  database: process.env.DB_NAME || 'kongfuworld',
  charset: 'utf8mb4',
  multipleStatements: true
};

async function executeMigration() {
  let connection;
  try {
    console.log('开始执行银行卡号字段长度修复迁移...');
    
    // 连接数据库
    connection = await mysql.createConnection(dbConfig);
    console.log('数据库连接成功');

    // 读取SQL文件
    const sqlPath = path.join(__dirname, 'fix_bank_card_length.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    // 执行SQL
    await connection.query(sql);
    console.log('✓ 成功修改 full_card_number 字段类型为 TEXT');
    
    console.log('\n迁移完成！');
  } catch (error) {
    console.error('迁移失败:', error);
    if (error.code === 'ER_DUP_FIELDNAME') {
      console.log('字段已存在，跳过...');
    } else {
      process.exit(1);
    }
  } finally {
    if (connection) {
      await connection.end();
      console.log('数据库连接已关闭');
    }
  }
}

executeMigration();

