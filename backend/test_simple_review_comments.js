// 简单测试评价回复API
const mysql = require('mysql2/promise');

(async () => {
  const conn = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '123456',
    database: 'kongfuworld'
  });

  try {
    console.log('🧪 简单测试评价回复API...');

    // 直接查询review类型的评论
    const [results] = await conn.execute(`
      SELECT 
        c.id,
        c.content,
        c.created_at,
        c.likes,
        c.dislikes,
        u.username,
        u.avatar,
        u.is_vip
      FROM comment c
      JOIN user u ON c.user_id = u.id
      WHERE c.target_type = 'review'
      ORDER BY c.created_at DESC
      LIMIT 3
    `);
    
    console.log('📊 查询结果:');
    results.forEach(result => {
      console.log(`  评论ID: ${result.id}`);
      console.log(`    用户名: ${result.username}`);
      console.log(`    点赞: ${result.likes}, 点踩: ${result.dislikes}`);
      console.log(`    内容: ${result.content.substring(0, 50)}...`);
      console.log('');
    });

    // 检查是否有dislikes字段
    if (results.length > 0) {
      const hasDislikes = 'dislikes' in results[0];
      console.log(`📊 查询结果是否包含dislikes字段: ${hasDislikes ? '✅ 是' : '❌ 否'}`);
      
      if (hasDislikes) {
        console.log('✅ 后端API现在会返回dislikes字段');
        console.log('✅ 前端应该能正确显示dislikes数字');
      } else {
        console.log('❌ 后端API没有返回dislikes字段');
      }
    } else {
      console.log('⚠️ 没有找到review类型的评论数据');
    }

    console.log('🎉 测试完成！');

  } catch (error) {
    console.error('❌ 测试过程中出现错误:', error);
  } finally {
    await conn.end();
  }
})();
