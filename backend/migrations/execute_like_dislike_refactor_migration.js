/**
 * 执行点赞/点踩系统重构迁移
 * 合并 review_dislike / comment_dislike 到 review_like / comment_like
 */

const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '123456',
  database: process.env.DB_NAME || 'kongfuworld',
  charset: 'utf8mb4',
  multipleStatements: true  // 允许执行多条 SQL 语句
};

const migrationFile = path.join(__dirname, '200_add_is_like_to_review_comment_like.sql');

async function executeMigration() {
  let db;

  try {
    console.log('🔌 正在连接数据库...');
    db = await mysql.createConnection(dbConfig);
    console.log('✅ 数据库连接成功\n');

    // 读取迁移文件
    console.log('📖 读取迁移文件...');
    const sql = fs.readFileSync(migrationFile, 'utf8');
    console.log('✅ 迁移文件读取成功\n');

    // 检查表是否存在
    console.log('🔍 检查表是否存在...');
    const [tables] = await db.execute(
      `SELECT TABLE_NAME 
       FROM INFORMATION_SCHEMA.TABLES 
       WHERE TABLE_SCHEMA = ? 
       AND TABLE_NAME IN ('review_like', 'review_dislike', 'comment_like', 'comment_dislike')`,
      [dbConfig.database]
    );

    const existingTables = tables.map(t => t.TABLE_NAME);
    console.log('  存在的表:', existingTables.join(', '));

    if (!existingTables.includes('review_like')) {
      throw new Error('review_like 表不存在，无法执行迁移');
    }
    if (!existingTables.includes('comment_like')) {
      throw new Error('comment_like 表不存在，无法执行迁移');
    }

    // 检查是否已经有 is_like 字段
    const [reviewLikeColumns] = await db.execute(
      `SELECT COLUMN_NAME 
       FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'review_like' AND COLUMN_NAME = 'is_like'`,
      [dbConfig.database]
    );

    if (reviewLikeColumns.length > 0) {
      console.log('⚠️  review_like 表已经有 is_like 字段，跳过添加字段步骤');
    }

    // 执行迁移
    console.log('\n🚀 开始执行迁移...');
    await db.query(sql);
    console.log('✅ 迁移执行成功\n');

    // 验证迁移结果
    console.log('🔍 验证迁移结果...');

    // 检查 is_like 字段是否添加成功
    const [reviewLikeCols] = await db.execute(
      `SELECT COLUMN_NAME, COLUMN_TYPE, COLUMN_DEFAULT
       FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'review_like' AND COLUMN_NAME = 'is_like'`,
      [dbConfig.database]
    );

    if (reviewLikeCols.length > 0) {
      console.log(`  ✅ review_like.is_like 字段已添加: ${reviewLikeCols[0].COLUMN_TYPE}, 默认值: ${reviewLikeCols[0].COLUMN_DEFAULT}`);
    } else {
      console.log('  ⚠️  review_like.is_like 字段未找到');
    }

    const [commentLikeCols] = await db.execute(
      `SELECT COLUMN_NAME, COLUMN_TYPE, COLUMN_DEFAULT
       FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'comment_like' AND COLUMN_NAME = 'is_like'`,
      [dbConfig.database]
    );

    if (commentLikeCols.length > 0) {
      console.log(`  ✅ comment_like.is_like 字段已添加: ${commentLikeCols[0].COLUMN_TYPE}, 默认值: ${commentLikeCols[0].COLUMN_DEFAULT}`);
    } else {
      console.log('  ⚠️  comment_like.is_like 字段未找到');
    }

    // 检查旧表是否已删除
    const [remainingTables] = await db.execute(
      `SELECT TABLE_NAME 
       FROM INFORMATION_SCHEMA.TABLES 
       WHERE TABLE_SCHEMA = ? 
       AND TABLE_NAME IN ('review_dislike', 'comment_dislike')`,
      [dbConfig.database]
    );

    if (remainingTables.length === 0) {
      console.log('  ✅ review_dislike 和 comment_dislike 表已删除');
    } else {
      console.log(`  ⚠️  以下表仍然存在: ${remainingTables.map(t => t.TABLE_NAME).join(', ')}`);
    }

    // 统计迁移后的数据
    const [reviewLikeStats] = await db.execute(
      `SELECT 
         COUNT(*) as total,
         SUM(CASE WHEN is_like = 1 THEN 1 ELSE 0 END) as likes,
         SUM(CASE WHEN is_like = 0 THEN 1 ELSE 0 END) as dislikes
       FROM review_like`
    );

    const [commentLikeStats] = await db.execute(
      `SELECT 
         COUNT(*) as total,
         SUM(CASE WHEN is_like = 1 THEN 1 ELSE 0 END) as likes,
         SUM(CASE WHEN is_like = 0 THEN 1 ELSE 0 END) as dislikes
       FROM comment_like`
    );

    console.log('\n📊 迁移后数据统计:');
    console.log(`  review_like: 总计 ${reviewLikeStats[0].total}, 点赞 ${reviewLikeStats[0].likes}, 点踩 ${reviewLikeStats[0].dislikes}`);
    console.log(`  comment_like: 总计 ${commentLikeStats[0].total}, 点赞 ${commentLikeStats[0].likes}, 点踩 ${commentLikeStats[0].dislikes}`);

    console.log('\n✅ 迁移完成！');

  } catch (error) {
    console.error('\n❌ 迁移失败:', error);
    console.error('错误详情:', error.message);
    if (error.sql) {
      console.error('SQL:', error.sql);
    }
    throw error;
  } finally {
    if (db) {
      await db.end();
      console.log('\n🔌 数据库连接已关闭');
    }
  }
}

// 执行迁移
executeMigration()
  .then(() => {
    console.log('\n✨ 脚本执行完成');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ 脚本执行失败:', error);
    process.exit(1);
  });

