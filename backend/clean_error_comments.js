const mysql = require('mysql2/promise');

(async () => {
  const conn = await mysql.createConnection({
    host: 'localhost',
    user: 'root', 
    password: '123456',
    database: 'kongfuworld'
  });
  
  console.log('🔧 清理错误评论数据...');
  
  try {
    // 查找包含错误信息的评论
    const [errorComments] = await conn.execute(`
      SELECT id, content 
      FROM comment 
      WHERE content LIKE '%Unknown column%' OR content LIKE '%c.views%'
    `);
    
    console.log(`找到 ${errorComments.length} 条错误评论:`);
    errorComments.forEach(comment => {
      console.log(`  ID: ${comment.id}, 内容: ${comment.content.substring(0, 50)}...`);
    });
    
    if (errorComments.length > 0) {
      // 删除错误评论
      const [result] = await conn.execute(`
        DELETE FROM comment 
        WHERE content LIKE '%Unknown column%' OR content LIKE '%c.views%'
      `);
      
      console.log(`✅ 删除了 ${result.affectedRows} 条错误评论`);
      
      // 删除相关的点赞和点踩记录
      const commentIds = errorComments.map(c => c.id);
      if (commentIds.length > 0) {
        await conn.execute(`
          DELETE FROM comment_like 
          WHERE comment_id IN (${commentIds.join(',')})
        `);
        
        await conn.execute(`
          DELETE FROM comment_dislike 
          WHERE comment_id IN (${commentIds.join(',')})
        `);
        
        console.log('✅ 清理了相关的点赞和点踩记录');
      }
    } else {
      console.log('✅ 没有找到错误评论');
    }
    
    // 验证清理结果
    const [remainingComments] = await conn.execute(`
      SELECT COUNT(*) as count 
      FROM comment 
      WHERE target_type = 'chapter' AND target_id = 1343
    `);
    
    console.log(`\n✅ 清理完成！章节1343现在有 ${remainingComments[0].count} 条评论`);
    
  } catch (error) {
    console.error('❌ 清理失败:', error);
  }
  
  await conn.end();
})().catch(console.error);
