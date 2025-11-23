// 调试"0"显示问题
const mysql = require('mysql2/promise');

async function debugZeroDisplay() {
  try {
    const connection = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: '123456',
      database: 'kongfuworld'
    });

    console.log('🔍 调试"0"显示问题...\n');

    // 获取详细的评论数据
    const [reviews] = await connection.execute(`
      SELECT 
        r.id,
        r.rating,
        r.likes,
        r.comments,
        r.views,
        r.is_recommended,
        r.content,
        u.username,
        u.avatar
      FROM review r 
      JOIN user u ON r.user_id = u.id 
      ORDER BY r.created_at DESC
      LIMIT 3
    `);

    console.log('📊 详细评论数据:');
    reviews.forEach((review, index) => {
      console.log(`\n评论 ${index + 1}:`);
      console.log(`  用户名: ${review.username}`);
      console.log(`  评分: ${review.rating} (可能显示为0？)`);
      console.log(`  点赞数: ${review.likes}`);
      console.log(`  评论数: ${review.comments}`);
      console.log(`  查看数: ${review.views} (已移除显示)`);
      console.log(`  是否推荐: ${review.is_recommended} (0=不推荐, 1=推荐)`);
      console.log(`  内容: ${review.content.substring(0, 50)}...`);
    });

    console.log('\n🎯 可能的"0"来源分析:');
    console.log('1. rating字段 - 如果前端意外显示了评分');
    console.log('2. likes字段 - 点赞数为0时显示');
    console.log('3. comments字段 - 评论数为0时显示');
    console.log('4. is_recommended字段 - 如果意外显示为数字');

    // 检查是否有评分为0的评论
    const [zeroRatings] = await connection.execute(`
      SELECT r.id, u.username, r.rating, r.likes, r.comments, r.views
      FROM review r 
      JOIN user u ON r.user_id = u.id 
      WHERE r.rating = 0 OR r.rating IS NULL
    `);

    if (zeroRatings.length > 0) {
      console.log('\n⚠️ 发现评分为0或NULL的评论:');
      zeroRatings.forEach(review => {
        console.log(`  用户: ${review.username}, 评分: ${review.rating}`);
      });
    }

    await connection.end();
    console.log('\n✅ 调试完成！');

  } catch (error) {
    console.error('❌ 调试失败:', error);
  }
}

debugZeroDisplay();
