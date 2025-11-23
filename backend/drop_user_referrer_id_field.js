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

async function dropUserReferrerIdField() {
  let db;
  try {
    console.log('开始删除 user 表中的 referrer_id 字段...');
    db = await mysql.createConnection(dbConfig);
    console.log('✅ 数据库连接成功');

    // 检查字段是否存在
    const [columns] = await db.execute(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'user' AND COLUMN_NAME = 'referrer_id'
    `, [dbConfig.database]);

    if (columns.length === 0) {
      console.log('⚠️ referrer_id 字段不存在，无需删除');
      return;
    }

    console.log('📋 找到 referrer_id 字段，准备删除...');

    // 检查并删除外键约束
    const [fks] = await db.execute(`
      SELECT CONSTRAINT_NAME 
      FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
      WHERE TABLE_SCHEMA = ? 
        AND TABLE_NAME = 'user' 
        AND COLUMN_NAME = 'referrer_id'
        AND REFERENCED_TABLE_NAME IS NOT NULL
    `, [dbConfig.database]);

    if (fks.length > 0) {
      for (const fk of fks) {
        console.log(`   删除外键约束: ${fk.CONSTRAINT_NAME}`);
        await db.execute(`ALTER TABLE \`user\` DROP FOREIGN KEY \`${fk.CONSTRAINT_NAME}\``);
      }
      console.log('✅ 外键约束删除成功');
    }

    // 检查并删除索引
    const [indexes] = await db.execute(`
      SELECT INDEX_NAME 
      FROM INFORMATION_SCHEMA.STATISTICS
      WHERE TABLE_SCHEMA = ? 
        AND TABLE_NAME = 'user' 
        AND COLUMN_NAME = 'referrer_id'
        AND INDEX_NAME != 'PRIMARY'
    `, [dbConfig.database]);

    if (indexes.length > 0) {
      for (const idx of indexes) {
        console.log(`   删除索引: ${idx.INDEX_NAME}`);
        await db.execute(`ALTER TABLE \`user\` DROP INDEX \`${idx.INDEX_NAME}\``);
      }
      console.log('✅ 索引删除成功');
    }

    // 删除字段
    console.log('   删除 referrer_id 字段...');
    await db.execute('ALTER TABLE `user` DROP COLUMN `referrer_id`');
    console.log('✅ referrer_id 字段删除成功');

    // 验证删除结果
    const [verifyColumns] = await db.execute(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'user' AND COLUMN_NAME = 'referrer_id'
    `, [dbConfig.database]);

    if (verifyColumns.length === 0) {
      console.log('✅ 确认：referrer_id 字段已成功删除');
    } else {
      console.error('❌ 确认失败：referrer_id 字段仍然存在');
    }

  } catch (error) {
    console.error('❌ 删除 referrer_id 字段失败:', error.message);
    console.error('详细错误:', error);
  } finally {
    if (db) {
      await db.end();
      console.log('数据库连接已关闭');
    }
    console.log('\n✅ 操作完成');
  }
}

dropUserReferrerIdField();

