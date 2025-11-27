/**
 * 执行迁移脚本：023_add_chapter_chief_editor_admin_id.sql
 * 为 chapter 表添加 chief_editor_admin_id 字段
 */
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

async function executeMigration() {
  let connection;
  try {
    console.log('开始执行迁移023：chapter 表添加 chief_editor_admin_id 字段\n');

    connection = await mysql.createConnection(dbConfig);
    console.log('✓ 数据库连接成功\n');

    // 读取 SQL 文件
    const sqlFile = path.join(__dirname, '023_add_chapter_chief_editor_admin_id.sql');
    const sql = fs.readFileSync(sqlFile, 'utf8');

    // 分割 SQL 语句
    const statements = sql
      .split(';')
      .map(s => {
        const lines = s.split('\n').filter(line => {
          const trimmed = line.trim();
          return trimmed.length > 0 && !trimmed.startsWith('--');
        });
        return lines.join('\n').trim();
      })
      .filter(s => s.length > 0);

    console.log(`共找到 ${statements.length} 条 SQL 语句\n`);

    // 执行每条 SQL
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (!statement || statement.trim().length === 0) continue;

      try {
        console.log(`[${i + 1}/${statements.length}] 执行: ${statement.substring(0, 60)}...`);
        await connection.query(statement);
        console.log(`✓ [${i + 1}/${statements.length}] 执行成功\n`);
      } catch (error) {
        // 如果是字段已存在的错误，跳过
        if (error.code === 'ER_DUP_FIELDNAME' || error.code === 'Duplicate column name') {
          console.log(`⏭️  [${i + 1}/${statements.length}] 跳过：字段已存在\n`);
        } else if (error.code === 'ER_DUP_KEYNAME' || error.code === 'Duplicate key name') {
          console.log(`⏭️  [${i + 1}/${statements.length}] 跳过：索引已存在\n`);
        } else if (error.code === 'ER_DUP_KEY' || error.message.includes('Duplicate key')) {
          console.log(`⏭️  [${i + 1}/${statements.length}] 跳过：约束已存在\n`);
        } else {
          throw error;
        }
      }
    }

    // 验证迁移结果
    console.log('\n验证迁移结果：\n');
    const [columns] = await connection.execute(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = DATABASE() 
       AND TABLE_NAME = 'chapter' 
       AND COLUMN_NAME = 'chief_editor_admin_id'`
    );
    if (columns.length > 0) {
      console.log('✓ chief_editor_admin_id 字段已创建\n');
    } else {
      console.log('⚠️  chief_editor_admin_id 字段未找到\n');
    }

    console.log('✅ 迁移023执行完成！\n');
  } catch (error) {
    console.error('❌ 迁移失败:', error);
    throw error;
  } finally {
    if (connection) {
      await connection.end();
      console.log('数据库连接已关闭');
    }
  }
}

executeMigration().catch(console.error);

