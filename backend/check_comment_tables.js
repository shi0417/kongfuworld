const mysql = require('mysql2/promise');

(async () => {
  const conn = await mysql.createConnection({
    host: 'localhost',
    user: 'root', 
    password: '123456',
    database: 'kongfuworld'
  });
  
  console.log('🔍 检查数据库表结构...');
  
  try {
    // 检查comment_like表
    const [likeTable] = await conn.execute('SHOW TABLES LIKE "comment_like"');
    console.log('comment_like表存在:', likeTable.length > 0);
    
    // 检查comment_dislike表  
    const [dislikeTable] = await conn.execute('SHOW TABLES LIKE "comment_dislike"');
    console.log('comment_dislike表存在:', dislikeTable.length > 0);
    
    // 检查comment表结构
    const [commentStructure] = await conn.execute('DESCRIBE comment');
    console.log('\ncomment表字段:');
    commentStructure.forEach(field => {
      console.log('  ', field.Field, field.Type);
    });
    
    // 检查comment_like表结构
    if (likeTable.length > 0) {
      const [likeStructure] = await conn.execute('DESCRIBE comment_like');
      console.log('\ncomment_like表字段:');
      likeStructure.forEach(field => {
        console.log('  ', field.Field, field.Type);
      });
    }
    
    // 检查comment_dislike表结构
    if (dislikeTable.length > 0) {
      const [dislikeStructure] = await conn.execute('DESCRIBE comment_dislike');
      console.log('\ncomment_dislike表字段:');
      dislikeStructure.forEach(field => {
        console.log('  ', field.Field, field.Type);
      });
    }
    
    // 检查comment表中的数据
    const [comments] = await conn.execute('SELECT id, target_type, target_id, parent_comment_id, likes, dislikes FROM comment ORDER BY id DESC LIMIT 5');
    console.log('\n最近的评论数据:');
    comments.forEach(comment => {
      console.log(`  ID: ${comment.id}, 类型: ${comment.target_type}, 目标ID: ${comment.target_id}, 父评论: ${comment.parent_comment_id}, 点赞: ${comment.likes}, 点踩: ${comment.dislikes}`);
    });
    
  } catch (error) {
    console.error('检查失败:', error);
  }
  
  await conn.end();
})().catch(console.error);
