/**
 * 验证点赞/点踩重构后的数据一致性
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

async function verifyRefactor() {
  let db;

  const results = {
    timestamp: new Date().toISOString(),
    review: {
      total_checked: 0,
      inconsistent: [],
      total_inconsistent: 0
    },
    comment: {
      total_checked: 0,
      inconsistent: [],
      total_inconsistent: 0
    }
  };

  try {
    console.log('🔌 正在连接数据库...');
    db = await mysql.createConnection(dbConfig);
    console.log('✅ 数据库连接成功\n');

    // 1. 检查 review 表的一致性
    console.log('📊 检查 review 表的一致性...');
    try {
      const [reviews] = await db.execute('SELECT id, likes, dislikes FROM review');
      results.review.total_checked = reviews.length;

      for (const review of reviews) {
        // 从 review_like 聚合计算
        const [statRows] = await db.execute(
          `SELECT 
             SUM(CASE WHEN is_like = 1 THEN 1 ELSE 0 END) AS like_count,
             SUM(CASE WHEN is_like = 0 THEN 1 ELSE 0 END) AS dislike_count
           FROM review_like
           WHERE review_id = ?`,
          [review.id]
        );

        const actualLikes = Number(statRows[0].like_count) || 0;
        const actualDislikes = Number(statRows[0].dislike_count) || 0;
        const storedLikes = Number(review.likes) || 0;
        const storedDislikes = Number(review.dislikes) || 0;

        if (actualLikes !== storedLikes || actualDislikes !== storedDislikes) {
          results.review.inconsistent.push({
            review_id: review.id,
            stored_likes: storedLikes,
            actual_likes: actualLikes,
            stored_dislikes: storedDislikes,
            actual_dislikes: actualDislikes,
            likes_diff: actualLikes - storedLikes,
            dislikes_diff: actualDislikes - storedDislikes
          });
          results.review.total_inconsistent++;
        }
      }

      console.log(`  检查了 ${reviews.length} 条 review 记录`);
      console.log(`  发现 ${results.review.total_inconsistent} 条不一致记录`);
      if (results.review.inconsistent.length > 0) {
        console.log('  前5条不一致示例:');
        results.review.inconsistent.slice(0, 5).forEach(item => {
          console.log(`    Review ID ${item.review_id}: likes(${item.stored_likes} vs ${item.actual_likes}), dislikes(${item.stored_dislikes} vs ${item.actual_dislikes})`);
        });
      }
      console.log('');
    } catch (error) {
      console.log(`  ⚠️  检查 review 表失败: ${error.message}\n`);
      results.review.error = error.message;
    }

    // 2. 检查 comment 表的一致性
    console.log('📊 检查 comment 表的一致性...');
    try {
      const [comments] = await db.execute('SELECT id, likes, dislikes FROM comment');
      results.comment.total_checked = comments.length;

      for (const comment of comments) {
        // 从 comment_like 聚合计算
        const [statRows] = await db.execute(
          `SELECT 
             SUM(CASE WHEN is_like = 1 THEN 1 ELSE 0 END) AS like_count,
             SUM(CASE WHEN is_like = 0 THEN 1 ELSE 0 END) AS dislike_count
           FROM comment_like
           WHERE comment_id = ?`,
          [comment.id]
        );

        const actualLikes = Number(statRows[0].like_count) || 0;
        const actualDislikes = Number(statRows[0].dislike_count) || 0;
        const storedLikes = Number(comment.likes) || 0;
        const storedDislikes = Number(comment.dislikes) || 0;

        if (actualLikes !== storedLikes || actualDislikes !== storedDislikes) {
          results.comment.inconsistent.push({
            comment_id: comment.id,
            stored_likes: storedLikes,
            actual_likes: actualLikes,
            stored_dislikes: storedDislikes,
            actual_dislikes: actualDislikes,
            likes_diff: actualLikes - storedLikes,
            dislikes_diff: actualDislikes - storedDislikes
          });
          results.comment.total_inconsistent++;
        }
      }

      console.log(`  检查了 ${comments.length} 条 comment 记录`);
      console.log(`  发现 ${results.comment.total_inconsistent} 条不一致记录`);
      if (results.comment.inconsistent.length > 0) {
        console.log('  前5条不一致示例:');
        results.comment.inconsistent.slice(0, 5).forEach(item => {
          console.log(`    Comment ID ${item.comment_id}: likes(${item.stored_likes} vs ${item.actual_likes}), dislikes(${item.stored_dislikes} vs ${item.actual_dislikes})`);
        });
      }
      console.log('');
    } catch (error) {
      console.log(`  ⚠️  检查 comment 表失败: ${error.message}\n`);
      results.comment.error = error.message;
    }

    // 3. 检查旧表是否已删除
    console.log('🔍 检查旧表是否已删除...');
    try {
      const [tables] = await db.execute(
        `SELECT TABLE_NAME 
         FROM INFORMATION_SCHEMA.TABLES 
         WHERE TABLE_SCHEMA = ? 
         AND TABLE_NAME IN ('review_dislike', 'comment_dislike')`,
        [dbConfig.database]
      );

      if (tables.length === 0) {
        console.log('  ✅ review_dislike 和 comment_dislike 表已删除');
      } else {
        console.log(`  ⚠️  以下表仍然存在: ${tables.map(t => t.TABLE_NAME).join(', ')}`);
      }
      console.log('');
    } catch (error) {
      console.log(`  ⚠️  检查表失败: ${error.message}\n`);
    }

    // 4. 统计 summary
    console.log('📊 总结:');
    console.log(`  review 表: ${results.review.total_checked} 条记录，${results.review.total_inconsistent} 条不一致`);
    console.log(`  comment 表: ${results.comment.total_checked} 条记录，${results.comment.total_inconsistent} 条不一致`);

    if (results.review.total_inconsistent === 0 && results.comment.total_inconsistent === 0) {
      console.log('\n✅ 所有数据一致！重构成功！');
    } else {
      console.log('\n⚠️  发现不一致数据，请检查');
    }

    return results;

  } catch (error) {
    console.error('\n❌ 验证失败:', error);
    console.error('错误详情:', error.message);
    throw error;
  } finally {
    if (db) {
      await db.end();
      console.log('\n🔌 数据库连接已关闭');
    }
  }
}

// 执行验证
verifyRefactor()
  .then(() => {
    console.log('\n✨ 脚本执行完成');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ 脚本执行失败:', error);
    process.exit(1);
  });

