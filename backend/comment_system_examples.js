// 评论系统三表使用示例
// 展示 review、comment、review_like 三个表的具体应用场景

const mysql = require('mysql2/promise');

// 数据库连接
let db;

async function initDatabase() {
  db = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '123456',
    database: 'kongfuworld'
  });
}

// ==================== 1. REVIEW 表使用示例 ====================

/**
 * 场景1：用户对小说进行评价
 * 对应：小说详情页的"Reviews"区域
 */
async function submitNovelReview(novelId, userId, content, rating, isRecommended) {
  console.log('📝 用户提交小说评价...');
  
  // 1. 检查用户是否已经评价过这部小说
  const [existingReview] = await db.execute(
    'SELECT id FROM review WHERE novel_id = ? AND user_id = ?',
    [novelId, userId]
  );
  
  if (existingReview.length > 0) {
    throw new Error('您已经评价过这部小说了');
  }
  
  // 2. 插入评价记录
  const [result] = await db.execute(`
    INSERT INTO review (novel_id, user_id, content, rating, is_recommended, created_at)
    VALUES (?, ?, ?, ?, ?, NOW())
  `, [novelId, userId, content, rating, isRecommended]);
  
  // 3. 更新小说的评价计数
  await db.execute('UPDATE novel SET reviews = reviews + 1 WHERE id = ?', [novelId]);
  
  console.log(`✅ 评价提交成功，评价ID: ${result.insertId}`);
  return result.insertId;
}

/**
 * 场景2：获取小说的评价统计
 * 对应：小说详情页显示"👍 80% 15 Reviews"
 */
async function getNovelReviewStats(novelId) {
  console.log('📊 获取小说评价统计...');
  
  const [stats] = await db.execute(`
    SELECT 
      COUNT(*) as total_reviews,
      AVG(rating) as average_rating,
      SUM(CASE WHEN is_recommended = 1 THEN 1 ELSE 0 END) as recommended_count,
      SUM(likes) as total_likes
    FROM review 
    WHERE novel_id = ?
  `, [novelId]);
  
  const stat = stats[0];
  const recommendationRate = stat.total_reviews > 0 ? 
    Math.round((stat.recommended_count / stat.total_reviews) * 100) : 0;
  
  console.log(`📈 评价统计: ${stat.total_reviews}条评价, 平均${stat.average_rating}星, 推荐率${recommendationRate}%`);
  return {
    total_reviews: stat.total_reviews,
    average_rating: Math.round(stat.average_rating * 10) / 10,
    recommendation_rate: recommendationRate,
    total_likes: stat.total_likes
  };
}

/**
 * 场景3：获取小说的评价列表
 * 对应：小说详情页显示评价列表
 */
async function getNovelReviews(novelId, page = 1, limit = 10) {
  console.log('📋 获取小说评价列表...');
  
  const offset = (page - 1) * limit;
  
  const [reviews] = await db.execute(`
    SELECT 
      r.id, r.content, r.rating, r.created_at, r.likes, r.comments, r.views, r.is_recommended,
      u.username, u.avatar, u.is_vip
    FROM review r
    JOIN user u ON r.user_id = u.id
    WHERE r.novel_id = ?
    ORDER BY r.created_at DESC
    LIMIT ? OFFSET ?
  `, [novelId, limit, offset]);
  
  console.log(`📄 获取到 ${reviews.length} 条评价`);
  return reviews;
}

// ==================== 2. COMMENT 表使用示例 ====================

/**
 * 场景4：用户对评价进行回复
 * 对应：评价下方的回复功能
 */
async function replyToReview(reviewId, userId, content) {
  console.log('💬 用户回复评价...');
  
  // 1. 插入回复评论
  const [result] = await db.execute(`
    INSERT INTO comment (user_id, target_type, target_id, content, created_at)
    VALUES (?, 'review', ?, ?, NOW())
  `, [userId, reviewId, content]);
  
  // 2. 更新评价的回复数
  await db.execute('UPDATE review SET comments = comments + 1 WHERE id = ?', [reviewId]);
  
  console.log(`✅ 回复成功，评论ID: ${result.insertId}`);
  return result.insertId;
}

/**
 * 场景5：用户对章节进行评论
 * 对应：章节阅读页的评论功能
 */
async function commentOnChapter(chapterId, userId, content) {
  console.log('📖 用户评论章节...');
  
  const [result] = await db.execute(`
    INSERT INTO comment (user_id, target_type, target_id, content, created_at)
    VALUES (?, 'chapter', ?, ?, NOW())
  `, [userId, chapterId, content]);
  
  console.log(`✅ 章节评论成功，评论ID: ${result.insertId}`);
  return result.insertId;
}

/**
 * 场景6：用户对段落进行评论
 * 对应：段落评论功能（类似弹幕）
 */
async function commentOnParagraph(paragraphId, userId, content) {
  console.log('📝 用户评论段落...');
  
  const [result] = await db.execute(`
    INSERT INTO comment (user_id, target_type, target_id, content, created_at)
    VALUES (?, 'paragraph', ?, ?, NOW())
  `, [userId, paragraphId, content]);
  
  console.log(`✅ 段落评论成功，评论ID: ${result.insertId}`);
  return result.insertId;
}

/**
 * 场景7：用户回复评论（多层级回复）
 * 对应：评论的回复功能
 */
async function replyToComment(parentCommentId, userId, content) {
  console.log('🔄 用户回复评论...');
  
  const [result] = await db.execute(`
    INSERT INTO comment (user_id, target_type, target_id, parent_comment_id, content, created_at)
    VALUES (?, 'comment', ?, ?, ?, NOW())
  `, [userId, parentCommentId, parentCommentId, content]);
  
  console.log(`✅ 评论回复成功，回复ID: ${result.insertId}`);
  return result.insertId;
}

// ==================== 3. REVIEW_LIKE 表使用示例 ====================

/**
 * 场景8：用户点赞评价
 * 对应：评价的👍按钮
 */
async function likeReview(reviewId, userId) {
  console.log('👍 用户点赞评价...');
  
  // 1. 检查是否已经点赞
  const [existingLike] = await db.execute(
    'SELECT id FROM review_like WHERE review_id = ? AND user_id = ?',
    [reviewId, userId]
  );
  
  if (existingLike.length > 0) {
    throw new Error('您已经点赞过这条评价了');
  }
  
  // 2. 插入点赞记录
  await db.execute(`
    INSERT INTO review_like (review_id, user_id, created_at)
    VALUES (?, ?, NOW())
  `, [reviewId, userId]);
  
  // 3. 更新评价的点赞数
  await db.execute('UPDATE review SET likes = likes + 1 WHERE id = ?', [reviewId]);
  
  console.log(`✅ 点赞成功`);
}

/**
 * 场景9：取消点赞评价
 * 对应：再次点击👍按钮取消点赞
 */
async function unlikeReview(reviewId, userId) {
  console.log('👎 用户取消点赞评价...');
  
  // 1. 删除点赞记录
  const [result] = await db.execute(
    'DELETE FROM review_like WHERE review_id = ? AND user_id = ?',
    [reviewId, userId]
  );
  
  if (result.affectedRows === 0) {
    throw new Error('您还没有点赞过这条评价');
  }
  
  // 2. 更新评价的点赞数
  await db.execute('UPDATE review SET likes = likes - 1 WHERE id = ?', [reviewId]);
  
  console.log(`✅ 取消点赞成功`);
}

// ==================== 4. 综合查询示例 ====================

/**
 * 场景10：获取评价的完整信息（包含点赞状态）
 * 对应：前端显示评价时显示用户是否已点赞
 */
async function getReviewWithLikeStatus(reviewId, currentUserId) {
  console.log('🔍 获取评价完整信息...');
  
  const [reviews] = await db.execute(`
    SELECT 
      r.*,
      u.username, u.avatar, u.is_vip,
      CASE WHEN rl.id IS NOT NULL THEN 1 ELSE 0 END as is_liked
    FROM review r
    JOIN user u ON r.user_id = u.id
    LEFT JOIN review_like rl ON r.id = rl.review_id AND rl.user_id = ?
    WHERE r.id = ?
  `, [currentUserId, reviewId]);
  
  console.log(`📄 获取评价信息: ${reviews.length} 条`);
  return reviews[0];
}

/**
 * 场景11：获取评论的回复树
 * 对应：显示评论的层级回复结构
 */
async function getCommentReplies(commentId) {
  console.log('🌳 获取评论回复树...');
  
  const [replies] = await db.execute(`
    SELECT 
      c.*,
      u.username, u.avatar, u.is_vip
    FROM comment c
    JOIN user u ON c.user_id = u.id
    WHERE c.parent_comment_id = ?
    ORDER BY c.created_at ASC
  `, [commentId]);
  
  console.log(`📄 获取回复: ${replies.length} 条`);
  return replies;
}

// ==================== 5. 实际应用场景演示 ====================

async function demonstrateCommentSystem() {
  try {
    console.log('🚀 评论系统演示开始...\n');
    
    // 初始化数据库连接
    await initDatabase();
    
    // 假设数据
    const novelId = 1;
    const userId = 1;
    const chapterId = 1;
    const paragraphId = 1;
    
    // 1. 用户评价小说
    await submitNovelReview(
      novelId, 
      userId, 
      '这是一部非常精彩的小说，情节跌宕起伏，人物刻画生动，强烈推荐！', 
      5, 
      true
    );
    
    // 2. 获取评价统计
    const stats = await getNovelReviewStats(novelId);
    console.log('📊 评价统计:', stats);
    
    // 3. 获取评价列表
    const reviews = await getNovelReviews(novelId);
    console.log('📋 评价列表:', reviews.length, '条');
    
    // 4. 用户点赞评价
    if (reviews.length > 0) {
      await likeReview(reviews[0].id, userId);
    }
    
    // 5. 用户回复评价
    if (reviews.length > 0) {
      await replyToReview(reviews[0].id, userId, '我也觉得很好看！');
    }
    
    // 6. 用户评论章节
    await commentOnChapter(chapterId, userId, '这一章写得真好！');
    
    // 7. 用户评论段落
    await commentOnParagraph(paragraphId, userId, '这个情节太精彩了！');
    
    console.log('\n✅ 评论系统演示完成！');
    
  } catch (error) {
    console.error('❌ 演示失败:', error.message);
  } finally {
    if (db) {
      await db.end();
    }
  }
}

// 导出函数供其他模块使用
module.exports = {
  submitNovelReview,
  getNovelReviewStats,
  getNovelReviews,
  replyToReview,
  commentOnChapter,
  commentOnParagraph,
  replyToComment,
  likeReview,
  unlikeReview,
  getReviewWithLikeStatus,
  getCommentReplies,
  demonstrateCommentSystem
};

// 如果直接运行此文件，执行演示
if (require.main === module) {
  demonstrateCommentSystem().then(() => {
    process.exit(0);
  });
}
