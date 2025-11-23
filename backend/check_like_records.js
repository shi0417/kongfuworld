const mysql = require('mysql2/promise');

(async () => {
  const conn = await mysql.createConnection({
    host: 'localhost',
    user: 'root', 
    password: '123456',
    database: 'kongfuworld'
  });
  
  console.log('🔍 检查点赞记录...');
  
  try {
    // 检查comment_like表中的记录
    const [likeRecords] = await conn.execute('SELECT * FROM comment_like ORDER BY id DESC LIMIT 10');
    console.log('\ncomment_like表记录:');
    if (likeRecords.length === 0) {
      console.log('  没有点赞记录');
    } else {
      likeRecords.forEach(record => {
        console.log(`  ID: ${record.id}, 评论ID: ${record.comment_id}, 用户ID: ${record.user_id}, 时间: ${record.created_at}`);
      });
    }
    
    // 检查comment_dislike表中的记录
    const [dislikeRecords] = await conn.execute('SELECT * FROM comment_dislike ORDER BY id DESC LIMIT 10');
    console.log('\ncomment_dislike表记录:');
    if (dislikeRecords.length === 0) {
      console.log('  没有点踩记录');
    } else {
      dislikeRecords.forEach(record => {
        console.log(`  ID: ${record.id}, 评论ID: ${record.comment_id}, 用户ID: ${record.user_id}, 时间: ${record.created_at}`);
      });
    }
    
    // 检查特定评论的点赞记录
    const [specificLikes] = await conn.execute('SELECT * FROM comment_like WHERE comment_id = 20');
    console.log('\n评论ID 20的点赞记录:');
    if (specificLikes.length === 0) {
      console.log('  没有点赞记录');
    } else {
      specificLikes.forEach(record => {
        console.log(`  ID: ${record.id}, 用户ID: ${record.user_id}, 时间: ${record.created_at}`);
      });
    }
    
    // 检查特定评论的点踩记录
    const [specificDislikes] = await conn.execute('SELECT * FROM comment_dislike WHERE comment_id = 20');
    console.log('\n评论ID 20的点踩记录:');
    if (specificDislikes.length === 0) {
      console.log('  没有点踩记录');
    } else {
      specificDislikes.forEach(record => {
        console.log(`  ID: ${record.id}, 用户ID: ${record.user_id}, 时间: ${record.created_at}`);
      });
    }
    
  } catch (error) {
    console.error('检查失败:', error);
  }
  
  await conn.end();
})().catch(console.error);
