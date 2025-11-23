const mysql = require('mysql2/promise');

(async () => {
  const conn = await mysql.createConnection({
    host: 'localhost',
    user: 'root', 
    password: '123456',
    database: 'kongfuworld'
  });
  
  console.log('🔍 测试回复点赞功能...');
  
  try {
    // 检查回复评论（ID 20）
    const [reply] = await conn.execute('SELECT * FROM comment WHERE id = 20');
    console.log('\n回复评论信息:');
    if (reply.length > 0) {
      const comment = reply[0];
      console.log(`  ID: ${comment.id}`);
      console.log(`  内容: ${comment.content}`);
      console.log(`  父评论ID: ${comment.parent_comment_id}`);
      console.log(`  目标类型: ${comment.target_type}`);
      console.log(`  目标ID: ${comment.target_id}`);
      console.log(`  当前点赞数: ${comment.likes}`);
      console.log(`  当前点踩数: ${comment.dislikes}`);
    }
    
    // 模拟点赞回复
    console.log('\n🔧 模拟点赞回复（ID 20）...');
    
    // 检查是否已经点赞
    const [existingLike] = await conn.execute('SELECT id FROM comment_like WHERE comment_id = 20 AND user_id = 2');
    console.log('已有点赞记录:', existingLike.length > 0);
    
    if (existingLike.length === 0) {
      // 插入点赞记录
      await conn.execute('INSERT INTO comment_like (comment_id, user_id, created_at) VALUES (?, ?, NOW())', [20, 2]);
      console.log('✅ 插入点赞记录成功');
      
      // 更新评论点赞数
      await conn.execute('UPDATE comment SET likes = likes + 1 WHERE id = ?', [20]);
      console.log('✅ 更新点赞数成功');
    } else {
      console.log('⚠️ 已经点赞过了');
    }
    
    // 检查结果
    const [updatedReply] = await conn.execute('SELECT likes, dislikes FROM comment WHERE id = 20');
    console.log('\n更新后的数据:');
    console.log(`  点赞数: ${updatedReply[0].likes}`);
    console.log(`  点踩数: ${updatedReply[0].dislikes}`);
    
    // 检查点赞记录
    const [likeRecords] = await conn.execute('SELECT * FROM comment_like WHERE comment_id = 20');
    console.log('\n点赞记录:');
    likeRecords.forEach(record => {
      console.log(`  ID: ${record.id}, 用户ID: ${record.user_id}, 时间: ${record.created_at}`);
    });
    
  } catch (error) {
    console.error('测试失败:', error);
  }
  
  await conn.end();
})().catch(console.error);
