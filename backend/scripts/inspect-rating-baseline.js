/**
 * 临时脚本：检查小说评价系统相关表的数据情况
 * 只做只读统计，不修改任何数据
 * 
 * 使用方法：
 * node backend/scripts/inspect-rating-baseline.js
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

const outputFile = path.join(__dirname, 'inspect-rating-baseline-output.json');

async function inspectDatabase() {
  let db;
  const results = {
    timestamp: new Date().toISOString(),
    tables: {}
  };

  try {
    console.log('🔌 正在连接数据库...');
    db = await mysql.createConnection(dbConfig);
    console.log('✅ 数据库连接成功\n');

    // 1. 检查 novel 表
    console.log('📊 检查 novel 表...');
    const [novelCount] = await db.execute('SELECT COUNT(*) as count FROM novel');
    const [novelRatingStats] = await db.execute(`
      SELECT 
        COUNT(*) as total,
        COUNT(rating) as has_rating,
        COUNT(reviews) as has_reviews,
        AVG(rating) as avg_rating,
        MIN(rating) as min_rating,
        MAX(rating) as max_rating,
        SUM(reviews) as total_reviews
      FROM novel
    `);
    results.tables.novel = {
      total_rows: novelCount[0].count,
      rating_stats: novelRatingStats[0]
    };
    console.log(`  总小说数: ${novelCount[0].count}`);
    console.log(`  有评分的: ${novelRatingStats[0].has_rating}`);
    console.log(`  有评论数的: ${novelRatingStats[0].has_reviews}`);
    console.log(`  平均评分: ${novelRatingStats[0].avg_rating ? parseFloat(novelRatingStats[0].avg_rating).toFixed(2) : 'N/A'}`);
    console.log(`  总评论数: ${novelRatingStats[0].total_reviews || 0}\n`);

    // 2. 检查 review 表
    console.log('📊 检查 review 表...');
    const [reviewCount] = await db.execute('SELECT COUNT(*) as count FROM review');
    const [reviewRatingStats] = await db.execute(`
      SELECT 
        COUNT(*) as total,
        COUNT(rating) as has_rating,
        AVG(rating) as avg_rating,
        MIN(rating) as min_rating,
        MAX(rating) as max_rating,
        SUM(likes) as total_likes,
        SUM(comments) as total_comments,
        SUM(views) as total_views,
        SUM(is_recommended) as recommended_count
      FROM review
    `);
    results.tables.review = {
      total_rows: reviewCount[0].count,
      rating_stats: reviewRatingStats[0]
    };
    console.log(`  总评价数: ${reviewCount[0].count}`);
    console.log(`  有评分的: ${reviewRatingStats[0].has_rating}`);
    console.log(`  平均评分: ${reviewRatingStats[0].avg_rating ? parseFloat(reviewRatingStats[0].avg_rating).toFixed(2) : 'N/A'}`);
    console.log(`  总点赞数: ${reviewRatingStats[0].total_likes || 0}`);
    console.log(`  总回复数: ${reviewRatingStats[0].total_comments || 0}`);
    console.log(`  推荐数: ${reviewRatingStats[0].recommended_count || 0}\n`);

    // 3. 检查 comment 表
    console.log('📊 检查 comment 表...');
    const [commentCount] = await db.execute('SELECT COUNT(*) as count FROM comment');
    const [commentTypeStats] = await db.execute(`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN target_type = 'novel' THEN 1 END) as novel_comments,
        COUNT(CASE WHEN target_type = 'chapter' THEN 1 END) as chapter_comments,
        COUNT(CASE WHEN target_type = 'paragraph' THEN 1 END) as paragraph_comments,
        COUNT(CASE WHEN target_type = 'review' THEN 1 END) as review_comments,
        SUM(likes) as total_likes
      FROM comment
    `);
    results.tables.comment = {
      total_rows: commentCount[0].count,
      type_stats: commentTypeStats[0]
    };
    console.log(`  总评论数: ${commentCount[0].count}`);
    console.log(`  小说评论: ${commentTypeStats[0].novel_comments || 0}`);
    console.log(`  章节评论: ${commentTypeStats[0].chapter_comments || 0}`);
    console.log(`  段落评论: ${commentTypeStats[0].paragraph_comments || 0}`);
    console.log(`  评价回复: ${commentTypeStats[0].review_comments || 0}`);
    console.log(`  总点赞数: ${commentTypeStats[0].total_likes || 0}\n`);

    // 4. 检查 chapter 表
    console.log('📊 检查 chapter 表...');
    const [chapterCount] = await db.execute('SELECT COUNT(*) as count FROM chapter');
    results.tables.chapter = {
      total_rows: chapterCount[0].count
    };
    console.log(`  总章节数: ${chapterCount[0].count}\n`);

    // 5. 检查 reading_log 表
    console.log('📊 检查 reading_log 表...');
    const [readingLogCount] = await db.execute('SELECT COUNT(*) as count FROM reading_log');
    results.tables.reading_log = {
      total_rows: readingLogCount[0].count
    };
    console.log(`  总阅读记录数: ${readingLogCount[0].count}\n`);

    // 6. 检查 favorite 表
    console.log('📊 检查 favorite 表...');
    const [favoriteCount] = await db.execute('SELECT COUNT(*) as count FROM favorite');
    results.tables.favorite = {
      total_rows: favoriteCount[0].count
    };
    console.log(`  总收藏数: ${favoriteCount[0].count}\n`);

    // 7. 检查 user 表
    console.log('📊 检查 user 表...');
    const [userCount] = await db.execute('SELECT COUNT(*) as count FROM user');
    results.tables.user = {
      total_rows: userCount[0].count
    };
    console.log(`  总用户数: ${userCount[0].count}\n`);

    // 8. 检查 review_like 表（如果存在）
    try {
      const [reviewLikeCount] = await db.execute('SELECT COUNT(*) as count FROM review_like');
      results.tables.review_like = {
        total_rows: reviewLikeCount[0].count,
        exists: true
      };
      console.log(`  review_like 表存在，总点赞记录数: ${reviewLikeCount[0].count}\n`);
    } catch (error) {
      results.tables.review_like = {
        exists: false,
        error: error.message
      };
      console.log(`  review_like 表不存在或查询失败\n`);
    }

    // 9. 检查 review_dislike 表（如果存在）
    try {
      const [reviewDislikeCount] = await db.execute('SELECT COUNT(*) as count FROM review_dislike');
      results.tables.review_dislike = {
        total_rows: reviewDislikeCount[0].count,
        exists: true
      };
      console.log(`  review_dislike 表存在，总点踩记录数: ${reviewDislikeCount[0].count}\n`);
    } catch (error) {
      results.tables.review_dislike = {
        exists: false,
        error: error.message
      };
      console.log(`  review_dislike 表不存在或查询失败\n`);
    }

    // 保存结果到文件
    fs.writeFileSync(outputFile, JSON.stringify(results, null, 2), 'utf8');
    console.log(`\n✅ 统计完成！结果已保存到: ${outputFile}`);

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
inspectDatabase()
  .then(() => {
    console.log('\n✨ 脚本执行完成');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ 脚本执行失败:', error);
    process.exit(1);
  });

