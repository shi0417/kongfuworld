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
    console.log('开始执行银行卡变更记录表字段扩展迁移...');
    
    // 连接数据库
    connection = await mysql.createConnection(dbConfig);
    console.log('数据库连接成功');

    // 检查字段是否已存在
    const [columns] = await connection.query(
      `SELECT COLUMN_NAME 
       FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = ? 
       AND TABLE_NAME = 'user_bank_card_change_logs' 
       AND COLUMN_NAME IN ('old_full_card_number', 'old_bank_name', 'old_cardholder_name', 'new_full_card_number', 'new_bank_name', 'new_cardholder_name')`,
      [dbConfig.database]
    );

    const existingColumns = columns.map(col => col.COLUMN_NAME);
    const requiredColumns = ['old_full_card_number', 'old_bank_name', 'old_cardholder_name', 'new_full_card_number', 'new_bank_name', 'new_cardholder_name'];
    const missingColumns = requiredColumns.filter(col => !existingColumns.includes(col));

    if (missingColumns.length === 0) {
      console.log('所有字段已存在，跳过迁移');
      return;
    }

    // 读取SQL文件
    const sqlPath = path.join(__dirname, 'add_bank_card_log_fields.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    // 执行SQL
    await connection.query(sql);
    console.log('✓ 成功添加银行卡变更记录表字段');
    
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

