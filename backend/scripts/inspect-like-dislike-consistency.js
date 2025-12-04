/**
 * 临时脚本：检查点赞/点踩数据一致性
 * 只做只读统计，不修改任何数据
 * 
 * 使用方法：
 * node backend/scripts/inspect-like-dislike-consistency.js
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

const outputFile = path.join(__dirname, 'inspect-like-dislike-consistency-output.json');

async function inspectConsistency() {
  let db;
  const results = {
    timestamp: new Date().toISOString(),
    review: {
      inconsistencies: [],
      total_checked: 0,
      total_inconsistent: 0
    },
    comment: {
      inconsistencies: [],
      total_checked: 0,
      total_inconsistent: 0
    },
    paragraph_comment: {
      inconsistencies: [],
      total_checked: 0,
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
      // 检查 review_like 和 review_dislike 表是否存在
      const [reviewLikes] = await db.execute('SELECT COUNT(*) as count FROM review_like');
      const [reviewDislikes] = await db.execute('SELECT COUNT(*) as count FROM review_dislike');
      
      // 获取所有 review 记录
      const [reviews] = await db.execute('SELECT id, likes, dislikes FROM review');
      results.review.total_checked = reviews.length;
      
      for (const review of reviews) {
        // 统计明细表中的实际数量
        const [likeCount] = await db.execute(
          'SELECT COUNT(*) as count FROM review_like WHERE review_id = ?',
          [review.id]
        );
        const [dislikeCount] = await db.execute(
          'SELECT COUNT(*) as count FROM review_dislike WHERE review_id = ?',
          [review.id]
        );
        
        const actualLikes = likeCount[0].count;
        const actualDislikes = dislikeCount[0].count;
        const storedLikes = review.likes || 0;
        const storedDislikes = review.dislikes || 0;
        
        // 检查是否一致
        if (actualLikes !== storedLikes || actualDislikes !== storedDislikes) {
          results.review.inconsistencies.push({
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
      if (results.review.inconsistencies.length > 0) {
        console.log('  前5条不一致示例:');
        results.review.inconsistencies.slice(0, 5).forEach(item => {
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
      // 检查 comment_like 和 comment_dislike 表是否存在
      const [commentLikes] = await db.execute('SELECT COUNT(*) as count FROM comment_like');
      const [commentDislikes] = await db.execute('SELECT COUNT(*) as count FROM comment_dislike');
      
      // 获取所有 comment 记录（检查是否有 dislikes 字段）
      const [columns] = await db.execute(`
        SELECT COLUMN_NAME 
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'comment' AND COLUMN_NAME = 'dislikes'
      `, [dbConfig.database]);
      
      let hasDislikesField = columns.length > 0;
      
      let query = 'SELECT id, likes';
      if (hasDislikesField) {
        query += ', dislikes';
      }
      query += ' FROM comment';
      
      const [comments] = await db.execute(query);
      results.comment.total_checked = comments.length;
      
      for (const comment of comments) {
        // 统计明细表中的实际数量
        const [likeCount] = await db.execute(
          'SELECT COUNT(*) as count FROM comment_like WHERE comment_id = ?',
          [comment.id]
        );
        const [dislikeCount] = await db.execute(
          'SELECT COUNT(*) as count FROM comment_dislike WHERE comment_id = ?',
          [comment.id]
        );
        
        const actualLikes = likeCount[0].count;
        const actualDislikes = dislikeCount[0].count;
        const storedLikes = comment.likes || 0;
        const storedDislikes = hasDislikesField ? (comment.dislikes || 0) : 0;
        
        // 检查是否一致
        if (actualLikes !== storedLikes || actualDislikes !== storedDislikes) {
          results.comment.inconsistencies.push({
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
      if (results.comment.inconsistencies.length > 0) {
        console.log('  前5条不一致示例:');
        results.comment.inconsistencies.slice(0, 5).forEach(item => {
          console.log(`    Comment ID ${item.comment_id}: likes(${item.stored_likes} vs ${item.actual_likes}), dislikes(${item.stored_dislikes} vs ${item.actual_dislikes})`);
        });
      }
      console.log('');
    } catch (error) {
      console.log(`  ⚠️  检查 comment 表失败: ${error.message}\n`);
      results.comment.error = error.message;
    }

    // 3. 检查 paragraph_comment 表的一致性
    console.log('📊 检查 paragraph_comment 表的一致性...');
    try {
      // 检查 paragraph_comment_like 表是否存在
      const [paragraphCommentLikes] = await db.execute('SELECT COUNT(*) as count FROM paragraph_comment_like');
      
      // 获取所有 paragraph_comment 记录
      const [paragraphComments] = await db.execute('SELECT id, like_count, dislike_count FROM paragraph_comment');
      results.paragraph_comment.total_checked = paragraphComments.length;
      
      for (const pc of paragraphComments) {
        // 统计明细表中的实际数量（使用 is_like 字段）
        const [counts] = await db.execute(`
          SELECT 
            SUM(CASE WHEN is_like = 1 THEN 1 ELSE 0 END) as like_count,
            SUM(CASE WHEN is_like = 0 THEN 1 ELSE 0 END) as dislike_count
          FROM paragraph_comment_like 
          WHERE comment_id = ?
        `, [pc.id]);
        
        const actualLikes = counts[0].like_count || 0;
        const actualDislikes = counts[0].dislike_count || 0;
        const storedLikes = pc.like_count || 0;
        const storedDislikes = pc.dislike_count || 0;
        
        // 检查是否一致
        if (actualLikes !== storedLikes || actualDislikes !== storedDislikes) {
          results.paragraph_comment.inconsistencies.push({
            comment_id: pc.id,
            stored_like_count: storedLikes,
            actual_like_count: actualLikes,
            stored_dislike_count: storedDislikes,
            actual_dislike_count: actualDislikes,
            like_count_diff: actualLikes - storedLikes,
            dislike_count_diff: actualDislikes - storedDislikes
          });
          results.paragraph_comment.total_inconsistent++;
        }
      }
      
      console.log(`  检查了 ${paragraphComments.length} 条 paragraph_comment 记录`);
      console.log(`  发现 ${results.paragraph_comment.total_inconsistent} 条不一致记录`);
      if (results.paragraph_comment.inconsistencies.length > 0) {
        console.log('  前5条不一致示例:');
        results.paragraph_comment.inconsistencies.slice(0, 5).forEach(item => {
          console.log(`    Paragraph Comment ID ${item.comment_id}: like_count(${item.stored_like_count} vs ${item.actual_like_count}), dislike_count(${item.stored_dislike_count} vs ${item.actual_dislike_count})`);
        });
      }
      console.log('');
    } catch (error) {
      console.log(`  ⚠️  检查 paragraph_comment 表失败: ${error.message}\n`);
      results.paragraph_comment.error = error.message;
    }

    // 保存结果到文件
    fs.writeFileSync(outputFile, JSON.stringify(results, null, 2), 'utf8');
    console.log(`\n✅ 检查完成！结果已保存到: ${outputFile}`);

  } catch (error) {
    console.error('\n❌ 检查失败:', error);
    console.error('错误详情:', error.message);
    if (error.sql) {
      console.error('SQL:', error.sql);
    }
    process.exit(1);
  } finally {
    if (db) {
      await db.end();
      console.log('\n🔌 数据库连接已关闭');
    }
  }
}

// 执行检查
inspectConsistency()
  .then(() => {
    console.log('\n✨ 脚本执行完成');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ 脚本执行失败:', error);
    process.exit(1);
  });

