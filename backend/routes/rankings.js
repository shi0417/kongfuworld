/**
 * 作品数据评价系统 - 排行榜接口
 * 
 * 接口列表：
 * - GET /api/rankings/overall - 综合排行榜
 * - GET /api/rankings/hot-24h - 24小时热榜（预留）
 * - GET /api/rankings/hot-7d - 7天热榜（预留）
 * - GET /api/rankings/top-rated - 高分榜（预留）
 * - GET /api/rankings/best-seller - 畅销榜（预留）
 */

const express = require('express');
const mysql = require('mysql2/promise');
const router = express.Router();

// 数据库配置
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '123456',
  database: process.env.DB_NAME || 'kongfuworld',
  charset: 'utf8mb4'
};

/**
 * GET /api/rankings/overall
 * 获取综合排行榜（按 final_score 排序）
 * 
 * 参数：
 * - limit: 返回数量（可选，默认20）
 * - offset: 偏移量（可选，默认0）
 * 
 * 返回：按 final_score 排序的小说列表（带基本信息和评分）
 */
router.get('/overall', async (req, res) => {
  let connection;
  try {
    const limit = parseInt(req.query.limit) || 20;
    const offset = parseInt(req.query.offset) || 0;
    
    connection = await mysql.createConnection(dbConfig);
    
    // 查询综合排行榜
    const [rankings] = await connection.execute(`
      SELECT 
        n.id as novel_id,
        n.title,
        n.author,
        n.cover,
        n.status,
        n.rating as novel_rating,
        n.reviews as novel_reviews,
        nos.total_views,
        nos.total_unique_readers,
        nos.avg_rating,
        nos.rating_count,
        nos.popularity_score,
        nos.engagement_score,
        nos.monetization_score,
        nos.reputation_score,
        nos.community_score,
        nos.final_score,
        nos.last_calculated_at
      FROM novel_overall_scores nos
      INNER JOIN novel n ON nos.novel_id = n.id
      WHERE n.review_status = 'published'
        AND nos.final_score > 0
      ORDER BY nos.final_score DESC, nos.total_views DESC
      LIMIT ? OFFSET ?
    `, [limit, offset]);
    
    // 查询总数
    const [countResult] = await connection.execute(`
      SELECT COUNT(*) as total
      FROM novel_overall_scores nos
      INNER JOIN novel n ON nos.novel_id = n.id
      WHERE n.review_status = 'published'
        AND nos.final_score > 0
    `);
    
    const total = countResult[0].total;
    
    res.json({
      success: true,
      data: rankings,
      pagination: {
        limit,
        offset,
        total,
        hasMore: offset + limit < total
      }
    });
    
  } catch (error) {
    console.error('获取综合排行榜失败:', error);
    res.status(500).json({
      success: false,
      message: '获取综合排行榜失败',
      error: error.message
    });
  } finally {
    if (connection) {
      await connection.end();
    }
  }
});

/**
 * GET /api/rankings/hot-24h
 * 获取24小时热榜（预留接口）
 * 
 * TODO: 实现基于 novel_advanced_stats_daily 的24小时热度统计
 */
router.get('/hot-24h', async (req, res) => {
  res.json({
    success: true,
    message: '24小时热榜功能待实现',
    data: []
  });
});

/**
 * GET /api/rankings/hot-7d
 * 获取7天热榜（预留接口）
 * 
 * TODO: 实现基于 novel_advanced_stats_daily 的7天热度统计
 */
router.get('/hot-7d', async (req, res) => {
  res.json({
    success: true,
    message: '7天热榜功能待实现',
    data: []
  });
});

/**
 * GET /api/rankings/top-rated
 * 获取高分榜（预留接口）
 * 
 * TODO: 实现基于 avg_rating 和 rating_count 的排序
 */
router.get('/top-rated', async (req, res) => {
  res.json({
    success: true,
    message: '高分榜功能待实现',
    data: []
  });
});

/**
 * GET /api/rankings/best-seller
 * 获取畅销榜（预留接口）
 * 
 * TODO: 实现基于 total_chapter_revenue + total_champion_revenue 的排序
 */
router.get('/best-seller', async (req, res) => {
  res.json({
    success: true,
    message: '畅销榜功能待实现',
    data: []
  });
});

module.exports = router;

