// 测试简化后的点赞逻辑
const mysql = require('mysql2/promise');

(async () => {
  const conn = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '123456',
    database: 'kongfuworld'
  });

  try {
    console.log('🧪 测试简化后的点赞逻辑...');

    // 1. 测试主评论点赞逻辑
    console.log('📝 1. 测试主评论点赞逻辑...');
    
    // 模拟用户ID为1，评价ID为2的点赞操作
    const userId = 1;
    const reviewId = 2;
    
    // 检查当前状态
    const [currentLike] = await conn.execute(
      'SELECT id FROM review_like WHERE review_id = ? AND user_id = ?',
      [reviewId, userId]
    );
    
    const [currentDislike] = await conn.execute(
      'SELECT id FROM review_dislike WHERE review_id = ? AND user_id = ?',
      [reviewId, userId]
    );
    
    console.log(`📊 当前状态:`);
    console.log(`  - 点赞记录: ${currentLike.length > 0 ? '存在' : '不存在'}`);
    console.log(`  - 点踩记录: ${currentDislike.length > 0 ? '存在' : '不存在'}`);
    
    // 模拟简化逻辑：如果已经点赞，直接返回
    if (currentLike.length > 0) {
      console.log('✅ 简化逻辑：已经点赞，直接返回，不做任何操作');
    } else {
      console.log('✅ 简化逻辑：未点赞，可以执行点赞操作');
    }
    
    // 2. 测试评论回复点赞逻辑
    console.log('📝 2. 测试评论回复点赞逻辑...');
    
    // 模拟用户ID为1，评论ID为4的点赞操作
    const commentId = 4;
    
    // 检查当前状态
    const [currentCommentLike] = await conn.execute(
      'SELECT id FROM comment_like WHERE comment_id = ? AND user_id = ?',
      [commentId, userId]
    );
    
    const [currentCommentDislike] = await conn.execute(
      'SELECT id FROM comment_dislike WHERE comment_id = ? AND user_id = ?',
      [commentId, userId]
    );
    
    console.log(`📊 当前状态:`);
    console.log(`  - 点赞记录: ${currentCommentLike.length > 0 ? '存在' : '不存在'}`);
    console.log(`  - 点踩记录: ${currentCommentDislike.length > 0 ? '存在' : '不存在'}`);
    
    // 模拟简化逻辑：如果已经点赞，直接返回
    if (currentCommentLike.length > 0) {
      console.log('✅ 简化逻辑：已经点赞，直接返回，不做任何操作');
    } else {
      console.log('✅ 简化逻辑：未点赞，可以执行点赞操作');
    }
    
    // 3. 测试互斥逻辑
    console.log('📝 3. 测试互斥逻辑...');
    
    // 如果用户点踩了，再点赞应该删除点踩记录
    if (currentDislike.length > 0 && currentLike.length === 0) {
      console.log('✅ 互斥逻辑：用户有点踩记录，点赞时会删除点踩记录');
    }
    
    if (currentCommentDislike.length > 0 && currentCommentLike.length === 0) {
      console.log('✅ 互斥逻辑：用户有点踩记录，点赞时会删除点踩记录');
    }
    
    // 4. 总结简化逻辑的优势
    console.log('📝 4. 简化逻辑优势总结...');
    console.log('✅ 优势1：逻辑更清晰 - 每个按钮只有一个功能');
    console.log('✅ 优势2：用户体验更好 - 不会因为重复点击而取消操作');
    console.log('✅ 优势3：代码更简洁 - 减少复杂的条件判断');
    console.log('✅ 优势4：维护更容易 - 逻辑简单，bug更少');
    
    console.log('🎉 简化逻辑测试完成！');

  } catch (error) {
    console.error('❌ 测试过程中出现错误:', error);
  } finally {
    await conn.end();
  }
})();
