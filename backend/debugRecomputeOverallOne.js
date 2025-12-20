require('dotenv').config();

/**
 * debugRecomputeOverallOne.js
 *
 * 用途：只针对单个 novelId 复跑 recomputeOverallScores() 的同样逻辑，
 * 输出每个阶段的中间结果（rawMetrics / dimScores），并执行同样的 upsert 写入 novel_overall_scores。
 *
 * 注意：这是“排查与可观测性”脚本，不改业务口径、不改评分公式，但会写入 novel_overall_scores（覆盖该 novelId）。
 *
 * 用法：
 *   node debugRecomputeOverallOne.js <novelId>
 *
 * 示例：
 *   node debugRecomputeOverallOne.js 15
 */

const mysql = require('mysql2/promise');
const novelAnalyticsService = require('./services/novelAnalyticsService');

// 数据库配置（与服务保持一致）
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '123456',
  database: process.env.DB_NAME || 'kongfuworld',
  charset: 'utf8mb4'
};

const __columnExistsCache = new Map();

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

function toNum(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function logStage(stage, value) {
  const prefix = `[overall-one][${stage}]`;
  if (value === undefined) console.log(prefix);
  else console.log(prefix, value);
}

async function main() {
  const [, , novelIdArg] = process.argv;
  const novelId = Number(novelIdArg);
  if (!novelIdArg || !Number.isFinite(novelId) || !Number.isInteger(novelId) || novelId <= 0) {
    console.log('用法：node debugRecomputeOverallOne.js <novelId>');
    console.log('示例：node debugRecomputeOverallOne.js 15');
    process.exit(1);
  }

  let connection;
  try {
    connection = await mysql.createConnection(dbConfig);

    logStage('start', { novelId });

    // 确认小说存在 + 状态
    const [novelRows] = await connection.execute(
      `SELECT id, title, review_status, created_at FROM novel WHERE id = ? LIMIT 1`,
      [novelId]
    );
    if (novelRows.length === 0) {
      console.error(`novel 不存在：${novelId}`);
      process.exit(2);
    }
    logStage('novel', novelRows[0]);

    // 1) 累计基础数据（daily 聚合）
    logStage('totalStats.before');
    const [totalStats] = await connection.execute(
      `
        SELECT
          COALESCE(SUM(views), 0) as total_views,
          COALESCE(SUM(chapter_revenue), 0) as total_chapter_revenue,
          COALESCE(SUM(champion_revenue), 0) as total_champion_revenue,
          COALESCE(SUM(new_comments), 0) as total_comments,
          COALESCE(SUM(new_paragraph_comments), 0) as total_paragraph_comments
        FROM novel_advanced_stats_daily
        WHERE novel_id = ?
      `,
      [novelId]
    );
    logStage('totalStats.after', totalStats[0]);

    // 2) 累计唯一读者数（reading_log 明细）
    logStage('uniqueReaders.before');
    const [uniqueReaders] = await connection.execute(
      `
        SELECT COUNT(DISTINCT rl.user_id) as total_unique_readers
        FROM reading_log rl
        INNER JOIN chapter c ON rl.chapter_id = c.id
        WHERE c.novel_id = ?
      `,
      [novelId]
    );
    logStage('uniqueReaders.after', uniqueReaders[0]);

    // 3) 累计评论数（comment，按字段存在性选择 strategy）
    logStage('comments.before');
    const commentHasTargetType = await hasColumn(connection, 'comment', 'target_type');
    const commentHasNovelId = await hasColumn(connection, 'comment', 'novel_id');
    const commentHasTargetId = await hasColumn(connection, 'comment', 'target_id');

    let totalComments = [{ total_comments: 0 }];
    if (commentHasNovelId) {
      const where = commentHasTargetType
        ? "WHERE novel_id = ? AND target_type = 'chapter'"
        : 'WHERE novel_id = ?';
      [totalComments] = await connection.execute(
        `
          SELECT COUNT(*) as total_comments
          FROM comment
          ${where}
        `,
        [novelId]
      );
    } else if (commentHasTargetId) {
      const where = commentHasTargetType
        ? "WHERE c.novel_id = ? AND com.target_type = 'chapter'"
        : 'WHERE c.novel_id = ?';
      [totalComments] = await connection.execute(
        `
          SELECT COUNT(*) as total_comments
          FROM comment com
          INNER JOIN chapter c ON com.target_id = c.id
          ${where}
        `,
        [novelId]
      );
    }
    logStage('comments.after', {
      total_comments: totalComments[0].total_comments,
      strategy: commentHasNovelId ? 'comment.novel_id' : (commentHasTargetId ? 'comment.target_id->chapter' : 'none'),
      has_target_type: commentHasTargetType
    });

    // 4) 累计段评数（paragraph_comment）
    logStage('paragraph.before');
    const pcHasNovelId = await hasColumn(connection, 'paragraph_comment', 'novel_id');
    const pcHasChapterId = await hasColumn(connection, 'paragraph_comment', 'chapter_id');
    const pcHasIsDeleted = await hasColumn(connection, 'paragraph_comment', 'is_deleted');

    let totalParagraphComments = [{ total_paragraph_comments: 0 }];
    if (pcHasNovelId) {
      const where = pcHasIsDeleted ? 'WHERE novel_id = ? AND is_deleted = 0' : 'WHERE novel_id = ?';
      [totalParagraphComments] = await connection.execute(
        `
          SELECT COUNT(*) as total_paragraph_comments
          FROM paragraph_comment
          ${where}
        `,
        [novelId]
      );
    } else if (pcHasChapterId) {
      const where = pcHasIsDeleted ? 'WHERE c.novel_id = ? AND pc.is_deleted = 0' : 'WHERE c.novel_id = ?';
      [totalParagraphComments] = await connection.execute(
        `
          SELECT COUNT(*) as total_paragraph_comments
          FROM paragraph_comment pc
          INNER JOIN chapter c ON pc.chapter_id = c.id
          ${where}
        `,
        [novelId]
      );
    }
    logStage('paragraph.after', {
      total_paragraph_comments: totalParagraphComments[0].total_paragraph_comments,
      strategy: pcHasNovelId ? 'paragraph_comment.novel_id' : (pcHasChapterId ? 'paragraph_comment.chapter_id->chapter' : 'none'),
      has_is_deleted: pcHasIsDeleted
    });

    // 5) 评分数据（review）
    logStage('review.before');
    const [ratingStats] = await connection.execute(
      `
        SELECT
          COALESCE(AVG(rating), 0) as avg_rating,
          COUNT(*) as rating_count
        FROM review
        WHERE novel_id = ? AND rating IS NOT NULL
      `,
      [novelId]
    );
    logStage('review.after', ratingStats[0]);

    const totalData = {
      total_views: toNum(totalStats[0].total_views, 0),
      total_unique_readers: toNum(uniqueReaders[0].total_unique_readers, 0),
      total_chapter_revenue: toNum(totalStats[0].total_chapter_revenue, 0),
      total_champion_revenue: toNum(totalStats[0].total_champion_revenue, 0),
      total_comments: Math.max(toNum(totalStats[0].total_comments, 0), toNum(totalComments[0].total_comments, 0)),
      total_paragraph_comments: Math.max(
        toNum(totalStats[0].total_paragraph_comments, 0),
        toNum(totalParagraphComments[0].total_paragraph_comments, 0)
      ),
      avg_rating: toNum(ratingStats[0].avg_rating, 0),
      rating_count: toNum(ratingStats[0].rating_count, 0)
    };
    logStage('totalData', totalData);

    // 6) recentStats（最近 7 天 daily 聚合）
    logStage('recentStats.before');
    const [recentStats] = await connection.execute(
      `
        SELECT
          COALESCE(AVG(effective_reads), 0) as avg_effective_reads,
          COALESCE(AVG(avg_stay_duration_sec), 0) as avg_stay_duration_sec,
          COALESCE(AVG(finish_rate), 0) as avg_finish_rate,
          COALESCE(AVG(avg_read_chapters_per_user), 0) as avg_read_chapters_per_user,
          COALESCE(SUM(paid_reader_count), 0) as total_paid_reader_count
        FROM novel_advanced_stats_daily
        WHERE novel_id = ?
          AND stat_date >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
      `,
      [novelId]
    );
    logStage('recentStats.after', recentStats[0]);

    const rawMetrics = {
      ...totalData,
      effective_reads: toNum(recentStats[0].avg_effective_reads, 0),
      avg_stay_duration_sec: toNum(recentStats[0].avg_stay_duration_sec, 0),
      finish_rate: toNum(recentStats[0].avg_finish_rate, 0),
      avg_read_chapters_per_user: toNum(recentStats[0].avg_read_chapters_per_user, 0),
      paid_reader_count: toNum(recentStats[0].total_paid_reader_count, 0),
      recent_views_7d: toNum(totalStats[0].total_views, 0), // 与服务一致：简化用累计
      recent_engagement: totalData.total_comments + totalData.total_paragraph_comments,
      recent_revenue: totalData.total_chapter_revenue + totalData.total_champion_revenue
    };
    logStage('rawMetrics', rawMetrics);

    // 7) 打分（完全复用服务导出的评分函数）
    const popularityScore = novelAnalyticsService.calculatePopularityScore(rawMetrics);
    const engagementScore = novelAnalyticsService.calculateEngagementScore(rawMetrics);
    const monetizationScore = novelAnalyticsService.calculateMonetizationScore(rawMetrics);
    const reputationScore = novelAnalyticsService.calculateReputationScore(rawMetrics);
    const communityScore = novelAnalyticsService.calculateCommunityScore(rawMetrics);
    const finalScore = novelAnalyticsService.calculateFinalScore({
      popularity: popularityScore,
      engagement: engagementScore,
      monetization: monetizationScore,
      reputation: reputationScore,
      community: communityScore
    });

    const dimScores = {
      popularity: popularityScore,
      engagement: engagementScore,
      monetization: monetizationScore,
      reputation: reputationScore,
      community: communityScore,
      final: finalScore
    };
    // 冷启动判定与 final_score 权重选择（与服务保持一致）
    const createdAtMs = novelRows[0] && novelRows[0].created_at ? new Date(novelRows[0].created_at).getTime() : NaN;
    const daysSinceCreated = Number.isFinite(createdAtMs)
      ? (Date.now() - createdAtMs) / (1000 * 60 * 60 * 24)
      : Number.POSITIVE_INFINITY;
    const isColdStart = daysSinceCreated < 7 || rawMetrics.effective_reads === 0;
    logStage('coldStart', { isColdStart, daysSinceCreated });

    // 额外打印：服务侧 final_score 是否应使用冷启动权重
    if (isColdStart) {
      logStage('finalWeight', { popularity: 0.35, monetization: 0.25, reputation: 0.2, community: 0.2, engagement: 'excluded' });
    } else {
      logStage('finalWeight', { popularity: 0.25, engagement: 0.25, monetization: 0.2, reputation: 0.15, community: 0.15 });
    }

    logStage('dimScores', dimScores);

    // 8) upsert（与服务一致）
    logStage('upsert.before');
    await connection.execute(
      `
        INSERT INTO novel_overall_scores (
          novel_id, total_views, total_unique_readers, total_chapter_revenue, total_champion_revenue,
          total_comments, total_paragraph_comments, avg_rating, rating_count,
          popularity_score, engagement_score, monetization_score, reputation_score, community_score,
          final_score, last_calculated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
        ON DUPLICATE KEY UPDATE
          total_views = VALUES(total_views),
          total_unique_readers = VALUES(total_unique_readers),
          total_chapter_revenue = VALUES(total_chapter_revenue),
          total_champion_revenue = VALUES(total_champion_revenue),
          total_comments = VALUES(total_comments),
          total_paragraph_comments = VALUES(total_paragraph_comments),
          avg_rating = VALUES(avg_rating),
          rating_count = VALUES(rating_count),
          popularity_score = VALUES(popularity_score),
          engagement_score = VALUES(engagement_score),
          monetization_score = VALUES(monetization_score),
          reputation_score = VALUES(reputation_score),
          community_score = VALUES(community_score),
          final_score = VALUES(final_score),
          last_calculated_at = NOW(),
          updated_at = NOW()
      `,
      [
        novelId,
        totalData.total_views,
        totalData.total_unique_readers,
        totalData.total_chapter_revenue,
        totalData.total_champion_revenue,
        totalData.total_comments,
        totalData.total_paragraph_comments,
        totalData.avg_rating,
        totalData.rating_count,
        popularityScore,
        engagementScore,
        monetizationScore,
        reputationScore,
        communityScore,
        finalScore
      ]
    );
    logStage('upsert.after');

    // 9) 读取落库结果用于对照
    const [saved] = await connection.execute(
      `
        SELECT novel_id, popularity_score, engagement_score, monetization_score, reputation_score, community_score, final_score,
               last_calculated_at, updated_at
        FROM novel_overall_scores
        WHERE novel_id = ?
      `,
      [novelId]
    );
    logStage('savedRow', saved && saved[0] ? saved[0] : null);

    logStage('done', { novelId });
  } finally {
    if (connection) await connection.end();
  }
}

main().catch((err) => {
  console.error('debugRecomputeOverallOne 运行失败:', err && err.stack ? err.stack : err);
  process.exit(1);
});


