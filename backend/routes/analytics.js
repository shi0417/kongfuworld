/**
 * 作品数据评价系统 - 统计分析接口
 * 
 * 接口列表：
 * - GET /api/analytics/novels/:novelId/daily - 获取每日统计数据
 * - GET /api/analytics/novels/:novelId/summary - 获取综合评分摘要
 *
 * Champion 分摊口径说明（重要）：
 * - daily.champion_revenue：时间型订阅收入（按服务期覆盖日分摊），与阅读行为无关
 * - daily.champion_active_count：当日有效订阅用户数（服务期覆盖且 is_active=1），不是当日阅读活跃人数
 * - summary.total_champion_revenue：对 daily.champion_revenue 的累计求和（应计口径），不是收款日现金流（created_at 口径）
 */

const express = require('express');
const mysql = require('mysql2/promise');
const router = express.Router();

// 字段存在性缓存（避免未迁移时直接报 Unknown column）
const __columnExistsCache = new Map(); // key: `${table}.${column}` => boolean
async function hasColumn(connection, tableName, columnName) {
  const key = `${tableName}.${columnName}`;
  if (__columnExistsCache.has(key)) return __columnExistsCache.get(key);
  const [rows] = await connection.execute(
    `
      SELECT 1 as ok
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = ?
        AND COLUMN_NAME = ?
      LIMIT 1
    `,
    [tableName, columnName]
  );
  const exists = rows.length > 0;
  __columnExistsCache.set(key, exists);
  return exists;
}

// 数据库配置
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '123456',
  database: process.env.DB_NAME || 'kongfuworld',
  charset: 'utf8mb4'
};

/**
 * GET /api/analytics/novels/:novelId/daily
 * 获取指定小说的每日统计数据
 * 
 * 参数：
 * - novelId: 小说ID（路径参数）
 * - startDate: 开始日期（可选，查询参数，格式：YYYY-MM-DD）
 * - endDate: 结束日期（可选，查询参数，格式：YYYY-MM-DD）
 * 
 * 返回：novel_advanced_stats_daily 的列表
 */
router.get('/novels/:novelId/daily', async (req, res) => {
  let connection;
  try {
    const novelId = parseInt(req.params.novelId);
    const { startDate, endDate } = req.query;
    
    if (isNaN(novelId)) {
      return res.status(400).json({
        success: false,
        message: '无效的小说ID'
      });
    }
    
    connection = await mysql.createConnection(dbConfig);
    
    const hasNewChapterLikes = await hasColumn(connection, 'novel_advanced_stats_daily', 'new_chapter_likes');
    const hasNewChapterDislikes = await hasColumn(connection, 'novel_advanced_stats_daily', 'new_chapter_dislikes');

    // 构建查询条件
    let query = `
      SELECT 
        id, novel_id, stat_date,
        views, unique_readers, views_24h, views_7d,
        effective_reads, avg_stay_duration_sec, finish_rate, avg_read_chapters_per_user,
        paid_unlock_count, time_unlock_count, paid_reader_count,
        chapter_revenue, champion_revenue, champion_active_count,
        rating_count, rating_sum, avg_rating_snapshot,
        new_comments, new_paragraph_comments, new_comment_likes, new_comment_dislikes
        ${hasNewChapterLikes ? ', new_chapter_likes' : ''}
        ${hasNewChapterDislikes ? ', new_chapter_dislikes' : ''}
        ,
        created_at, updated_at
      FROM novel_advanced_stats_daily
      WHERE novel_id = ?
    `;
    const params = [novelId];
    
    if (startDate) {
      query += ` AND stat_date >= ?`;
      params.push(startDate);
    }
    
    if (endDate) {
      query += ` AND stat_date <= ?`;
      params.push(endDate);
    }
    
    query += ` ORDER BY stat_date DESC LIMIT 365`; // 最多返回365天数据
    
    const [stats] = await connection.execute(query, params);
    
    res.json({
      success: true,
      data: stats,
      count: stats.length
    });
    
  } catch (error) {
    console.error('获取每日统计数据失败:', error);
    res.status(500).json({
      success: false,
      message: '获取每日统计数据失败',
      error: error.message
    });
  } finally {
    if (connection) {
      await connection.end();
    }
  }
});

/**
 * GET /api/analytics/novels/:novelId/summary
 * 获取指定小说的综合评分摘要
 * 
 * 参数：
 * - novelId: 小说ID（路径参数）
 * 
 * 返回：novel_overall_scores 中该小说的维度评分 + 累计数据
 */
router.get('/novels/:novelId/summary', async (req, res) => {
  let connection;
  try {
    const novelId = parseInt(req.params.novelId);
    
    if (isNaN(novelId)) {
      return res.status(400).json({
        success: false,
        message: '无效的小说ID'
      });
    }
    
    connection = await mysql.createConnection(dbConfig);
    
    // 查询综合评分数据
    const [scores] = await connection.execute(`
      SELECT 
        novel_id,
        total_views, total_unique_readers,
        total_chapter_revenue, total_champion_revenue,
        total_comments, total_paragraph_comments,
        avg_rating, rating_count,
        popularity_score, engagement_score, monetization_score, 
        reputation_score, community_score,
        final_score,
        last_calculated_at, created_at, updated_at
      FROM novel_overall_scores
      WHERE novel_id = ?
    `, [novelId]);
    
    if (scores.length === 0) {
      return res.json({
        success: true,
        data: null,
        message: '该小说暂无统计数据'
      });
    }
    
    res.json({
      success: true,
      data: scores[0]
    });
    
  } catch (error) {
    console.error('获取综合评分摘要失败:', error);
    res.status(500).json({
      success: false,
      message: '获取综合评分摘要失败',
      error: error.message
    });
  } finally {
    if (connection) {
      await connection.end();
    }
  }
});

module.exports = router;

