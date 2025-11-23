const mysql = require('mysql2/promise');
require('dotenv').config();

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '123456',
  database: process.env.DB_NAME || 'kongfuworld',
  charset: 'utf8mb4'
};

async function executeMigration() {
  let connection;
  try {
    console.log('🔍 开始执行迁移: 为novel表添加created_at字段...');
    
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ 数据库连接成功');
    
    // 检查字段是否已存在
    const [columns] = await connection.execute(
      `SELECT COLUMN_NAME 
       FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = ? 
       AND TABLE_NAME = 'novel' 
       AND COLUMN_NAME = 'created_at'`,
      [dbConfig.database]
    );
    
    if (columns.length > 0) {
      console.log('✅ 字段 created_at 已存在，跳过迁移');
      return;
    }
    
    // 添加字段
    console.log('📝 添加created_at字段...');
    await connection.execute(
      `ALTER TABLE \`novel\`
       ADD COLUMN \`created_at\` DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间' AFTER \`review_status\``
    );
    console.log('✅ 字段添加成功');
    
    // 为已存在的记录设置默认创建时间
    console.log('📝 为已存在的记录设置创建时间...');
    await connection.execute(
      `UPDATE \`novel\` SET \`created_at\` = NOW() WHERE \`created_at\` IS NULL`
    );
    console.log('✅ 已更新现有记录的创建时间');
    
    console.log('\n✅ 迁移完成！novel表已添加created_at字段');
  } catch (error) {
    console.error('❌ 迁移执行失败:', error.message);
    
    // 如果是字段已存在的错误，忽略
    if (error.message.includes('Duplicate column name') || 
        error.message.includes('already exists')) {
      console.log('⚠️  字段已存在，跳过...');
    } else {
      throw error;
    }
  } finally {
    if (connection) {
      await connection.end();
      console.log('🔌 数据库连接已关闭');
    }
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  executeMigration()
    .then(() => {
      console.log('迁移完成');
      process.exit(0);
    })
    .catch((error) => {
      console.error('迁移失败:', error);
      process.exit(1);
    });
}

module.exports = executeMigration;

