// 调试"0"显示问题
const mysql = require('mysql2/promise');

async function debugZeroIssue() {
  try {
    const connection = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: '123456',
      database: 'kongfuworld'
    });

    console.log('🔍 深入调试"0"显示问题...\n');

    // 获取用户"shi yi xian"的详细数据
    const [reviews] = await connection.execute(`
      SELECT 
        r.id,
        r.rating,
        r.likes,
        r.comments,
        r.views,
        r.is_recommended,
        r.content,
        u.id as user_id,
        u.username,
        u.avatar,
        u.is_vip
      FROM review r 
      JOIN user u ON r.user_id = u.id 
      WHERE u.username = 'shi yi xian'
      ORDER BY r.created_at DESC
      LIMIT 2
    `);

    console.log('📊 用户"shi yi xian"的详细数据:');
    reviews.forEach((review, index) => {
      console.log(`\n评论 ${index + 1}:`);
      console.log(`  用户ID: ${review.user_id}`);
      console.log(`  用户名: ${review.username}`);
      console.log(`  头像: ${review.avatar}`);
      console.log(`  评分: ${review.rating}`);
      console.log(`  点赞: ${review.likes}`);
      console.log(`  评论: ${review.comments}`);
      console.log(`  查看: ${review.views}`);
      console.log(`  推荐: ${review.is_recommended}`);
      console.log(`  VIP: ${review.is_vip}`);
      console.log(`  内容: ${review.content.substring(0, 50)}...`);
    });

    // 检查是否有字段为0或null
    console.log('\n🔍 检查可能导致显示"0"的字段:');
    reviews.forEach((review, index) => {
      console.log(`\n评论 ${index + 1} 的"0"字段分析:`);
      if (review.rating === 0) console.log('  ❌ 评分字段为0');
      if (review.likes === 0) console.log('  ❌ 点赞数为0');
      if (review.comments === 0) console.log('  ❌ 评论数为0');
      if (review.views === 0) console.log('  ❌ 查看数为0');
      if (review.is_recommended === 0) console.log('  ❌ 推荐状态为0');
      if (review.is_vip === 0) console.log('  ❌ VIP状态为0');
      if (review.user_id === 0) console.log('  ❌ 用户ID为0');
    });

    await connection.end();
    console.log('\n✅ 调试完成！');

  } catch (error) {
    console.error('❌ 调试失败:', error);
  }
}

debugZeroIssue();
