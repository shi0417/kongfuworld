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
    console.log('开始执行紧急联系人手机号码国家区号字段迁移...');
    
    // 连接数据库
    connection = await mysql.createConnection(dbConfig);
    console.log('数据库连接成功');

    // 检查字段是否已存在
    const [columns] = await connection.query(
      `SELECT COLUMN_NAME 
       FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = ? 
       AND TABLE_NAME = 'user' 
       AND COLUMN_NAME = 'emergency_contact_phone_country_code'`,
      [dbConfig.database]
    );

    if (columns.length > 0) {
      console.log('emergency_contact_phone_country_code 字段已存在，跳过迁移');
      return;
    }

    // 读取SQL文件
    const sqlPath = path.join(__dirname, 'add_emergency_contact_country_code.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    // 执行SQL
    await connection.query(sql);
    console.log('✓ 成功添加 emergency_contact_phone_country_code 字段');
    
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

