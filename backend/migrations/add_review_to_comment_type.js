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
    console.log('开始执行comment表target_type字段扩展迁移...');
    
    // 连接数据库
    connection = await mysql.createConnection(dbConfig);
    console.log('数据库连接成功');

    // 检查字段类型
    const [columns] = await connection.query(
      `SELECT COLUMN_TYPE 
       FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = ? 
       AND TABLE_NAME = 'comment' 
       AND COLUMN_NAME = 'target_type'`,
      [dbConfig.database]
    );

    if (columns.length === 0) {
      console.log('comment表或target_type字段不存在，跳过迁移');
      return;
    }

    const columnType = columns[0].COLUMN_TYPE;
    if (columnType.includes("'review'")) {
      console.log('target_type字段已包含review类型，跳过迁移');
      return;
    }

    // 读取SQL文件
    const sqlPath = path.join(__dirname, 'add_review_to_comment_type.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    // 执行SQL
    await connection.query(sql);
    console.log('✓ 成功添加review类型到comment表的target_type字段');
    
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

