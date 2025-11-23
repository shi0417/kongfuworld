// 测试主评论的点赞API
const mysql = require('mysql2/promise');

(async () => {
  const conn = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '123456',
    database: 'kongfuworld'
  });

  try {
    console.log('🧪 测试主评论的点赞API...');

    // 1. 检查review表结构
    console.log('📝 1. 检查review表结构...');
    const [reviewColumns] = await conn.execute(`
      SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'review' AND COLUMN_NAME IN ('likes', 'dislikes')
      ORDER BY ORDINAL_POSITION
    `);
    
    console.log('📊 review表字段:');
    reviewColumns.forEach(col => {
      console.log(`  - ${col.COLUMN_NAME}: ${col.DATA_TYPE} (默认值: ${col.COLUMN_DEFAULT})`);
    });

    // 2. 检查相关表
    console.log('📝 2. 检查相关表...');
    const [tables] = await conn.execute(`
      SELECT TABLE_NAME 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_NAME IN ('review_like', 'review_dislike')
    `);
    
    console.log('📊 相关表:');
    tables.forEach(table => {
      console.log(`  - ${table.TABLE_NAME} 表存在`);
    });

    // 3. 检查现有数据
    console.log('📝 3. 检查现有数据...');
    const [reviews] = await conn.execute(`
      SELECT id, likes, dislikes, content 
      FROM review 
      ORDER BY id DESC 
      LIMIT 3
    `);
    
    console.log('📊 最新评价数据:');
    reviews.forEach(review => {
      console.log(`  评价ID: ${review.id}`);
      console.log(`    点赞: ${review.likes}, 点踩: ${review.dislikes}`);
      console.log(`    内容: ${review.content.substring(0, 50)}...`);
      console.log('');
    });

    // 4. 检查点赞和点踩记录
    const [likes] = await conn.execute('SELECT COUNT(*) as count FROM review_like');
    const [dislikes] = await conn.execute('SELECT COUNT(*) as count FROM review_dislike');
    
    console.log(`📊 记录统计:`);
    console.log(`   - 点赞记录: ${likes[0].count}`);
    console.log(`   - 点踩记录: ${dislikes[0].count}`);

    // 5. 检查具体的点赞记录
    console.log('📝 4. 检查具体的点赞记录...');
    const [likeRecords] = await conn.execute(`
      SELECT rl.review_id, rl.user_id, rl.created_at, r.likes, r.dislikes
      FROM review_like rl
      JOIN review r ON rl.review_id = r.id
      ORDER BY rl.created_at DESC
      LIMIT 5
    `);
    
    console.log('📊 点赞记录详情:');
    likeRecords.forEach(record => {
      console.log(`  - 评价ID: ${record.review_id}, 用户ID: ${record.user_id}`);
      console.log(`    点赞时间: ${record.created_at}`);
      console.log(`    当前点赞数: ${record.likes}, 点踩数: ${record.dislikes}`);
      console.log('');
    });

    // 6. 检查是否有数据不一致
    console.log('📝 5. 检查数据一致性...');
    const [inconsistent] = await conn.execute(`
      SELECT r.id, r.likes, COUNT(rl.id) as actual_likes
      FROM review r
      LEFT JOIN review_like rl ON r.id = rl.review_id
      GROUP BY r.id, r.likes
      HAVING r.likes != actual_likes
    `);
    
    if (inconsistent.length === 0) {
      console.log('✅ 点赞数据一致');
    } else {
      console.log(`❌ 发现 ${inconsistent.length} 条数据不一致:`);
      inconsistent.forEach(item => {
        console.log(`  - 评价ID: ${item.id}, 记录点赞数: ${item.likes}, 实际点赞数: ${item.actual_likes}`);
      });
    }

    console.log('🎉 测试完成！');

  } catch (error) {
    console.error('❌ 测试过程中出现错误:', error);
  } finally {
    await conn.end();
  }
})();
