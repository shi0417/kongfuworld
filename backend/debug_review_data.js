// 调试评论数据显示问题
const mysql = require('mysql2/promise');

async function debugReviewData() {
  try {
    const connection = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: '123456',
      database: 'kongfuworld'
    });

    console.log('🔍 调试评论数据显示问题...\n');

    // 检查review表的数据结构
    const [reviewColumns] = await connection.execute('DESCRIBE review');
    console.log('📋 review表字段:');
    reviewColumns.forEach(col => {
      console.log(`  ${col.Field}: ${col.Type} (${col.Null === 'YES' ? '可空' : '非空'})`);
    });

    console.log('\n📊 评论数据示例:');
    const [reviews] = await connection.execute(`
      SELECT 
        r.id,
        r.rating,
        r.likes,
        r.comments,
        r.views,
        r.is_recommended,
        u.username,
        u.avatar
      FROM review r 
      JOIN user u ON r.user_id = u.id 
      LIMIT 3
    `);

    reviews.forEach((review, index) => {
      console.log(`\n评论 ${index + 1}:`);
      console.log(`  ID: ${review.id}`);
      console.log(`  用户名: ${review.username}`);
      console.log(`  评分: ${review.rating}`);
      console.log(`  点赞数: ${review.likes}`);
      console.log(`  评论数: ${review.comments}`);
      console.log(`  查看数: ${review.views}`);
      console.log(`  是否推荐: ${review.is_recommended}`);
      console.log(`  头像: ${review.avatar || '无'}`);
    });

    // 检查是否有其他可能导致显示"0"的字段
    console.log('\n🔍 检查可能导致显示"0"的字段:');
    const [zeroFields] = await connection.execute(`
      SELECT 
        r.id,
        r.rating,
        r.likes,
        r.comments,
        r.views,
        u.id as user_id,
        u.username
      FROM review r 
      JOIN user u ON r.user_id = u.id 
      WHERE r.rating = 0 OR r.likes = 0 OR r.comments = 0 OR r.views = 0
      LIMIT 5
    `);

    if (zeroFields.length > 0) {
      console.log('发现包含0值的字段:');
      zeroFields.forEach(field => {
        console.log(`  ID: ${field.id}, 用户名: ${field.username}`);
        console.log(`    评分: ${field.rating}, 点赞: ${field.likes}, 评论: ${field.comments}, 查看: ${field.views}`);
      });
    } else {
      console.log('未发现包含0值的字段');
    }

    await connection.end();
    console.log('\n✅ 调试完成！');

  } catch (error) {
    console.error('❌ 调试失败:', error);
  }
}

debugReviewData();
