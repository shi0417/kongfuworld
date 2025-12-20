/**
 * 作品数据评价系统 - 统计分析服务
 * 
 * 功能：
 * 1. 计算每日统计数据（computeDailyStatsForDate）
 * 2. 计算综合评分（recomputeOverallScores）
 * 3. 评分函数（各维度评分计算）
 */

const mysql = require('mysql2/promise');
const cron = require('node-cron');
const fs = require('fs');
const path = require('path');

// 数据库配置
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '123456',
  database: process.env.DB_NAME || 'kongfuworld',
  charset: 'utf8mb4'
};

/**
 * INFORMATION_SCHEMA 字段存在性缓存
 * 目的：兼容不同环境下（或历史迁移不同步）导致的表字段差异，避免统计任务因某个字段缺失直接崩溃。
 */
const __columnExistsCache = new Map(); // key: `${table}.${column}` => boolean
const __tableExistsCache = new Map(); // key: `${table}` => boolean

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

async function hasTable(connection, tableName) {
  const key = `${tableName}`;
  if (__tableExistsCache.has(key)) return __tableExistsCache.get(key);

  const [rows] = await connection.execute(
    `
      SELECT 1 as ok
      FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = ?
      LIMIT 1
    `,
    [tableName]
  );

  const exists = rows.length > 0;
  __tableExistsCache.set(key, exists);
  return exists;
}

/**
 * 将 MySQL 返回的数值（常见为 string，如 DECIMAL/AVG/SUM）安全转换为 number。
 * 仅做类型修复：不改业务口径、不改公式；NaN/Infinity 兜底为 fallback（默认 0）。
 */
function toNum(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * 只做诊断：发现参与度评分输入不是 number/NaN 时打印错误日志，不抛异常、不改变流程。
 */
function assertNumeric(novelId, name, value) {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    console.error(`[ENGAGEMENT_ASSERT][novel=${novelId}] ${name} not number`, {
      value,
      type: typeof value
    });
  }
}

function parseYmdToLocalDate(ymd) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(ymd || '').trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const d = new Date(year, month - 1, day);
  d.setHours(0, 0, 0, 0);
  // guard rollover (e.g. 2025-02-31)
  if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) return null;
  return d;
}

function formatLocalYmd(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function nextDateYmd(ymd) {
  const d = parseYmdToLocalDate(ymd);
  if (!d) return null;
  d.setDate(d.getDate() + 1);
  return formatLocalYmd(d);
}

/**
 * 计算指定日期的每日统计数据
 * @param {string|Date} statDate - 统计日期（YYYY-MM-DD 格式字符串或 Date 对象）
 */
async function computeDailyStatsForDate(statDate) {
  let connection;
  try {
    /**
     * ===========================
     * 作品数据统计口径说明（重要）
     * ===========================
     * 粒度：
     * - 按 novel_id + stat_date（自然日）落库到 novel_advanced_stats_daily（每日统计表）
     *
     * 时间窗口：
     * - dayStart/dayEnd 使用半开区间 [dayStart, dayEnd)
     * - “服务期覆盖判定”统一采用：start_date < dayEnd AND end_date > dayStart
     *   含义：订阅服务期与当日窗口有交集就计入当天（不要求发生任何阅读/访问行为）
     *
     * Champion 指标（请务必注意）：
     * - champion_revenue：时间型订阅收入（按服务期覆盖日分摊），与阅读行为无关
     * - champion_active_count：当日有效订阅用户数（服务期覆盖且 is_active=1），不是当日阅读活跃人数
     *
     * 现金流口径 vs 分摊口径：
     * - 现金流（收款日）常见按 user_champion_subscription_record.created_at 聚合（例如 admin 报表）
     * - 本统计采用分摊口径（服务期覆盖日），不要把 champion_revenue 改成 created_at 口径
     * - 严禁引入 reading_log/join 或“当日阅读才计入”的过滤条件（那是另一类指标）
     */

    // 标准化日期格式
    const dateStr = statDate instanceof Date 
      ? statDate.toISOString().split('T')[0] 
      : statDate;
    const nextDateStr = nextDateYmd(dateStr);
    if (!nextDateStr) {
      throw new Error(`Invalid statDate: ${dateStr} (expected YYYY-MM-DD)`);
    }
    // 统一使用 dayStart/dayEnd 边界，避免 DATE() 包裹字段影响索引
    const dayStart = `${dateStr} 00:00:00`;
    const dayEnd = `${nextDateStr} 00:00:00`;
    const analyticsDebug = String(process.env.ANALYTICS_DEBUG || '') === '1';
    
    console.log(`[作品数据统计] 开始计算 ${dateStr} 的统计数据...`);
    
    connection = await mysql.createConnection(dbConfig);
    
    // 获取所有小说ID
    const [novels] = await connection.execute(
      `SELECT id FROM novel WHERE review_status = 'published'`
    );
    
    if (novels.length === 0) {
      console.log(`[作品数据统计] 没有已发布的小说`);
      return;
    }
    
    console.log(`[作品数据统计] 找到 ${novels.length} 本已发布的小说`);
    
    let processedCount = 0;
    
    for (const novel of novels) {
      const novelId = novel.id;
      
      try {
        // 1. 基础访问指标
        // 从 reading_log 统计（通过 chapter 关联到 novel）
        const [viewStats] = await connection.execute(`
          SELECT 
            COUNT(*) as views,
            COUNT(DISTINCT rl.user_id) as unique_readers
          FROM reading_log rl
          INNER JOIN chapter c ON rl.chapter_id = c.id
          WHERE c.novel_id = ? 
            AND rl.read_at >= ? AND rl.read_at < ?
        `, [novelId, dayStart, dayEnd]);
        
        // 24小时和7天浏览量（从 novel_statistics 表聚合，如果存在）
        const [views24h] = await connection.execute(`
          SELECT COALESCE(SUM(views), 0) as views_24h
          FROM novel_statistics
          WHERE novel_id = ? 
            AND date >= DATE_SUB(?, INTERVAL 1 DAY)
            AND date <= ?
        `, [novelId, dateStr, dateStr]);
        
        const [views7d] = await connection.execute(`
          SELECT COALESCE(SUM(views), 0) as views_7d
          FROM novel_statistics
          WHERE novel_id = ? 
            AND date >= DATE_SUB(?, INTERVAL 7 DAY)
            AND date <= ?
        `, [novelId, dateStr, dateStr]);
        
        // 2. 阅读深度指标
        // 有效阅读数（停留时间 > 10秒）
        const [effectiveReads] = await connection.execute(`
          SELECT COUNT(*) as effective_reads
          FROM reading_log rl
          INNER JOIN chapter c ON rl.chapter_id = c.id
          WHERE c.novel_id = ? 
            AND rl.read_at >= ? AND rl.read_at < ?
            AND rl.stay_duration > 10
        `, [novelId, dayStart, dayEnd]);
        
        // 平均停留时长
        const [avgStay] = await connection.execute(`
          SELECT 
            COALESCE(AVG(rl.stay_duration), 0) as avg_stay_duration_sec,
            COUNT(DISTINCT rl.user_id) as unique_readers_count
          FROM reading_log rl
          INNER JOIN chapter c ON rl.chapter_id = c.id
          WHERE c.novel_id = ? 
            AND rl.read_at >= ? AND rl.read_at < ?
            AND rl.stay_duration IS NOT NULL
        `, [novelId, dayStart, dayEnd]);
        
        // finish_rate（临时代理指标）：基于 stay_duration 的“完成率”
        // 分母：当天 stay_duration IS NOT NULL 的阅读记录数
        // 分子：当天 stay_duration >= 10 的阅读记录数
        const [finishRateRows] = await connection.execute(
          `
            SELECT
              COALESCE(
                SUM(CASE WHEN rl.stay_duration >= 10 THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0),
                0
              ) AS finish_rate
            FROM reading_log rl
            INNER JOIN chapter c ON rl.chapter_id = c.id
            WHERE c.novel_id = ?
              AND rl.read_at >= ? AND rl.read_at < ?
              AND rl.stay_duration IS NOT NULL
          `,
          [novelId, dayStart, dayEnd]
        );

        const finishRateValue = Number(finishRateRows[0]?.finish_rate) || 0;
        
        // 平均每用户阅读章节数
        const [avgChapters] = await connection.execute(`
          SELECT 
            COUNT(*) / NULLIF(COUNT(DISTINCT rl.user_id), 0) as avg_read_chapters_per_user
          FROM reading_log rl
          INNER JOIN chapter c ON rl.chapter_id = c.id
          WHERE c.novel_id = ? 
            AND rl.read_at >= ? AND rl.read_at < ?
        `, [novelId, dayStart, dayEnd]);
        
        // 3. 解锁相关指标
        const [unlockStats] = await connection.execute(`
          SELECT 
            COUNT(CASE WHEN unlock_method IN ('key', 'karma') THEN 1 END) as paid_unlock_count,
            COUNT(CASE WHEN unlock_method = 'time_unlock' THEN 1 END) as time_unlock_count,
            COUNT(DISTINCT CASE WHEN unlock_method IN ('key', 'karma') THEN user_id END) as paid_reader_count
          FROM chapter_unlocks cu
          INNER JOIN chapter c ON cu.chapter_id = c.id
          WHERE c.novel_id = ? 
            AND cu.unlocked_at >= ? AND cu.unlocked_at < ?
            AND cu.status = 'unlocked'
        `, [novelId, dayStart, dayEnd]);
        
        // 4. 收入指标
        // chapter_revenue（USD）：只统计 unlock_method='karma'，并用 karma_dollars 按解锁时刻换算 USD
        // - key 解锁不计入收入
        // - 找不到生效汇率：该条按 0 处理，同时 warn（包含 chapter_unlocks.id/novel_id/unlocked_at）
        const karmaDollarsExists = await hasTable(connection, 'karma_dollars');
        let chapterRevenue = [{ chapter_revenue: 0 }];
        if (karmaDollarsExists) {
          [chapterRevenue] = await connection.execute(
            `
              SELECT
                COALESCE(
                  SUM(
                    cu.cost * COALESCE((
                      SELECT kd.usd_per_karma
                      FROM karma_dollars kd
                      WHERE kd.effective_from <= cu.unlocked_at
                        AND (kd.effective_to IS NULL OR kd.effective_to > cu.unlocked_at)
                      ORDER BY kd.effective_from DESC
                      LIMIT 1
                    ), 0)
                  ),
                  0
                ) AS chapter_revenue
              FROM chapter_unlocks cu
              INNER JOIN chapter ch ON ch.id = cu.chapter_id
              WHERE ch.novel_id = ?
                AND cu.status = 'unlocked'
                AND cu.unlock_method = 'karma'
                AND cu.cost > 0
                AND cu.unlocked_at >= ? AND cu.unlocked_at < ?
            `,
            [novelId, dayStart, dayEnd]
          );

          // 找不到生效汇率的记录：按 0 处理 + warn
          const [missingRateRows] = await connection.execute(
            `
              SELECT
                cu.id AS chapter_unlock_id,
                ch.novel_id AS novel_id,
                cu.unlocked_at AS unlocked_at
              FROM chapter_unlocks cu
              INNER JOIN chapter ch ON ch.id = cu.chapter_id
              WHERE ch.novel_id = ?
                AND cu.status = 'unlocked'
                AND cu.unlock_method = 'karma'
                AND cu.cost > 0
                AND cu.unlocked_at >= ? AND cu.unlocked_at < ?
                AND (
                  SELECT kd.usd_per_karma
                  FROM karma_dollars kd
                  WHERE kd.effective_from <= cu.unlocked_at
                    AND (kd.effective_to IS NULL OR kd.effective_to > cu.unlocked_at)
                  ORDER BY kd.effective_from DESC
                  LIMIT 1
                ) IS NULL
              LIMIT 50
            `,
            [novelId, dayStart, dayEnd]
          );
          if (missingRateRows.length > 0) {
            missingRateRows.forEach(r => {
              console.warn(
                `[作品数据统计][WARN] karma_dollars 未找到生效汇率: chapter_unlocks.id=${r.chapter_unlock_id}, novel_id=${r.novel_id}, unlocked_at=${r.unlocked_at}`
              );
            });
          }
        } else {
          console.warn('[作品数据统计][WARN] 缺少 karma_dollars 表，chapter_revenue 将按 0 处理');
        }

        /**
         * champion_revenue（分摊口径 / 时间型订阅收入，不看阅读行为）
         * - 数据源：user_champion_subscription_record
         * - 过滤：payment_status='completed' AND payment_amount>0
         * - 覆盖判定（半开区间交集）：start_date < dayEnd AND end_date > dayStart
         * - 分摊：SUM(payment_amount / subscription_duration_days)
         * - subscription_duration_days 为 0/NULL：该条按 0 处理并输出 warn
         *
         * 重要：不要 JOIN reading_log 或任何阅读表；不要增加“当日阅读才计入”的条件。
         */
        let championRevenue = [{ champion_revenue: 0 }];
        const subscriptionRecordExists = await hasTable(connection, 'user_champion_subscription_record');
        if (subscriptionRecordExists) {
          [championRevenue] = await connection.execute(
            `
              SELECT
                COALESCE(
                  SUM(
                    CASE
                      WHEN subscription_duration_days IS NULL OR subscription_duration_days = 0 THEN 0
                      ELSE payment_amount / subscription_duration_days
                    END
                  ),
                  0
                ) AS champion_revenue
              FROM user_champion_subscription_record
              WHERE novel_id = ?
                AND payment_status = 'completed'
                AND payment_amount > 0
                AND start_date < ?
                AND end_date > ?
            `,
            [novelId, dayEnd, dayStart]
          );

          // duration_days 异常：按 0 处理 + warn（包含 record id）
          const [badDurationRows] = await connection.execute(
            `
              SELECT id, subscription_duration_days
              FROM user_champion_subscription_record
              WHERE novel_id = ?
                AND payment_status = 'completed'
                AND payment_amount > 0
                AND start_date < ?
                AND end_date > ?
                AND (subscription_duration_days IS NULL OR subscription_duration_days = 0)
              LIMIT 50
            `,
            [novelId, dayEnd, dayStart]
          );
          if (badDurationRows.length > 0) {
            badDurationRows.forEach(r => {
              console.warn(
                `[作品数据统计][WARN] subscription_duration_days 异常(按0处理): subscription_record.id=${r.id}, subscription_duration_days=${r.subscription_duration_days}`
              );
            });
          }
        } else {
          console.warn('[作品数据统计][WARN] 缺少 user_champion_subscription_record 表，champion_revenue 将按 0 处理');
        }

        /**
         * champion_active_count（当日有效订阅用户数，不看阅读行为）
         * - 数据源：user_champion_subscription（状态表）
         * - 过滤：is_active = 1
         * - 覆盖判定（半开区间交集）：start_date < dayEnd AND end_date > dayStart
         * - 计数：COUNT(DISTINCT user_id)
         *
         * 重要：这不是“当日阅读活跃 Champion 用户数”，不要引入 reading_log 过滤。
         */
        let championActive = [{ champion_active_count: 0 }];
        const subscriptionStateExists = await hasTable(connection, 'user_champion_subscription');
        if (subscriptionStateExists) {
          [championActive] = await connection.execute(
            `
              SELECT
                COUNT(DISTINCT user_id) AS champion_active_count
              FROM user_champion_subscription
              WHERE novel_id = ?
                AND is_active = 1
                AND start_date < ?
                AND end_date > ?
            `,
            [novelId, dayEnd, dayStart]
          );
        } else {
          console.warn('[作品数据统计][WARN] 缺少 user_champion_subscription 表，champion_active_count 将按 0 处理');
        }
        
        // 5. 评价指标
        const [ratingStats] = await connection.execute(`
          SELECT 
            COUNT(*) as rating_count,
            COALESCE(SUM(rating), 0) as rating_sum,
            COALESCE(AVG(rating), 0) as avg_rating_snapshot
          FROM review
          WHERE novel_id = ? 
            AND DATE(created_at) = ?
            AND rating IS NOT NULL
        `, [novelId, dateStr]);
        
        // 6. 社区互动指标
        // 兼容说明：不同环境下 comment/paragraph_comment 字段可能不一致（例如 comment 没有 target_type / dislikes）。
        const commentHasTargetType = await hasColumn(connection, 'comment', 'target_type');
        const commentHasNovelId = await hasColumn(connection, 'comment', 'novel_id');
        const commentHasTargetId = await hasColumn(connection, 'comment', 'target_id');
        const commentHasLikes = await hasColumn(connection, 'comment', 'likes');
        const commentHasDislikes = await hasColumn(connection, 'comment', 'dislikes');

        // 新增评论数（默认按 novel_id 统计；若存在 target_type 则额外过滤 chapter）
        let commentWhere = '';
        let commentParams = [];
        if (commentHasNovelId) {
          commentWhere = 'WHERE com.novel_id = ? AND DATE(com.created_at) = ?';
          commentParams = [novelId, dateStr];
        } else if (commentHasTargetId) {
          // 兜底：没有 novel_id 时，通过 chapter 关联 novel_id
          commentWhere = 'WHERE c.novel_id = ? AND DATE(com.created_at) = ?';
          commentParams = [novelId, dateStr];
        } else {
          // 极端情况：comment 表缺失关键字段，直接返回 0
          commentWhere = null;
        }

        if (commentWhere && commentHasTargetType) {
          commentWhere += " AND com.target_type = 'chapter'";
        }

        let commentStats = [{ new_comments: 0 }];
        let commentLikeStats = [{ new_comment_likes: 0, new_comment_dislikes: 0 }];
        let chapterLikeStats = [{ new_chapter_likes: 0, new_chapter_dislikes: 0 }];

        if (commentWhere) {
          const commentFromJoin = commentHasNovelId
            ? 'FROM comment com'
            : 'FROM comment com INNER JOIN chapter c ON com.target_id = c.id';

          // 新增评论数
          [commentStats] = await connection.execute(
            `
              SELECT COUNT(*) as new_comments
              ${commentFromJoin}
              ${commentWhere}
            `,
            commentParams
          );

          // new_comment_likes / new_comment_dislikes（按“动作时间”统计）：使用 comment_like 明细表
          // - 仅统计章节评论
          // - 时间口径：comment_like.created_at 在 [dayStart, dayEnd)
          // - 事件语义：当天发生过动作的“最终态计数”（符合当前表设计：created_at 会被更新）
          const commentLikeTableExists = await hasTable(connection, 'comment_like');
          if (commentLikeTableExists) {
            const clHasIsLike = await hasColumn(connection, 'comment_like', 'is_like');
            const clHasCreatedAt = await hasColumn(connection, 'comment_like', 'created_at');
            const clTimeWhere = clHasCreatedAt ? 'cl.created_at >= ? AND cl.created_at < ?' : '1=0';

            // 归属 novel_id：优先 cm.novel_id，否则通过 cm.target_id -> chapter.id -> chapter.novel_id
            let likeFromJoin = '';
            let likeWhere = '';
            const likeParams = [];

            if (commentHasNovelId) {
              likeFromJoin = 'FROM comment_like cl INNER JOIN comment cm ON cm.id = cl.comment_id';
              likeWhere = `WHERE cm.novel_id = ? AND ${clTimeWhere}`;
              likeParams.push(novelId, dayStart, dayEnd);
            } else if (commentHasTargetId) {
              likeFromJoin =
                'FROM comment_like cl INNER JOIN comment cm ON cm.id = cl.comment_id INNER JOIN chapter ch ON cm.target_id = ch.id';
              likeWhere = `WHERE ch.novel_id = ? AND ${clTimeWhere}`;
              likeParams.push(novelId, dayStart, dayEnd);
            } else {
              likeFromJoin = null;
            }

            if (likeFromJoin && commentHasTargetType) {
              likeWhere += " AND cm.target_type = 'chapter'";
            }

            if (likeFromJoin) {
              const isLikeExpr = clHasIsLike ? 'cl.is_like' : '1';
              [commentLikeStats] = await connection.execute(
                `
                  SELECT
                    SUM(CASE WHEN ${isLikeExpr} = 1 THEN 1 ELSE 0 END) AS new_comment_likes,
                    SUM(CASE WHEN ${isLikeExpr} = 0 THEN 1 ELSE 0 END) AS new_comment_dislikes
                  ${likeFromJoin}
                  ${likeWhere}
                `,
                likeParams
              );
            }
          } else if (analyticsDebug) {
            console.warn('[作品数据统计][WARN] comment_like 表不存在，new_comment_likes/dislikes 将按 0 处理');
          }
        }

        // 章节点赞/点踩（chapter_like）：按“最后一次动作时间” created_at 统计日增量最终态
        // 归属到小说：chapter_like.chapter_id -> chapter.id -> chapter.novel_id
        // 时间口径：chapter_like.created_at in [dayStart, dayEnd)
        const chapterLikeTableExists = await hasTable(connection, 'chapter_like');
        if (chapterLikeTableExists) {
          const chLikeHasIsLike = await hasColumn(connection, 'chapter_like', 'is_like');
          const chLikeHasCreatedAt = await hasColumn(connection, 'chapter_like', 'created_at');
          if (chLikeHasCreatedAt) {
            const isLikeExpr = chLikeHasIsLike ? 'cl.is_like' : '1';
            [chapterLikeStats] = await connection.execute(
              `
                SELECT
                  SUM(CASE WHEN ${isLikeExpr} = 1 THEN 1 ELSE 0 END) AS new_chapter_likes,
                  SUM(CASE WHEN ${isLikeExpr} = 0 THEN 1 ELSE 0 END) AS new_chapter_dislikes
                FROM chapter_like cl
                INNER JOIN chapter ch ON ch.id = cl.chapter_id
                WHERE ch.novel_id = ?
                  AND cl.created_at >= ? AND cl.created_at < ?
              `,
              [novelId, dayStart, dayEnd]
            );
          } else if (analyticsDebug) {
            console.warn('[作品数据统计][WARN] chapter_like.created_at 字段不存在，new_chapter_likes/dislikes 将按 0 处理');
          }
        } else if (analyticsDebug) {
          console.warn('[作品数据统计][WARN] chapter_like 表不存在，new_chapter_likes/dislikes 将按 0 处理');
        }

        // 新增段落评论数（默认按 novel_id 统计；如果没有 is_deleted 字段则不加过滤）
        const pcHasNovelId = await hasColumn(connection, 'paragraph_comment', 'novel_id');
        const pcHasChapterId = await hasColumn(connection, 'paragraph_comment', 'chapter_id');
        const pcHasIsDeleted = await hasColumn(connection, 'paragraph_comment', 'is_deleted');

        let paragraphCommentWhere = '';
        let paragraphParams = [];
        if (pcHasNovelId) {
          paragraphCommentWhere = 'WHERE pc.novel_id = ? AND DATE(pc.created_at) = ?';
          paragraphParams = [novelId, dateStr];
        } else if (pcHasChapterId) {
          paragraphCommentWhere = 'WHERE c.novel_id = ? AND DATE(pc.created_at) = ?';
          paragraphParams = [novelId, dateStr];
        } else {
          paragraphCommentWhere = null;
        }

        if (paragraphCommentWhere && pcHasIsDeleted) {
          paragraphCommentWhere += ' AND pc.is_deleted = 0';
        }

        let paragraphCommentStats = [{ new_paragraph_comments: 0 }];
        if (paragraphCommentWhere) {
          const pcFromJoin = pcHasNovelId
            ? 'FROM paragraph_comment pc'
            : 'FROM paragraph_comment pc INNER JOIN chapter c ON pc.chapter_id = c.id';

          [paragraphCommentStats] = await connection.execute(
            `
              SELECT COUNT(*) as new_paragraph_comments
              ${pcFromJoin}
              ${paragraphCommentWhere}
            `,
            paragraphParams
          );
        }
        
        // 组装统计数据
        const stats = {
          novel_id: novelId,
          stat_date: dateStr,
          views: viewStats[0].views || 0,
          unique_readers: viewStats[0].unique_readers || 0,
          views_24h: views24h[0].views_24h || 0,
          views_7d: views7d[0].views_7d || 0,
          effective_reads: effectiveReads[0].effective_reads || 0,
          avg_stay_duration_sec: parseFloat(avgStay[0].avg_stay_duration_sec || 0),
          finish_rate: finishRateValue,
          avg_read_chapters_per_user: parseFloat(avgChapters[0].avg_read_chapters_per_user || 0),
          paid_unlock_count: unlockStats[0].paid_unlock_count || 0,
          time_unlock_count: unlockStats[0].time_unlock_count || 0,
          paid_reader_count: unlockStats[0].paid_reader_count || 0,
          // 避免 parseFloat 丢失精度：优先保留 mysql2 返回的 DECIMAL 字符串，让 MySQL DECIMAL 写入
          chapter_revenue: chapterRevenue[0].chapter_revenue || 0,
          champion_revenue: championRevenue[0].champion_revenue || 0,
          champion_active_count: championActive[0].champion_active_count || 0,
          rating_count: ratingStats[0].rating_count || 0,
          rating_sum: ratingStats[0].rating_sum || 0,
          avg_rating_snapshot: parseFloat(ratingStats[0].avg_rating_snapshot || 0),
          new_comments: commentStats[0].new_comments || 0,
          new_paragraph_comments: paragraphCommentStats[0].new_paragraph_comments || 0,
          new_comment_likes: commentLikeStats[0].new_comment_likes || 0,
          new_comment_dislikes: commentLikeStats[0].new_comment_dislikes || 0,
          new_chapter_likes: chapterLikeStats[0].new_chapter_likes || 0,
          new_chapter_dislikes: chapterLikeStats[0].new_chapter_dislikes || 0
        };

        if (analyticsDebug) {
          console.log(
            `[作品数据统计][DEBUG] novel_id=${novelId} date=${dateStr} views=${stats.views} unique_readers=${stats.unique_readers}` +
              ` chapter_revenue(karma_usd)=${stats.chapter_revenue} champion_revenue(proration)=${stats.champion_revenue}` +
              ` finish_rate(>=10s/non-null)=${stats.finish_rate} comment_like(+/-)=${stats.new_comment_likes}/${stats.new_comment_dislikes}` +
              ` chapter_like(+/-)=${stats.new_chapter_likes}/${stats.new_chapter_dislikes}`
          );
        }
        
        // 插入或更新统计数据
        // 兼容：当某些环境还未执行“新增字段迁移”时，避免因列不存在导致整天统计失败。
        const dailyHasNewChapterLikes = await hasColumn(connection, 'novel_advanced_stats_daily', 'new_chapter_likes');
        const dailyHasNewChapterDislikes = await hasColumn(connection, 'novel_advanced_stats_daily', 'new_chapter_dislikes');

        const insertColumns = [
          'novel_id',
          'stat_date',
          'views',
          'unique_readers',
          'views_24h',
          'views_7d',
          'effective_reads',
          'avg_stay_duration_sec',
          'finish_rate',
          'avg_read_chapters_per_user',
          'paid_unlock_count',
          'time_unlock_count',
          'paid_reader_count',
          'chapter_revenue',
          'champion_revenue',
          'champion_active_count',
          'rating_count',
          'rating_sum',
          'avg_rating_snapshot',
          'new_comments',
          'new_paragraph_comments',
          'new_comment_likes',
          'new_comment_dislikes'
        ];

        const insertValues = [
          stats.novel_id,
          stats.stat_date,
          stats.views,
          stats.unique_readers,
          stats.views_24h,
          stats.views_7d,
          stats.effective_reads,
          stats.avg_stay_duration_sec,
          stats.finish_rate,
          stats.avg_read_chapters_per_user,
          stats.paid_unlock_count,
          stats.time_unlock_count,
          stats.paid_reader_count,
          stats.chapter_revenue,
          stats.champion_revenue,
          stats.champion_active_count,
          stats.rating_count,
          stats.rating_sum,
          stats.avg_rating_snapshot,
          stats.new_comments,
          stats.new_paragraph_comments,
          stats.new_comment_likes,
          stats.new_comment_dislikes
        ];

        const updateClauses = [
          'views = VALUES(views)',
          'unique_readers = VALUES(unique_readers)',
          'views_24h = VALUES(views_24h)',
          'views_7d = VALUES(views_7d)',
          'effective_reads = VALUES(effective_reads)',
          'avg_stay_duration_sec = VALUES(avg_stay_duration_sec)',
          'finish_rate = VALUES(finish_rate)',
          'avg_read_chapters_per_user = VALUES(avg_read_chapters_per_user)',
          'paid_unlock_count = VALUES(paid_unlock_count)',
          'time_unlock_count = VALUES(time_unlock_count)',
          'paid_reader_count = VALUES(paid_reader_count)',
          'chapter_revenue = VALUES(chapter_revenue)',
          'champion_revenue = VALUES(champion_revenue)',
          'champion_active_count = VALUES(champion_active_count)',
          'rating_count = VALUES(rating_count)',
          'rating_sum = VALUES(rating_sum)',
          'avg_rating_snapshot = VALUES(avg_rating_snapshot)',
          'new_comments = VALUES(new_comments)',
          'new_paragraph_comments = VALUES(new_paragraph_comments)',
          'new_comment_likes = VALUES(new_comment_likes)',
          'new_comment_dislikes = VALUES(new_comment_dislikes)'
        ];

        if (dailyHasNewChapterLikes) {
          insertColumns.push('new_chapter_likes');
          insertValues.push(stats.new_chapter_likes);
          updateClauses.push('new_chapter_likes = VALUES(new_chapter_likes)');
        }
        if (dailyHasNewChapterDislikes) {
          insertColumns.push('new_chapter_dislikes');
          insertValues.push(stats.new_chapter_dislikes);
          updateClauses.push('new_chapter_dislikes = VALUES(new_chapter_dislikes)');
        }

        const placeholders = insertColumns.map(() => '?').join(', ');
        const insertSql = `
          INSERT INTO novel_advanced_stats_daily (${insertColumns.join(', ')})
          VALUES (${placeholders})
          ON DUPLICATE KEY UPDATE
            ${updateClauses.join(', ')},
            updated_at = NOW()
        `;

        await connection.execute(insertSql, insertValues);
        
        processedCount++;
        
      } catch (error) {
        console.error(`[作品数据统计] 处理小说 ${novelId} 时出错:`, error);
        // 继续处理下一本小说
      }
    }
    
    console.log(`[作品数据统计] 完成 ${dateStr} 的统计，处理了 ${processedCount}/${novels.length} 本小说`);
    
  } catch (error) {
    console.error(`[作品数据统计] 计算每日统计数据失败:`, error);
    throw error;
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

/**
 * 重新计算所有小说的综合评分
 */
async function recomputeOverallScores() {
  let connection;
  try {
    console.log(`[作品数据统计] 开始重新计算综合评分...`);
    
    connection = await mysql.createConnection(dbConfig);
    
    // 获取所有小说ID + created_at（用于冷启动判定）
    const [novels] = await connection.execute(
      `SELECT id, created_at FROM novel WHERE review_status = 'published'`
    );
    
    if (novels.length === 0) {
      console.log(`[作品数据统计] 没有已发布的小说`);
      return;
    }
    
    console.log(`[作品数据统计] 找到 ${novels.length} 本已发布的小说`);
    
    let processedCount = 0;
    
    const logsDir = path.resolve(__dirname, '..', 'logs');
    const overallErrorLogPath = path.join(logsDir, 'overall_recompute_errors.log');

    function ensureLogsDir() {
      try {
        if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });
      } catch (e) {
        // 仅可观测性：不影响主流程
        console.error('[作品数据统计] 创建 logs 目录失败（不影响统计流程）:', e && e.message ? e.message : e);
      }
    }

    function logStage(novelId, stage, when, extra) {
      const base = `[作品数据统计][overall][novel=${novelId}][${stage}][${when}]`;
      if (extra !== undefined) console.log(base, extra);
      else console.log(base);
    }

    for (const novel of novels) {
      const novelId = novel.id;
      
      try {
        logStage(novelId, 'loop', 'start');

        // 1. 累计基础数据（从每日统计表聚合）
        logStage(novelId, 'totalStats', 'before');
        const [totalStats] = await connection.execute(`
          SELECT 
            COALESCE(SUM(views), 0) as total_views,
            COALESCE(SUM(chapter_revenue), 0) as total_chapter_revenue,
            COALESCE(SUM(champion_revenue), 0) as total_champion_revenue,
            COALESCE(SUM(new_comments), 0) as total_comments,
            COALESCE(SUM(new_paragraph_comments), 0) as total_paragraph_comments
          FROM novel_advanced_stats_daily
          WHERE novel_id = ?
        `, [novelId]);
        logStage(novelId, 'totalStats', 'after', totalStats && totalStats[0] ? totalStats[0] : totalStats);
        
        // 从明细表补充数据（如果每日统计表没有数据）
        // 累计唯一读者数（从 reading_log 统计）
        logStage(novelId, 'uniqueReaders', 'before');
        const [uniqueReaders] = await connection.execute(`
          SELECT COUNT(DISTINCT rl.user_id) as total_unique_readers
          FROM reading_log rl
          INNER JOIN chapter c ON rl.chapter_id = c.id
          WHERE c.novel_id = ?
        `, [novelId]);
        logStage(novelId, 'uniqueReaders', 'after', uniqueReaders && uniqueReaders[0] ? uniqueReaders[0] : uniqueReaders);
        
        // 累计评论数（从 comment 表统计）
        logStage(novelId, 'comments', 'before');
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
        logStage(novelId, 'comments', 'after', {
          total_comments: totalComments && totalComments[0] ? totalComments[0].total_comments : 0,
          strategy: commentHasNovelId ? 'comment.novel_id' : (commentHasTargetId ? 'comment.target_id->chapter' : 'none'),
          has_target_type: commentHasTargetType
        });
        
        // 累计段落评论数
        logStage(novelId, 'paragraph', 'before');
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
        logStage(novelId, 'paragraph', 'after', {
          total_paragraph_comments: totalParagraphComments && totalParagraphComments[0] ? totalParagraphComments[0].total_paragraph_comments : 0,
          strategy: pcHasNovelId ? 'paragraph_comment.novel_id' : (pcHasChapterId ? 'paragraph_comment.chapter_id->chapter' : 'none'),
          has_is_deleted: pcHasIsDeleted
        });
        
        // 2. 评价数据（从 review 表统计）
        logStage(novelId, 'review', 'before');
        const [ratingStats] = await connection.execute(`
          SELECT 
            COALESCE(AVG(rating), 0) as avg_rating,
            COUNT(*) as rating_count
          FROM review
          WHERE novel_id = ? AND rating IS NOT NULL
        `, [novelId]);
        logStage(novelId, 'review', 'after', ratingStats && ratingStats[0] ? ratingStats[0] : ratingStats);
        
        // 组装累计数据
        const totalData = {
          total_views: toNum(totalStats[0].total_views, 0),
          // 累计唯一读者数：以 reading_log 明细去重统计为准
          total_unique_readers: toNum(uniqueReaders[0].total_unique_readers, 0),
          total_chapter_revenue: toNum(totalStats[0].total_chapter_revenue, 0),
          total_champion_revenue: toNum(totalStats[0].total_champion_revenue, 0),
          total_comments: Math.max(
            toNum(totalStats[0].total_comments, 0),
            toNum(totalComments[0].total_comments, 0)
          ),
          total_paragraph_comments: Math.max(
            toNum(totalStats[0].total_paragraph_comments, 0),
            toNum(totalParagraphComments[0].total_paragraph_comments, 0)
          ),
          avg_rating: toNum(ratingStats[0].avg_rating, 0),
          rating_count: toNum(ratingStats[0].rating_count, 0)
        };
        logStage(novelId, 'totalData', 'after', totalData);
        
        // 3. 从每日统计表获取最近7天的平均数据（用于参与度评分）
        logStage(novelId, 'recentStats', 'before');
        const [recentStats] = await connection.execute(`
          SELECT 
            COALESCE(AVG(effective_reads), 0) as avg_effective_reads,
            COALESCE(AVG(avg_stay_duration_sec), 0) as avg_stay_duration_sec,
            COALESCE(AVG(finish_rate), 0) as avg_finish_rate,
            COALESCE(AVG(avg_read_chapters_per_user), 0) as avg_read_chapters_per_user,
            COALESCE(SUM(paid_reader_count), 0) as total_paid_reader_count
          FROM novel_advanced_stats_daily
          WHERE novel_id = ?
            AND stat_date >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
        `, [novelId]);
        logStage(novelId, 'recentStats', 'after', recentStats && recentStats[0] ? recentStats[0] : recentStats);
        
        // 3. 计算各维度评分
        const rawMetrics = {
          ...totalData,
          // 从每日统计表获取最近7天的平均数据
          effective_reads: toNum(recentStats[0].avg_effective_reads, 0),
          avg_stay_duration_sec: toNum(recentStats[0].avg_stay_duration_sec, 0),
          finish_rate: toNum(recentStats[0].avg_finish_rate, 0),
          avg_read_chapters_per_user: toNum(recentStats[0].avg_read_chapters_per_user, 0),
          paid_reader_count: toNum(recentStats[0].total_paid_reader_count, 0),
          recent_views_7d: toNum(totalStats[0].total_views, 0), // 简化处理，使用累计值
          recent_engagement: totalData.total_comments + totalData.total_paragraph_comments,
          recent_revenue: totalData.total_chapter_revenue + totalData.total_champion_revenue
        };
        logStage(novelId, 'rawMetrics', 'after', rawMetrics);

        // 参与度评分输入类型断言（仅日志，不影响流程）
        assertNumeric(novelId, 'effective_reads', rawMetrics.effective_reads);
        assertNumeric(novelId, 'avg_stay_duration_sec', rawMetrics.avg_stay_duration_sec);
        assertNumeric(novelId, 'finish_rate', rawMetrics.finish_rate);
        assertNumeric(novelId, 'avg_read_chapters_per_user', rawMetrics.avg_read_chapters_per_user);
        
        const popularityScore = calculatePopularityScore(rawMetrics);
        const engagementScore = calculateEngagementScore(rawMetrics);
        const monetizationScore = calculateMonetizationScore(rawMetrics);
        const reputationScore = calculateReputationScore(rawMetrics);
        const communityScore = calculateCommunityScore(rawMetrics);

        const dimScores = {
          popularity: popularityScore,
          engagement: engagementScore,
          monetization: monetizationScore,
          reputation: reputationScore,
          community: communityScore
        };
        logStage(novelId, 'dimScores', 'after', dimScores);
        
        // 4. 计算综合评分（冷启动策略：engagement 仍计算/落库，但不参与 final_score 权重）
        const createdAtMs = novel && novel.created_at ? new Date(novel.created_at).getTime() : NaN;
        const daysSinceCreated = Number.isFinite(createdAtMs)
          ? (Date.now() - createdAtMs) / (1000 * 60 * 60 * 24)
          : Number.POSITIVE_INFINITY;

        const isColdStart = daysSinceCreated < 7 || rawMetrics.effective_reads === 0;
        logStage(novelId, 'coldStart', 'after', { isColdStart, daysSinceCreated });

        let finalScore;
        if (!isColdStart) {
          // 原权重不变
          finalScore = calculateFinalScore({
            popularity: popularityScore,
            engagement: engagementScore,
            monetization: monetizationScore,
            reputation: reputationScore,
            community: communityScore
          });
        } else {
          // 冷启动：移除 engagement 权重，重新分配到其它维度（总和=1）
          // popularity 0.35 / monetization 0.25 / reputation 0.20 / community 0.20
          finalScore = toNum(popularityScore, 0) * 0.35
            + toNum(monetizationScore, 0) * 0.25
            + toNum(reputationScore, 0) * 0.20
            + toNum(communityScore, 0) * 0.20;
          finalScore = parseFloat(finalScore.toFixed(2));
        }
        logStage(novelId, 'finalScore', 'after', finalScore);
        
        // 5. 插入或更新综合评分
        logStage(novelId, 'upsert', 'before');
        await connection.execute(`
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
        `, [
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
        ]);
        logStage(novelId, 'upsert', 'after');
        
        processedCount++;
        logStage(novelId, 'loop', 'done');
        
      } catch (error) {
        const msg = error && error.message ? error.message : String(error);
        const stack = error && error.stack ? error.stack : '';
        console.error(`[作品数据统计] 处理小说 ${novelId} 的综合评分时出错:`, msg);
        if (stack) console.error(stack);

        // 追加写入本地日志文件：backend/logs/overall_recompute_errors.log
        try {
          ensureLogsDir();
          const line = [
            '-----',
            `time=${new Date().toISOString()}`,
            `novelId=${novelId}`,
            `message=${msg}`,
            stack ? `stack=${stack}` : 'stack=',
            ''
          ].join('\n');
          fs.appendFileSync(overallErrorLogPath, line, 'utf8');
        } catch (e) {
          console.error('[作品数据统计] 写入 overall_recompute_errors.log 失败（不影响统计流程）:', e && e.message ? e.message : e);
        }
        // 继续处理下一本小说
      }
    }
    
    console.log(`[作品数据统计] 完成综合评分计算，处理了 ${processedCount}/${novels.length} 本小说`);
    
  } catch (error) {
    console.error(`[作品数据统计] 重新计算综合评分失败:`, error);
    throw error;
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

/**
 * 计算热度评分（0-100分）
 * 基于：浏览量、唯一读者数、24小时/7天热度
 */
function calculatePopularityScore(rawMetrics) {
  // 占位实现：简单的对数映射
  // 后续可根据运营经验调整权重和映射曲线
  const views = rawMetrics.total_views || 0;
  const uniqueReaders = rawMetrics.total_unique_readers || 0;
  
  // 使用对数函数平滑映射到 0-100 分
  // 假设 10000 浏览量 = 50分，100000 浏览量 = 100分
  const viewsScore = Math.min(100, Math.log10(views + 1) * 20);
  const readersScore = Math.min(100, Math.log10(uniqueReaders + 1) * 25);
  
  // 加权平均：浏览量权重 0.6，读者数权重 0.4
  return parseFloat((viewsScore * 0.6 + readersScore * 0.4).toFixed(2));
}

/**
 * 计算参与度评分（0-100分）
 * 基于：有效阅读数、平均停留时长、完成率、平均阅读章节数
 */
function calculateEngagementScore(rawMetrics) {
  // 占位实现：基于阅读深度指标
  // 后续可根据运营经验调整
  const effectiveReads = rawMetrics.effective_reads || 0;
  const avgStayDuration = rawMetrics.avg_stay_duration_sec || 0;
  const finishRate = rawMetrics.finish_rate || 0;
  const avgChapters = rawMetrics.avg_read_chapters_per_user || 0;
  
  // 简化处理：使用对数映射
  const readsScore = Math.min(100, Math.log10(effectiveReads + 1) * 20);
  const durationScore = Math.min(100, (avgStayDuration / 60) * 2); // 假设 50分钟 = 100分
  const finishScore = finishRate * 100; // 完成率直接映射
  const chaptersScore = Math.min(100, avgChapters * 10); // 假设 10章 = 100分
  
  // 加权平均
  return parseFloat((
    readsScore * 0.3 + 
    durationScore * 0.3 + 
    finishScore * 0.2 + 
    chaptersScore * 0.2
  ).toFixed(2));
}

/**
 * 计算变现能力评分（0-100分）
 * 基于：章节解锁收入、Champion订阅收入、付费读者数
 */
function calculateMonetizationScore(rawMetrics) {
  // 占位实现：基于收入数据
  // 后续可根据运营经验调整
  const chapterRevenue = rawMetrics.total_chapter_revenue || 0;
  const championRevenue = rawMetrics.total_champion_revenue || 0;
  const totalRevenue = chapterRevenue + championRevenue;
  const paidReaders = rawMetrics.paid_reader_count || 0;
  
  // 使用对数映射
  const revenueScore = Math.min(100, Math.log10(totalRevenue + 1) * 15);
  const readersScore = Math.min(100, Math.log10(paidReaders + 1) * 25);
  
  // 加权平均：收入权重 0.7，付费读者数权重 0.3
  return parseFloat((revenueScore * 0.7 + readersScore * 0.3).toFixed(2));
}

/**
 * 计算口碑评分（0-100分）
 * 基于：平均评分、评价数量、评分分布
 */
function calculateReputationScore(rawMetrics) {
  // 占位实现：基于评分数据
  // 后续可根据运营经验调整
  const avgRating = rawMetrics.avg_rating || 0;
  const ratingCount = rawMetrics.rating_count || 0;
  
  // 评分直接映射：5星 = 100分，1星 = 20分
  const ratingScore = avgRating * 20;
  
  // 评价数量影响：评价数越多，可信度越高
  // 假设 100 个评价 = 满分，使用对数映射
  const countScore = Math.min(100, Math.log10(ratingCount + 1) * 20);
  
  // 加权平均：评分权重 0.7，数量权重 0.3
  return parseFloat((ratingScore * 0.7 + countScore * 0.3).toFixed(2));
}

/**
 * 计算社区活跃度评分（0-100分）
 * 基于：评论数、段落评论数、点赞/点踩数、互动率
 */
function calculateCommunityScore(rawMetrics) {
  // 占位实现：基于社区互动数据
  // 后续可根据运营经验调整
  const totalComments = rawMetrics.total_comments || 0;
  const totalParagraphComments = rawMetrics.total_paragraph_comments || 0;
  const totalInteractions = totalComments + totalParagraphComments;
  
  // 使用对数映射
  const interactionsScore = Math.min(100, Math.log10(totalInteractions + 1) * 20);
  
  // 简化处理：直接使用互动数评分
  return parseFloat(interactionsScore.toFixed(2));
}

/**
 * 计算综合评分（0-100分）
 * 基于各维度评分的加权平均
 */
function calculateFinalScore(dimScores) {
  // 占位实现：各维度权重
  // 后续可根据运营经验调整权重
  const weights = {
    popularity: 0.25,      // 热度 25%
    engagement: 0.25,     // 参与度 25%
    monetization: 0.20,   // 变现能力 20%
    reputation: 0.15,     // 口碑 15%
    community: 0.15       // 社区活跃度 15%
  };
  
  const finalScore = 
    dimScores.popularity * weights.popularity +
    dimScores.engagement * weights.engagement +
    dimScores.monetization * weights.monetization +
    dimScores.reputation * weights.reputation +
    dimScores.community * weights.community;
  
  return parseFloat(finalScore.toFixed(2));
}

/**
 * 启动每日统计定时任务
 * 每天凌晨 03:00 执行（统计昨天的数据）
 */
function startDailyStatsTask() {
  // cron 表达式：'0 3 * * *' 表示每天凌晨3点执行
  cron.schedule('0 3 * * *', async () => {
    try {
      // 计算昨天的统计数据
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];
      
      console.log(`[作品数据统计] 定时任务触发，计算 ${yesterdayStr} 的统计数据...`);
      
      await computeDailyStatsForDate(yesterdayStr);
      
      // 统计完成后，重新计算综合评分
      console.log(`[作品数据统计] 开始重新计算综合评分...`);
      await recomputeOverallScores();
      
      console.log(`[作品数据统计] 定时任务执行完成`);
    } catch (error) {
      console.error(`[作品数据统计] 定时任务执行出错:`, error);
    }
  }, {
    scheduled: true,
    timezone: "Asia/Shanghai" // 设置时区为中国时区
  });
  
  console.log('[作品数据统计] 每日统计定时任务已启动，每天凌晨3点执行');
}

/**
 * 手动触发每日统计（用于测试或手动执行）
 */
async function manualTriggerDailyStats(statDate) {
  try {
    await computeDailyStatsForDate(statDate);
    await recomputeOverallScores();
    console.log('[作品数据统计] 手动触发执行完成');
  } catch (error) {
    console.error('[作品数据统计] 手动触发执行失败:', error);
    throw error;
  }
}

module.exports = {
  computeDailyStatsForDate,
  recomputeOverallScores,
  calculatePopularityScore,
  calculateEngagementScore,
  calculateMonetizationScore,
  calculateReputationScore,
  calculateCommunityScore,
  calculateFinalScore,
  startDailyStatsTask,
  manualTriggerDailyStats
};

