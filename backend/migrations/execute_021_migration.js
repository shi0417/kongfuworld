/**
 * 迁移脚本021：为 admin 表添加邮箱、手机号、真实姓名字段，并创建 admin_payout_account 表
 * 执行命令：node execute_021_migration.js
 */

const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

const dbConfig = {
  host: 'localhost',
  user: 'root',
  password: '123456',
  database: 'kongfuworld',
  charset: 'utf8mb4'
};

async function executeMigration() {
  let connection;
  try {
    console.log('开始执行迁移021：admin 表扩展 + admin_payout_account 表创建\n');
    
    connection = await mysql.createConnection(dbConfig);
    console.log('✓ 数据库连接成功\n');

    // 读取 SQL 文件
    const sqlFile = path.join(__dirname, '021_add_admin_email_and_payout_account.sql');
    const sql = fs.readFileSync(sqlFile, 'utf8');
    
    // 分割 SQL 语句（按分号分割，并过滤注释）
    const statements = sql
      .split(';')
      .map(s => {
        // 移除行注释（-- 开头的行）
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
        if (error.code === 'ER_DUP_FIELDNAME' || error.code === 'ER_DUP_KEYNAME') {
          console.log(`⏭️  [${i + 1}/${statements.length}] 跳过：字段或索引已存在\n`);
          continue;
        }
        // 如果是表已存在的错误，跳过
        if (error.code === 'ER_TABLE_EXISTS_ERROR') {
          console.log(`⏭️  [${i + 1}/${statements.length}] 跳过：表已存在\n`);
          continue;
        }
        throw error;
      }
    }

    // 验证迁移结果
    console.log('\n验证迁移结果：\n');

    // 检查 admin 表字段
    const [adminColumns] = await connection.query(`
      SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_COMMENT
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = 'kongfuworld' 
        AND TABLE_NAME = 'admin'
        AND COLUMN_NAME IN ('email', 'phone', 'real_name')
      ORDER BY ORDINAL_POSITION
    `);

    console.log('✓ admin 表新增字段：');
    adminColumns.forEach(col => {
      console.log(`  - ${col.COLUMN_NAME}: ${col.COLUMN_TYPE} (${col.IS_NULLABLE === 'YES' ? '可空' : '非空'}) - ${col.COLUMN_COMMENT || ''}`);
    });

    // 检查 email 唯一索引
    const [emailIndex] = await connection.query(`
      SELECT INDEX_NAME, COLUMN_NAME
      FROM INFORMATION_SCHEMA.STATISTICS
      WHERE TABLE_SCHEMA = 'kongfuworld'
        AND TABLE_NAME = 'admin'
        AND INDEX_NAME = 'uniq_admin_email'
    `);

    if (emailIndex.length > 0) {
      console.log('\n✓ email 唯一索引已创建');
    }

    // 检查 admin_payout_account 表
    const [payoutTable] = await connection.query(`
      SELECT TABLE_NAME
      FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_SCHEMA = 'kongfuworld'
        AND TABLE_NAME = 'admin_payout_account'
    `);

    if (payoutTable.length > 0) {
      console.log('\n✓ admin_payout_account 表已创建');
      
      const [payoutColumns] = await connection.query(`
        SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_COMMENT
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = 'kongfuworld'
          AND TABLE_NAME = 'admin_payout_account'
        ORDER BY ORDINAL_POSITION
      `);
      
      console.log('\n  admin_payout_account 表字段：');
      payoutColumns.forEach(col => {
        console.log(`    - ${col.COLUMN_NAME}: ${col.COLUMN_TYPE} (${col.IS_NULLABLE === 'YES' ? '可空' : '非空'})`);
      });
    }

    console.log('\n✅ 迁移021执行完成！');
    
  } catch (error) {
    console.error('\n❌ 迁移失败:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n数据库连接已关闭');
    }
  }
}

executeMigration();

