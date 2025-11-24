// 为 chapter 表添加 updated_at 字段
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '123456',
  database: process.env.DB_NAME || 'kongfuworld',
  charset: 'utf8mb4'
};

async function addUpdatedAtColumn() {
  let connection;
  try {
    console.log('正在连接数据库...');
    connection = await mysql.createConnection(dbConfig);
    console.log('数据库连接成功！\n');

    // 检查字段是否已存在
    console.log('检查 updated_at 字段是否存在...');
    const [columns] = await connection.execute(
      `SELECT COLUMN_NAME 
       FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = ? 
       AND TABLE_NAME = 'chapter' 
       AND COLUMN_NAME = 'updated_at'`,
      [dbConfig.database]
    );

    if (columns.length > 0) {
      console.log('✓ updated_at 字段已存在，跳过添加。');
      return;
    }

    // 添加 updated_at 字段
    console.log('正在添加 updated_at 字段...');
    await connection.execute(
      `ALTER TABLE \`chapter\` 
       ADD COLUMN \`updated_at\` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间' AFTER \`created_at\``
    );
    console.log('✓ updated_at 字段添加成功！\n');

    // 将现有记录的 updated_at 设置为 created_at 的值
    console.log('正在更新现有记录的 updated_at 值...');
    const [updateResult] = await connection.execute(
      `UPDATE \`chapter\` 
       SET \`updated_at\` = \`created_at\` 
       WHERE \`updated_at\` IS NULL`
    );
    console.log(`✓ 成功更新 ${updateResult.affectedRows} 条记录的 updated_at 值。\n`);

    console.log('✅ 迁移完成！');

  } catch (error) {
    console.error('❌ 迁移失败:', error.message);
    if (error.code === 'ER_DUP_FIELDNAME') {
      console.log('字段已存在，无需重复添加。');
    } else {
      process.exit(1);
    }
  } finally {
    if (connection) {
      await connection.end();
      console.log('数据库连接已关闭。');
    }
  }
}

// 执行迁移
addUpdatedAtColumn();

