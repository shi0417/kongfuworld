/**
 * 临时脚本：确认表结构，用于重构前的验证
 * 只做只读查询，不修改任何数据
 */

const mysql = require('mysql2/promise');

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '123456',
  database: process.env.DB_NAME || 'kongfuworld',
  charset: 'utf8mb4'
};

async function checkTableStructures() {
  let db;

  try {
    console.log('🔌 正在连接数据库...');
    db = await mysql.createConnection(dbConfig);
    console.log('✅ 数据库连接成功\n');

    const tables = [
      'review_like',
      'review_dislike',
      'comment_like',
      'comment_dislike',
      'paragraph_comment_like',
      'review',
      'comment'
    ];

    const results = {};

    for (const tableName of tables) {
      try {
        // 检查表是否存在
        const [tableExists] = await db.execute(
          `SELECT COUNT(*) as count FROM information_schema.tables 
           WHERE table_schema = ? AND table_name = ?`,
          [dbConfig.database, tableName]
        );

        if (tableExists[0].count === 0) {
          results[tableName] = { exists: false };
          console.log(`⚠️  表 ${tableName} 不存在\n`);
          continue;
        }

        // 获取表结构
        const [createTable] = await db.execute(`SHOW CREATE TABLE ${tableName}`);
        const createTableSql = createTable[0]['Create Table'];

        // 获取字段信息
        const [columns] = await db.execute(
          `SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT, COLUMN_COMMENT
           FROM information_schema.COLUMNS 
           WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
           ORDER BY ORDINAL_POSITION`,
          [dbConfig.database, tableName]
        );

        // 获取索引信息
        const [indexes] = await db.execute(
          `SHOW INDEX FROM ${tableName}`
        );

        results[tableName] = {
          exists: true,
          createTable: createTableSql,
          columns: columns,
          indexes: indexes
        };

        console.log(`\n📋 表 ${tableName} 结构：`);
        console.log('字段：');
        columns.forEach(col => {
          console.log(`  - ${col.COLUMN_NAME}: ${col.COLUMN_TYPE} ${col.IS_NULLABLE === 'YES' ? 'NULL' : 'NOT NULL'} ${col.COLUMN_DEFAULT ? `DEFAULT ${col.COLUMN_DEFAULT}` : ''} ${col.COLUMN_COMMENT ? `(${col.COLUMN_COMMENT})` : ''}`);
        });
        console.log('索引：');
        indexes.forEach(idx => {
          console.log(`  - ${idx.Key_name}: ${idx.Column_name} (${idx.Non_unique === 0 ? 'UNIQUE' : 'NON-UNIQUE'})`);
        });
        console.log('');

      } catch (error) {
        console.error(`❌ 检查表 ${tableName} 失败:`, error.message);
        results[tableName] = { exists: false, error: error.message };
      }
    }

    // 检查关键字段
    console.log('\n🔍 关键字段检查：');
    
    // 检查 review 表是否有 dislikes 字段
    if (results.review && results.review.exists) {
      const hasDislikes = results.review.columns.some(col => col.COLUMN_NAME === 'dislikes');
      console.log(`  review.dislikes: ${hasDislikes ? '✅ 存在' : '❌ 不存在'}`);
    }

    // 检查 comment 表是否有 dislikes 字段
    if (results.comment && results.comment.exists) {
      const hasDislikes = results.comment.columns.some(col => col.COLUMN_NAME === 'dislikes');
      console.log(`  comment.dislikes: ${hasDislikes ? '✅ 存在' : '❌ 不存在'}`);
    }

    // 检查 review_like 表是否有 is_like 字段
    if (results.review_like && results.review_like.exists) {
      const hasIsLike = results.review_like.columns.some(col => col.COLUMN_NAME === 'is_like');
      console.log(`  review_like.is_like: ${hasIsLike ? '✅ 已存在' : '❌ 不存在（需要添加）'}`);
    }

    // 检查 comment_like 表是否有 is_like 字段
    if (results.comment_like && results.comment_like.exists) {
      const hasIsLike = results.comment_like.columns.some(col => col.COLUMN_NAME === 'is_like');
      console.log(`  comment_like.is_like: ${hasIsLike ? '✅ 已存在' : '❌ 不存在（需要添加）'}`);
    }

    // 检查 paragraph_comment_like 表结构（作为参考）
    if (results.paragraph_comment_like && results.paragraph_comment_like.exists) {
      const hasIsLike = results.paragraph_comment_like.columns.some(col => col.COLUMN_NAME === 'is_like');
      console.log(`  paragraph_comment_like.is_like: ${hasIsLike ? '✅ 存在（参考实现）' : '❌ 不存在'}`);
    }

    console.log('\n✅ 表结构检查完成');

    return results;

  } catch (error) {
    console.error('\n❌ 检查失败:', error);
    console.error('错误详情:', error.message);
    throw error;
  } finally {
    if (db) {
      await db.end();
      console.log('\n🔌 数据库连接已关闭');
    }
  }
}

// 执行检查
checkTableStructures()
  .then(() => {
    console.log('\n✨ 脚本执行完成');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ 脚本执行失败:', error);
    process.exit(1);
  });

