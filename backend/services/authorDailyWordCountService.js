// backend/services/authorDailyWordCountService.js
const mysql = require('mysql2/promise');

// 数据库配置（与 writer.js 保持一致）
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '123456',
  database: process.env.DB_NAME || 'kongfuworld',
  charset: 'utf8mb4'
};

/**
 * 记录一次章节"发布/重新发布"的字数变更
 * 
 * 逻辑：
 * - 查询该章节历史发布记录中，最近的一条（按 created_at 或 id 降序）
 * - word_count_before = 那条记录的 word_count_after；如果没有历史记录，则为 0
 * - word_count_after = 当前章节的 word_count
 * - word_delta = word_count_after - word_count_before
 * - 如果 word_delta 为 0，可选择不插入记录（避免无意义数据）
 * 
 * @param {Object} params
 * @param {number} params.authorId - 作者ID (user.id)
 * @param {number} params.novelId - 小说ID (novel.id)
 * @param {number} params.chapterId - 章节ID (chapter.id)
 * @param {number} params.wordCount - 当前章节字数
 * @param {Date|string} params.releaseDate - 发布日期
 */
async function recordChapterReleaseChange({ authorId, novelId, chapterId, wordCount, releaseDate }) {
  if (!authorId || !novelId || !chapterId || !releaseDate) {
    console.warn('[authorDailyWordCountService] Missing required params:', { authorId, novelId, chapterId, releaseDate });
    return;
  }

  let db;
  try {
    db = await mysql.createConnection(dbConfig);

    // 1. 查询该章节上一次发布记录
    const [rows] = await db.execute(
      'SELECT word_count_after FROM author_daily_word_count WHERE chapter_id = ? ORDER BY created_at DESC, id DESC LIMIT 1',
      [chapterId]
    );

    const lastAfter = rows.length ? (rows[0].word_count_after || 0) : 0;
    const wordBefore = lastAfter;
    const wordAfter = wordCount || 0;
    const wordDelta = wordAfter - wordBefore;

    // 如果本次发布没有字数变化，可以直接跳过
    if (wordDelta === 0) {
      console.log(`[authorDailyWordCountService] Chapter ${chapterId} word count unchanged, skipping record`);
      return;
    }

    // 格式化日期为 YYYY-MM-DD
    const releaseDateObj = releaseDate instanceof Date ? releaseDate : new Date(releaseDate);
    const dateStr = releaseDateObj.toISOString().split('T')[0];

    const sql = `
      INSERT INTO author_daily_word_count (
        author_id, novel_id, chapter_id, date,
        word_count_before, word_count_after, word_delta
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `;

    await db.execute(sql, [
      authorId,
      novelId,
      chapterId,
      dateStr,
      wordBefore,
      wordAfter,
      wordDelta,
    ]);

    console.log(`[authorDailyWordCountService] Recorded chapter release change: chapter=${chapterId}, date=${dateStr}, delta=${wordDelta}`);
  } catch (error) {
    console.error('[authorDailyWordCountService] Error recording chapter release change:', error);
    // 不抛出错误，避免影响主流程
  } finally {
    if (db) await db.end();
  }
}

module.exports = {
  recordChapterReleaseChange,
};

