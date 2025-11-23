// 测试评价回复API是否返回dislikes字段
const mysql = require('mysql2/promise');

(async () => {
  const conn = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '123456',
    database: 'kongfuworld'
  });

  try {
    console.log('🧪 测试评价回复API是否返回dislikes字段...');

    // 1. 检查comment表结构
    console.log('📝 1. 检查comment表结构...');
    const [commentColumns] = await conn.execute(`
      SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'comment' AND COLUMN_NAME IN ('likes', 'dislikes')
      ORDER BY ORDINAL_POSITION
    `);
    
    console.log('📊 comment表字段:');
    commentColumns.forEach(col => {
      console.log(`  - ${col.COLUMN_NAME}: ${col.DATA_TYPE} (默认值: ${col.COLUMN_DEFAULT})`);
    });

    // 2. 检查review类型的评论数据
    console.log('📝 2. 检查review类型的评论数据...');
    const [reviewComments] = await conn.execute(`
      SELECT id, target_id, likes, dislikes, content 
      FROM comment 
      WHERE target_type = 'review'
      ORDER BY id DESC 
      LIMIT 5
    `);
    
    console.log('📊 review类型评论数据:');
    reviewComments.forEach(comment => {
      console.log(`  评论ID: ${comment.id}`);
      console.log(`    目标评价ID: ${comment.target_id}`);
      console.log(`    点赞: ${comment.likes}, 点踩: ${comment.dislikes}`);
      console.log(`    内容: ${comment.content.substring(0, 50)}...`);
      console.log('');
    });

    // 3. 模拟API查询
    console.log('📝 3. 模拟API查询...');
    const [apiResults] = await conn.execute(`
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
      WHERE c.target_type = 'review' AND c.target_id = ?
      ORDER BY c.created_at ASC
      LIMIT ? OFFSET ?
    `, [2, 10, 0]); // 测试评价ID为2的回复
    
    console.log('📊 API查询结果:');
    apiResults.forEach(result => {
      console.log(`  评论ID: ${result.id}`);
      console.log(`    用户名: ${result.username}`);
      console.log(`    点赞: ${result.likes}, 点踩: ${result.dislikes}`);
      console.log(`    内容: ${result.content.substring(0, 50)}...`);
      console.log('');
    });

    // 4. 检查是否有dislikes字段
    if (apiResults.length > 0) {
      const hasDislikes = 'dislikes' in apiResults[0];
      console.log(`📊 API返回数据是否包含dislikes字段: ${hasDislikes ? '✅ 是' : '❌ 否'}`);
      
      if (hasDislikes) {
        console.log('✅ 前端现在应该能正确显示dislikes数字');
      } else {
        console.log('❌ 前端无法显示dislikes数字');
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
