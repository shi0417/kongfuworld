// 调试用户"shi"的数据问题
const mysql = require('mysql2/promise');

async function debugShiUserData() {
  try {
    const connection = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: '123456',
      database: 'kongfuworld'
    });

    console.log('🔍 调试用户"shi"的数据问题...\n');

    // 获取用户"shi"的详细信息
    const [users] = await connection.execute(`
      SELECT id, username, avatar, is_vip, email, created_at
      FROM user 
      WHERE username = 'shi' OR username = 'shi yi xian'
      ORDER BY username
    `);

    console.log('👤 用户信息:');
    users.forEach((user, index) => {
      console.log(`\n用户 ${index + 1}:`);
      console.log(`  ID: ${user.id}`);
      console.log(`  用户名: "${user.username}"`);
      console.log(`  头像: "${user.avatar}"`);
      console.log(`  VIP: ${user.is_vip}`);
      console.log(`  邮箱: "${user.email}"`);
      console.log(`  创建时间: "${user.created_at}"`);
    });

    // 获取这些用户的评论数据
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
        u.username,
        u.avatar,
        u.is_vip
      FROM review r
      JOIN user u ON r.user_id = u.id
      WHERE u.username = 'shi' OR u.username = 'shi yi xian'
      ORDER BY r.created_at DESC
    `);

    console.log('\n📊 评论数据:');
    reviews.forEach((review, index) => {
      console.log(`\n评论 ${index + 1}:`);
      console.log(`  评论ID: ${review.id}`);
      console.log(`  用户ID: ${review.user_id}`);
      console.log(`  用户名: "${review.username}"`);
      console.log(`  评分: ${review.rating} (应该显示⭐️)`);
      console.log(`  点赞: ${review.likes}`);
      console.log(`  评论: ${review.comments}`);
      console.log(`  查看: ${review.views} (这个可能是显示的"0"？)`);
      console.log(`  推荐: ${review.is_recommended} (这个可能是显示的"0"？)`);
      console.log(`  VIP: ${review.is_vip} (这个可能是显示的"0"？)`);
      console.log(`  内容: ${review.content.substring(0, 50)}...`);
    });

    // 检查是否有其他可能导致显示"0"的字段
    console.log('\n🎯 可能的"0"来源分析:');
    reviews.forEach((review, index) => {
      console.log(`\n评论 ${index + 1} 的"0"字段:`);
      if (review.views === 0) console.log('  ❌ 查看数 (views): 0');
      if (review.is_recommended === 0) console.log('  ❌ 推荐状态 (is_recommended): 0');
      if (review.is_vip === 0) console.log('  ❌ VIP状态 (is_vip): 0');
      if (review.likes === 0) console.log('  ❌ 点赞数 (likes): 0');
      if (review.comments === 0) console.log('  ❌ 评论数 (comments): 0');
    });

    await connection.end();
    console.log('\n✅ 调试完成！');

  } catch (error) {
    console.error('❌ 调试失败:', error);
  }
}

debugShiUserData();
