/**
 * AI 批量翻译导入服务
 * 根据翻译草稿和导入配置，生成可直接插入 chapter 表的字段对象
 */

const mysql = require('mysql2/promise');
const dayjs = require('dayjs');

// 数据库配置
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '123456',
  database: process.env.DB_NAME || 'kongfuworld',
  charset: 'utf8mb4'
};

/**
 * @typedef {Object} ChapterDraft
 * @property {number} chapterNumber - 章节号
 * @property {string} title - 译文标题
 * @property {string} content - 译文正文
 * @property {number} wordCount - 字数，翻译后统计
 */

/**
 * 根据字数计算 unlock_price, key_cost
 * @param {number} novelId - 小说ID
 * @param {number} wordCount - 字数
 * @returns {Promise<{ unlock_price: number; key_cost: number }>}
 */
async function calcPriceByWordCount(novelId, wordCount) {
  let db;
  try {
    db = await mysql.createConnection(dbConfig);

    // 1. 获取小说的 user_id
    const [novels] = await db.execute('SELECT user_id FROM novel WHERE id = ?', [novelId]);
    if (novels.length === 0) {
      throw new Error(`Novel with ID ${novelId} not found`);
    }
    const userId = novels[0].user_id;

    // 2. 查询 unlockprice 表
    const [unlockPriceResults] = await db.execute(
      `SELECT karma_per_1000, min_karma, max_karma, default_free_chapters
       FROM unlockprice
       WHERE novel_id = ? AND user_id = ?
       LIMIT 1`,
      [novelId, userId]
    );

    let config;
    if (!unlockPriceResults || unlockPriceResults.length === 0) {
      // 如果没有数据，创建一条默认数据
      try {
        await db.execute(
          `INSERT INTO unlockprice (user_id, novel_id, karma_per_1000, min_karma, max_karma, default_free_chapters, pricing_style)
           VALUES (?, ?, 6, 5, 30, 50, 'per_word')
           ON DUPLICATE KEY UPDATE updated_at = NOW()`,
          [userId, novelId]
        );
        config = { karma_per_1000: 6, min_karma: 5, max_karma: 30, default_free_chapters: 50 };
      } catch (err) {
        console.error('[AIChapterImportService] 创建 unlockprice 记录失败:', err);
        config = { karma_per_1000: 6, min_karma: 5, max_karma: 30, default_free_chapters: 50 };
      }
    } else {
      config = unlockPriceResults[0];
    }

    // 3. 计算价格（复用现有逻辑）
    const { karma_per_1000, min_karma, max_karma } = config;

    // 没字数时默认用 min_karma
    if (!wordCount || wordCount <= 0) {
      return {
        unlock_price: min_karma,
        key_cost: 1,
      };
    }

    // 按字数计算基础价：向上取整
    let basePrice = Math.ceil((wordCount / 1000) * karma_per_1000);

    // 限制在 [min_karma, max_karma] 区间
    if (basePrice < min_karma) basePrice = min_karma;
    if (basePrice > max_karma) basePrice = max_karma;

    return {
      unlock_price: basePrice,
      key_cost: 1, // 统一设为 1
    };
  } catch (error) {
    console.error('[AIChapterImportService] calcPriceByWordCount error:', error);
    // 返回默认值
    return {
      unlock_price: 0,
      key_cost: 0,
    };
  } finally {
    if (db) await db.end();
  }
}

/**
 * 计算 volume_id
 * @param {Object} config - ChapterImportConfig
 * @param {number} chapterNumber - 章节号
 * @returns {number} volume_id
 */
function calcVolumeId(config, chapterNumber) {
  if (config.volumeMode === 'fixed') {
    return config.fixedVolumeId;
  }
  // by_range 模式
  const size = config.volumeRangeSize || 100;
  return Math.floor((chapterNumber - 1) / size) + 1;
}

/**
 * 计算 release_date / is_released
 * @param {Object} config - ChapterImportConfig
 * @param {number} indexInBatch - 当前章节在本次导入中的顺序 index，从 0 开始
 * @param {Date} now - 当前时间
 * @returns {{ release_date: Date; is_released: number }}
 */
function calcReleaseInfo(config, indexInBatch, now) {
  const baseDate = dayjs(config.releaseStartDate);
  const perDay = config.chaptersPerDay || 3;
  const dayOffset = Math.floor(indexInBatch / perDay);
  const date = baseDate.add(dayOffset, 'day');

  const releaseDateTime = dayjs(
    date.format('YYYY-MM-DD') + ' ' + (config.releaseTimeOfDay || '08:00:00')
  );

  const isReleased = releaseDateTime.isBefore(dayjs(now)) ? 1 : 0;

  return {
    release_date: releaseDateTime.toDate(),
    is_released: isReleased,
  };
}

/**
 * 根据一条草稿 + 导入配置，构造可以插入 chapter 表的字段对象
 * @param {ChapterDraft} draft - 章节草稿
 * @param {Object} config - ChapterImportConfig
 * @param {number} indexInBatch - 在批次中的索引（从 0 开始）
 * @param {Date} now - 当前时间
 * @returns {Promise<Object>} 返回可直接插入 chapter 表的字段对象
 */
async function buildChapterRowFromDraft(draft, config, indexInBatch, now) {
  // 1. 判断是否免费章节
  const isFree = draft.chapterNumber <= config.freeChapterCount;

  // 2. 计算 volume_id
  const volume_id = calcVolumeId(config, draft.chapterNumber);

  // 3. 计算字数
  const word_count = draft.wordCount || (draft.content ? draft.content.replace(/\s/g, '').length : 0);

  // 4. 计算价格
  let unlock_price = 0;
  let key_cost = 0;
  if (!isFree) {
    const priceInfo = await calcPriceByWordCount(config.novelId, word_count);
    unlock_price = priceInfo.unlock_price;
    key_cost = priceInfo.key_cost;
  }

  // 5. 计算发布日期
  const { release_date, is_released } = calcReleaseInfo(config, indexInBatch, now);

  // 6. 计算 is_advance
  // 规则：从 freeChapterCount+1 或 advanceStartChapter 开始，
  // 且 release_date 在未来（未公开）时，标记为预读
  const advanceStart = config.advanceStartChapter || (config.freeChapterCount + 1);
  let is_advance = 0;
  if (draft.chapterNumber >= advanceStart && dayjs(release_date).isAfter(dayjs(now))) {
    is_advance = 1;
  }

  // 7. unlock_priority：免费章节标记 'free'，收费章节标记 'paid'
  const unlock_priority = isFree ? 'free' : 'paid';

  // 8. 时间戳
  const nowStr = dayjs(now).format('YYYY-MM-DD HH:mm:ss');

  return {
    novel_id: config.novelId,
    volume_id,
    chapter_number: draft.chapterNumber,
    title: draft.title,
    content: draft.content,
    translator_note: 'AI Translated',
    is_advance,
    unlock_price,
    word_count,
    key_cost,
    unlock_priority,
    review_status: 'submitted',
    editor_admin_id: null,
    chief_editor_admin_id: null,
    reviewed_at: null,
    is_released,
    release_date,
    created_at: nowStr,
    updated_at: nowStr,
  };
}

module.exports = {
  calcPriceByWordCount,
  calcVolumeId,
  calcReleaseInfo,
  buildChapterRowFromDraft,
};

