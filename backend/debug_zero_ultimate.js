// 终极调试"0"显示问题
const mysql = require('mysql2/promise');

async function debugZeroUltimate() {
  try {
    const connection = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: '123456',
      database: 'kongfuworld'
    });

    console.log('🔍 终极调试"0"显示问题...\n');

    // 获取所有可能显示"0"的字段
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
        u.is_vip,
        u.email,
        u.created_at as user_created_at
      FROM review r 
      JOIN user u ON r.user_id = u.id 
      WHERE u.username = 'shi yi xian'
      ORDER BY r.created_at DESC
      LIMIT 1
    `);

    if (reviews.length > 0) {
      const review = reviews[0];
      console.log('📊 完整数据检查:');
      console.log(`  用户ID: ${review.user_id} (${typeof review.user_id})`);
      console.log(`  用户名: "${review.username}" (${typeof review.username})`);
      console.log(`  头像: "${review.avatar}" (${typeof review.avatar})`);
      console.log(`  评分: ${review.rating} (${typeof review.rating})`);
      console.log(`  点赞: ${review.likes} (${typeof review.likes})`);
      console.log(`  评论: ${review.comments} (${typeof review.comments})`);
      console.log(`  查看: ${review.views} (${typeof review.views})`);
      console.log(`  推荐: ${review.is_recommended} (${typeof review.is_recommended})`);
      console.log(`  VIP: ${review.is_vip} (${typeof review.is_vip})`);
      console.log(`  邮箱: "${review.email}" (${typeof review.email})`);
      console.log(`  用户创建时间: "${review.user_created_at}" (${typeof review.user_created_at})`);

      console.log('\n🎯 可能的"0"来源分析:');
      console.log('1. 查看数 (views): 0 - 这个字段不应该显示');
      console.log('2. 推荐状态 (is_recommended): 0 - 这个字段不应该显示');
      console.log('3. VIP状态 (is_vip): 0 - 这个字段不应该显示');
      console.log('4. 评论数 (comments): 1 - 这个应该显示为"1"');
      console.log('5. 点赞数 (likes): 2 - 这个应该显示为"2"');
      console.log('6. 评分 (rating): 5 - 这个应该显示为⭐️⭐️⭐️⭐️⭐️');

      console.log('\n🔧 修复建议:');
      console.log('✅ 确保只有需要的字段被显示');
      console.log('✅ 检查是否有隐藏的文本节点');
      console.log('✅ 确保CSS样式正确');
      console.log('✅ 检查是否有意外的HTML结构');
    }

    await connection.end();
    console.log('\n✅ 终极调试完成！');

  } catch (error) {
    console.error('❌ 调试失败:', error);
  }
}

debugZeroUltimate();
