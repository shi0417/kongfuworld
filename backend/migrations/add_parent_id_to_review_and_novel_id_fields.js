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
    console.log('1. 为review表添加parent_id字段');
    console.log('2. 为paragraph_comment表添加novel_id字段并填充数据');
    console.log('3. 为comment表添加novel_id字段并填充数据');
    
    // 连接数据库
    connection = await mysql.createConnection(dbConfig);
    console.log('数据库连接成功');

    // 读取SQL文件
    const sqlPath = path.join(__dirname, 'add_parent_id_to_review_and_novel_id_fields.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    // 执行SQL
    console.log('\n执行SQL迁移...');
    await connection.query(sql);
    
    console.log('✓ 成功为review表添加parent_id字段');
    console.log('✓ 成功为paragraph_comment表添加novel_id字段并填充数据');
    console.log('✓ 成功为comment表添加novel_id字段并填充数据');
    
    // 验证迁移结果
    console.log('\n验证迁移结果...');
    
    // 检查review表的parent_id字段
    const [reviewColumns] = await connection.query(
      `SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT, COLUMN_COMMENT
       FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = ? 
       AND TABLE_NAME = 'review' 
       AND COLUMN_NAME = 'parent_id'`,
      [dbConfig.database]
    );
    
    if (reviewColumns.length > 0) {
      console.log('✓ review表的parent_id字段已添加');
    } else {
      console.log('✗ review表的parent_id字段添加失败');
    }
    
    // 检查paragraph_comment表的novel_id字段
    const [paragraphColumns] = await connection.query(
      `SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT, COLUMN_COMMENT
       FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = ? 
       AND TABLE_NAME = 'paragraph_comment' 
       AND COLUMN_NAME = 'novel_id'`,
      [dbConfig.database]
    );
    
    if (paragraphColumns.length > 0) {
      console.log('✓ paragraph_comment表的novel_id字段已添加');
      
      // 检查填充的数据
      const [paragraphStats] = await connection.query(
        `SELECT 
          COUNT(*) as total,
          COUNT(novel_id) as filled,
          COUNT(*) - COUNT(novel_id) as null_count
         FROM paragraph_comment`
      );
      console.log(`  - 总记录数: ${paragraphStats[0].total}`);
      console.log(`  - 已填充novel_id: ${paragraphStats[0].filled}`);
      console.log(`  - 未填充novel_id: ${paragraphStats[0].null_count}`);
    } else {
      console.log('✗ paragraph_comment表的novel_id字段添加失败');
    }
    
    // 检查comment表的novel_id字段
    const [commentColumns] = await connection.query(
      `SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT, COLUMN_COMMENT
       FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = ? 
       AND TABLE_NAME = 'comment' 
       AND COLUMN_NAME = 'novel_id'`,
      [dbConfig.database]
    );
    
    if (commentColumns.length > 0) {
      console.log('✓ comment表的novel_id字段已添加');
      
      // 检查填充的数据
      const [commentStats] = await connection.query(
        `SELECT 
          COUNT(*) as total,
          COUNT(CASE WHEN target_type = 'chapter' THEN novel_id END) as chapter_filled,
          COUNT(CASE WHEN target_type = 'chapter' AND novel_id IS NULL THEN 1 END) as chapter_null
         FROM comment
         WHERE target_type = 'chapter'`
      );
      console.log(`  - target_type=chapter的总记录数: ${commentStats[0].total || 0}`);
      console.log(`  - 已填充novel_id: ${commentStats[0].chapter_filled || 0}`);
      console.log(`  - 未填充novel_id: ${commentStats[0].chapter_null || 0}`);
    } else {
      console.log('✗ comment表的novel_id字段添加失败');
    }
    
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

