// 调试推荐状态显示问题
const mysql = require('mysql2/promise');

async function debugRecommendedIssue() {
  try {
    const connection = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: '123456',
      database: 'kongfuworld'
    });

    console.log('🔍 调试推荐状态显示问题...\n');

    // 获取用户"shi"的评论数据，特别关注推荐状态
    const [reviews] = await connection.execute(`
      SELECT 
        r.id,
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
      WHERE u.username = 'shi'
      ORDER BY r.created_at DESC
    `);

    console.log('📊 用户"shi"的评论数据:');
    reviews.forEach((review, index) => {
      console.log(`\n评论 ${index + 1}:`);
      console.log(`  评论ID: ${review.id}`);
      console.log(`  用户名: "${review.username}"`);
      console.log(`  评分: ${review.rating} (应该显示⭐️)`);
      console.log(`  点赞: ${review.likes}`);
      console.log(`  评论: ${review.comments}`);
      console.log(`  查看: ${review.views}`);
      console.log(`  推荐: ${review.is_recommended} (0=不推荐, 1=推荐)`);
      console.log(`  VIP: ${review.is_vip} (0=非VIP, 1=VIP)`);
      console.log(`  内容: ${review.content.substring(0, 50)}...`);
    });

    console.log('\n🎯 分析"0"显示问题:');
    reviews.forEach((review, index) => {
      console.log(`\n评论 ${index + 1} 的"0"字段分析:`);
      if (review.is_recommended === 0) {
        console.log('  ❌ 推荐状态为0 - 这个不应该显示任何内容');
        console.log('  ✅ 应该不显示"Recommended"标签');
      }
      if (review.is_vip === 0) {
        console.log('  ❌ VIP状态为0 - 这个不应该显示任何内容');
        console.log('  ✅ 应该不显示"VIP"标签');
      }
      if (review.views === 0) {
        console.log('  ❌ 查看数为0 - 这个字段不应该显示');
      }
      if (review.likes === 0) {
        console.log('  ❌ 点赞数为0 - 这个在按钮中显示');
      }
      if (review.comments === 0) {
        console.log('  ❌ 评论数为0 - 这个在按钮中显示');
      }
    });

    console.log('\n🔧 修复建议:');
    console.log('✅ 1. 确保只有推荐状态为1时才显示"Recommended"标签');
    console.log('✅ 2. 确保只有VIP状态为1时才显示"VIP"标签');
    console.log('✅ 3. 确保查看数字段不被显示');
    console.log('✅ 4. 检查是否有隐藏的字段被意外显示');

    await connection.end();
    console.log('\n✅ 调试完成！');

  } catch (error) {
    console.error('❌ 调试失败:', error);
  }
}

debugRecommendedIssue();
