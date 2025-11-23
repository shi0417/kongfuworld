// 调试推荐百分比计算问题
const mysql = require('mysql2/promise');

async function debugRecommendationPercentage() {
  try {
    const connection = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: '123456',
      database: 'kongfuworld'
    });

    console.log('🔍 调试推荐百分比计算问题...\n');

    // 获取小说ID 11的评论数据
    const [reviews] = await connection.execute(`
      SELECT 
        r.id,
        r.novel_id,
        r.user_id,
        r.content,
        r.rating,
        r.likes,
        r.comments,
        r.views,
        r.is_recommended,
        r.created_at,
        u.username
      FROM review r
      JOIN user u ON r.user_id = u.id
      WHERE r.novel_id = 11
      ORDER BY r.created_at DESC
    `);

    console.log('📊 小说ID 11的评论数据:');
    reviews.forEach((review, index) => {
      console.log(`\n评论 ${index + 1}:`);
      console.log(`  评论ID: ${review.id}`);
      console.log(`  小说ID: ${review.novel_id}`);
      console.log(`  用户ID: ${review.user_id}`);
      console.log(`  用户名: "${review.username}"`);
      console.log(`  评分: ${review.rating}`);
      console.log(`  推荐状态: ${review.is_recommended} (0=不推荐, 1=推荐)`);
      console.log(`  点赞: ${review.likes}`);
      console.log(`  评论: ${review.comments}`);
      console.log(`  查看: ${review.views}`);
      console.log(`  内容: ${review.content.substring(0, 50)}...`);
    });

    // 计算推荐统计
    const totalReviews = reviews.length;
    const recommendedCount = reviews.filter(r => r.is_recommended === 1).length;
    const recommendationRate = totalReviews > 0 ? 
      Math.round((recommendedCount / totalReviews) * 100) : 0;

    console.log('\n📈 推荐统计计算:');
    console.log(`  总评论数: ${totalReviews}`);
    console.log(`  推荐数: ${recommendedCount}`);
    console.log(`  推荐率: ${recommendationRate}%`);

    // 检查API返回的数据
    console.log('\n🔍 检查API返回的数据:');
    const [stats] = await connection.execute(`
      SELECT 
        COUNT(*) as total_reviews,
        AVG(rating) as average_rating,
        SUM(CASE WHEN is_recommended = 1 THEN 1 ELSE 0 END) as recommended_count,
        SUM(likes) as total_likes
      FROM review 
      WHERE novel_id = 11
    `);

    const stat = stats[0];
    const apiRecommendationRate = stat.total_reviews > 0 ? 
      Math.round((stat.recommended_count / stat.total_reviews) * 100) : 0;

    console.log(`  API返回的总评论数: ${stat.total_reviews}`);
    console.log(`  API返回的推荐数: ${stat.recommended_count}`);
    console.log(`  API返回的推荐率: ${apiRecommendationRate}%`);

    await connection.end();
    console.log('\n✅ 调试完成！');

  } catch (error) {
    console.error('❌ 调试失败:', error);
  }
}

debugRecommendationPercentage();
