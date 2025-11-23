const mysql = require('mysql2/promise');

(async () => {
  const conn = await mysql.createConnection({
    host: 'localhost',
    user: 'root', 
    password: '123456',
    database: 'kongfuworld'
  });
  
  console.log('🔍 测试章节评论API...');
  
  try {
    // 测试章节评论查询
    const [comments] = await conn.execute(`
      SELECT 
        c.id,
        c.content,
        c.created_at,
        c.likes,
        c.dislikes,
        c.parent_comment_id,
        u.username,
        u.avatar,
        u.is_vip
      FROM comment c
      JOIN user u ON c.user_id = u.id
      WHERE c.target_type = 'chapter' AND c.target_id = ?
      ORDER BY c.created_at DESC
      LIMIT ? OFFSET ?
    `, [1343, 10, 0]);
    
    console.log('\n✅ 章节评论查询成功:');
    console.log(`  找到 ${comments.length} 条评论`);
    
    comments.forEach((comment, index) => {
      console.log(`  ${index + 1}. ID: ${comment.id}, 用户: ${comment.username}, 内容: ${comment.content.substring(0, 20)}...`);
    });
    
    // 测试评论统计查询
    const [stats] = await conn.execute(`
      SELECT 
        COUNT(*) as total_comments,
        SUM(CASE WHEN likes > 0 THEN 1 ELSE 0 END) as liked_comments,
        SUM(likes) as total_likes
      FROM comment 
      WHERE target_type = 'chapter' AND target_id = ?
    `, [1343]);
    
    console.log('\n✅ 评论统计查询成功:');
    const stat = stats[0];
    console.log(`  总评论数: ${stat.total_comments}`);
    console.log(`  被点赞评论数: ${stat.liked_comments}`);
    console.log(`  总点赞数: ${stat.total_likes}`);
    
  } catch (error) {
    console.error('❌ 测试失败:', error);
  }
  
  await conn.end();
})().catch(console.error);
