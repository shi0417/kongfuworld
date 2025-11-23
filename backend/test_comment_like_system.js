// 测试评论回复的点赞系统
const mysql = require('mysql2/promise');

(async () => {
  const conn = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '123456',
    database: 'kongfuworld'
  });

  try {
    console.log('🧪 测试评论回复的点赞系统...');

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

    // 2. 检查相关表
    console.log('📝 2. 检查相关表...');
    const [tables] = await conn.execute(`
      SELECT TABLE_NAME 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_NAME IN ('comment_like', 'comment_dislike')
    `);
    
    console.log('📊 相关表:');
    tables.forEach(table => {
      console.log(`  - ${table.TABLE_NAME} 表存在`);
    });

    // 3. 检查target_type字段
    console.log('📝 3. 检查target_type字段...');
    const [targetTypes] = await conn.execute(`
      SELECT COLUMN_TYPE 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'comment' AND COLUMN_NAME = 'target_type'
    `);
    
    console.log(`📊 target_type字段类型: ${targetTypes[0].COLUMN_TYPE}`);

    // 4. 检查现有评论数据
    console.log('📝 4. 检查现有评论数据...');
    const [comments] = await conn.execute(`
      SELECT id, target_type, target_id, parent_comment_id, likes, dislikes, content 
      FROM comment 
      ORDER BY id DESC 
      LIMIT 5
    `);
    
    console.log('📊 最新评论数据:');
    comments.forEach(comment => {
      console.log(`  评论ID: ${comment.id}`);
      console.log(`    类型: ${comment.target_type}, 目标ID: ${comment.target_id}`);
      console.log(`    父评论: ${comment.parent_comment_id || '无'}`);
      console.log(`    点赞: ${comment.likes}, 点踩: ${comment.dislikes}`);
      console.log(`    内容: ${comment.content.substring(0, 50)}...`);
      console.log('');
    });

    // 5. 检查点赞和点踩记录
    const [likes] = await conn.execute('SELECT COUNT(*) as count FROM comment_like');
    const [dislikes] = await conn.execute('SELECT COUNT(*) as count FROM comment_dislike');
    
    console.log(`📊 记录统计:`);
    console.log(`   - 点赞记录: ${likes[0].count}`);
    console.log(`   - 点踩记录: ${dislikes[0].count}`);

    // 6. 检查review类型的评论
    console.log('📝 5. 检查review类型的评论...');
    const [reviewComments] = await conn.execute(`
      SELECT id, target_id, parent_comment_id, likes, dislikes, content 
      FROM comment 
      WHERE target_type = 'review'
      ORDER BY id DESC 
      LIMIT 3
    `);
    
    console.log('📊 review类型评论:');
    reviewComments.forEach(comment => {
      console.log(`  评论ID: ${comment.id}`);
      console.log(`    目标评价ID: ${comment.target_id}`);
      console.log(`    父评论: ${comment.parent_comment_id || '无'}`);
      console.log(`    点赞: ${comment.likes}, 点踩: ${comment.dislikes}`);
      console.log(`    内容: ${comment.content.substring(0, 50)}...`);
      console.log('');
    });

    console.log('🎉 测试完成！');

  } catch (error) {
    console.error('❌ 测试过程中出现错误:', error);
  } finally {
    await conn.end();
  }
})();
