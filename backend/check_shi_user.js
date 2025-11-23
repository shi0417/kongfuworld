// 检查用户"shi"的数据
const mysql = require('mysql2/promise');

async function checkShiUser() {
  try {
    const connection = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: '123456',
      database: 'kongfuworld'
    });

    console.log('🔍 检查用户"shi"的数据...\n');

    // 获取用户"shi"的评论数据
    const [reviews] = await connection.execute(`
      SELECT 
        r.id,
        r.rating,
        r.likes,
        r.comments,
        r.views,
        r.is_recommended,
        u.username
      FROM review r 
      JOIN user u ON r.user_id = u.id 
      WHERE u.username = 'shi'
      LIMIT 1
    `);

    if (reviews.length > 0) {
      const review = reviews[0];
      console.log('📊 用户"shi"的评论数据:');
      console.log(`  ID: ${review.id}`);
      console.log(`  评分: ${review.rating} (这个可能是显示的"0"？)`);
      console.log(`  点赞: ${review.likes}`);
      console.log(`  评论: ${review.comments}`);
      console.log(`  查看: ${review.views}`);
      console.log(`  推荐: ${review.is_recommended} (0=不推荐, 1=推荐)`);
      
      console.log('\n🎯 分析用户名下面的"0"可能来源:');
      if (review.rating === 0) {
        console.log('❌ 评分字段为0 - 这可能是显示的"0"');
      }
      if (review.likes === 0) {
        console.log('❌ 点赞数为0 - 但这应该显示在互动按钮中');
      }
      if (review.comments === 0) {
        console.log('❌ 评论数为0 - 但这应该显示在互动按钮中');
      }
      if (review.views === 0) {
        console.log('❌ 查看数为0 - 但这已经移除了显示');
      }
      if (review.is_recommended === 0) {
        console.log('❌ 推荐状态为0 - 这不应该显示为数字');
      }
    } else {
      console.log('❌ 未找到用户"shi"的评论数据');
    }

    await connection.end();
    console.log('\n✅ 检查完成！');

  } catch (error) {
    console.error('❌ 检查失败:', error);
  }
}

checkShiUser();
