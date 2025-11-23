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
    console.log('开始执行数据库迁移...');
    console.log('1. 删除comment表中target_type=review的数据');
    console.log('2. 删除comment表的target_type字段');
    
    // 连接数据库
    connection = await mysql.createConnection(dbConfig);
    console.log('数据库连接成功');

    // 先检查并统计要删除的数据
    console.log('\n检查数据...');
    const [reviewComments] = await connection.query(
      `SELECT COUNT(*) as count FROM comment WHERE target_type = 'review'`
    );
    console.log(`找到 ${reviewComments[0].count} 条target_type=review的记录`);

    // 检查target_type字段是否存在
    const [columns] = await connection.query(
      `SELECT COLUMN_NAME 
       FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = ? 
       AND TABLE_NAME = 'comment' 
       AND COLUMN_NAME = 'target_type'`,
      [dbConfig.database]
    );

    if (columns.length === 0) {
      console.log('target_type字段不存在，跳过迁移');
      return;
    }

    // 读取SQL文件
    const sqlPath = path.join(__dirname, 'remove_target_type_from_comment.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    // 执行SQL
    console.log('\n执行SQL迁移...');
    await connection.query(sql);
    
    console.log('✓ 成功删除target_type=review的数据');
    console.log('✓ 成功删除target_type字段');
    
    // 验证迁移结果
    console.log('\n验证迁移结果...');
    
    // 检查target_type字段是否已删除
    const [checkColumns] = await connection.query(
      `SELECT COLUMN_NAME 
       FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = ? 
       AND TABLE_NAME = 'comment' 
       AND COLUMN_NAME = 'target_type'`,
      [dbConfig.database]
    );
    
    if (checkColumns.length === 0) {
      console.log('✓ target_type字段已成功删除');
    } else {
      console.log('✗ target_type字段删除失败');
    }
    
    // 检查剩余数据
    const [remainingData] = await connection.query(
      `SELECT COUNT(*) as count FROM comment`
    );
    console.log(`✓ comment表剩余记录数: ${remainingData[0].count}`);
    
    console.log('\n迁移完成！');
  } catch (error) {
    console.error('迁移失败:', error);
    if (error.code === 'ER_CANT_DROP_FIELD_OR_KEY') {
      console.log('字段不存在，跳过...');
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

