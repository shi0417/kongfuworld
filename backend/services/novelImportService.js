/**
 * 小说导入服务
 * 负责从文本/文件生成导入批次和章节草稿，支持预览和编辑
 */

const mysql = require('mysql2/promise');
const { segmentChapters } = require('../ai/chapterSegmentation');
const { buildChapterImportConfig } = require('./aiChapterImportConfig');
const {
  calcPriceByWordCount,
  calcVolumeId,
  calcReleaseInfo,
} = require('./aiChapterImportService');

// 数据库配置
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '123456',
  database: process.env.DB_NAME || 'kongfuworld',
  charset: 'utf8mb4'
};

/**
 * 计算字数（去除空格和空行）
 * @param {string} text - 文本内容
 * @returns {number} 字数
 */
function calculateWordCount(text) {
  if (!text) return 0;
  return text.replace(/\s/g, '').length;
}

/**
 * 从文本创建导入批次和章节草稿
 * @param {Object} params
 * @param {number} params.novelId - 小说ID
 * @param {string} params.sourceText - 源文本
 * @param {number} params.adminId - 管理员ID
 * @param {Object} params.importConfig - 导入配置（与 buildChapterImportConfig 入参保持一致）
 * @param {string} [params.sourceFileName] - 源文件名（可选）
 * @returns {Promise<{batch: Object, chapters: Array}>}
 */
async function createImportBatchFromText({
  novelId,
  sourceText,
  adminId,
  importConfig: rawImportConfig,
  sourceFileName = null,
}) {
  let db;
  try {
    db = await mysql.createConnection(dbConfig);

    // 1. 验证小说是否存在
    const [novels] = await db.execute('SELECT id FROM novel WHERE id = ?', [novelId]);
    if (novels.length === 0) {
      throw new Error(`Novel with ID ${novelId} not found`);
    }

    // 2. 构建导入配置
    let importConfig;
    try {
      importConfig = buildChapterImportConfig({ novelId, ...rawImportConfig });
    } catch (error) {
      console.warn('[NovelImportService] Failed to build import config, using defaults:', error.message);
      importConfig = buildChapterImportConfig({ novelId });
    }

    // 3. 分割章节
    const segmentedChapters = segmentChapters(sourceText);
    if (segmentedChapters.length === 0) {
      throw new Error('No chapters found in source text');
    }

    // 4. 创建导入批次记录
    const [batchResult] = await db.execute(
      `INSERT INTO novel_import_batch (
        novel_id, created_by_admin_id, source_file_name, source_type,
        status, total_chapters
      ) VALUES (?, ?, ?, ?, 'draft', ?)`,
      [
        novelId,
        adminId,
        sourceFileName,
        sourceFileName ? 'file' : 'text',
        segmentedChapters.length,
      ]
    );
    const batchId = batchResult.insertId;

    // 5. 处理每个章节
    const now = new Date();
    const chapters = [];

    for (let i = 0; i < segmentedChapters.length; i++) {
      const segChapter = segmentedChapters[i];
      const chapterNumber = segChapter.chapterNumber;
      const rawTitle = segChapter.title || '';
      const rawContent = segChapter.content || '';

      // 5.1 计算字数
      const wordCount = calculateWordCount(rawContent);

      // 5.2 计算 volume_id
      const volumeId = calcVolumeId(importConfig, chapterNumber);

      // 5.3 计算价格（基于字数）
      const priceInfo = await calcPriceByWordCount(novelId, wordCount);

      // 5.4 计算发布日期
      const { release_date, is_released } = calcReleaseInfo(importConfig, i, now);

      // 5.5 计算 is_advance
      const isFree = chapterNumber <= importConfig.freeChapterCount;
      const advanceStart = importConfig.advanceStartChapter || (importConfig.freeChapterCount + 1);
      const isAdvance = chapterNumber >= advanceStart && new Date(release_date) > now ? 1 : 0;

      // 5.6 计算 unlock_priority
      const unlockPriority = isFree ? 'free' : 'paid';

      // 5.7 检查是否与现有章节重复
      const [existingChapters] = await db.execute(
        'SELECT id FROM chapter WHERE novel_id = ? AND chapter_number = ?',
        [novelId, chapterNumber]
      );
      const status = existingChapters.length > 0 ? 'duplicate_existing' : 'draft';

      // 5.8 插入章节草稿记录
      const [chapterResult] = await db.execute(
        `INSERT INTO novel_import_chapter (
          batch_id, novel_id, chapter_number, volume_id,
          raw_title, raw_content,
          word_count, unlock_price, key_cost, is_advance,
          unlock_priority, is_released, release_date, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          batchId,
          novelId,
          chapterNumber,
          volumeId,
          rawTitle,
          rawContent,
          wordCount,
          priceInfo.unlock_price,
          priceInfo.key_cost,
          isAdvance,
          unlockPriority,
          is_released,
          release_date,
          status,
        ]
      );

      chapters.push({
        id: chapterResult.insertId,
        batch_id: batchId,
        novel_id: novelId,
        chapter_number: chapterNumber,
        volume_id: volumeId,
        raw_title: rawTitle,
        raw_content: rawContent,
        clean_title: null,
        clean_content: null,
        en_title: null,
        en_content: null,
        word_count: wordCount,
        unlock_price: priceInfo.unlock_price,
        key_cost: priceInfo.key_cost,
        is_advance: isAdvance,
        unlock_priority: unlockPriority,
        review_status: 'draft',
        is_released: is_released,
        release_date: release_date,
        status: status,
        chapter_id: null,
        created_at: new Date(),
        updated_at: new Date(),
      });
    }

    // 6. 获取批次信息
    const [batches] = await db.execute(
      'SELECT * FROM novel_import_batch WHERE id = ?',
      [batchId]
    );

    return {
      batch: batches[0],
      chapters,
    };
  } catch (error) {
    console.error('[NovelImportService] createImportBatchFromText error:', error);
    throw error;
  } finally {
    if (db) await db.end();
  }
}

/**
 * 获取导入批次详情
 * @param {number} batchId - 批次ID
 * @returns {Promise<{batch: Object, chapters: Array}>}
 */
async function getImportBatchDetails(batchId) {
  let db;
  try {
    db = await mysql.createConnection(dbConfig);

    // 获取批次信息
    const [batches] = await db.execute(
      'SELECT * FROM novel_import_batch WHERE id = ?',
      [batchId]
    );

    if (batches.length === 0) {
      throw new Error(`Import batch with ID ${batchId} not found`);
    }

    // 获取章节列表（按章节号排序）
    const [chapters] = await db.execute(
      `SELECT * FROM novel_import_chapter 
       WHERE batch_id = ? 
       ORDER BY chapter_number ASC, id ASC`,
      [batchId]
    );

    return {
      batch: batches[0],
      chapters,
    };
  } catch (error) {
    console.error('[NovelImportService] getImportBatchDetails error:', error);
    throw error;
  } finally {
    if (db) await db.end();
  }
}

/**
 * 更新导入章节信息
 * @param {number} batchId - 批次ID
 * @param {Array} updates - 更新列表，每条包含 id 和要更新的字段
 * @returns {Promise<Array>} 更新后的章节列表
 */
async function updateImportChapters(batchId, updates) {
  let db;
  try {
    db = await mysql.createConnection(dbConfig);

    // 验证批次存在
    const [batches] = await db.execute(
      'SELECT novel_id FROM novel_import_batch WHERE id = ?',
      [batchId]
    );
    if (batches.length === 0) {
      throw new Error(`Import batch with ID ${batchId} not found`);
    }
    const novelId = batches[0].novel_id;

    // 批量更新
    for (const update of updates) {
      const { id, ...fields } = update;
      if (!id) continue;

      // 构建更新字段
      const updateFields = [];
      const updateValues = [];

      // 允许更新的字段
      const allowedFields = [
        'volume_id',
        'chapter_number',
        'raw_title',
        'raw_content',
        'clean_title',
        'clean_content',
        'unlock_price',
        'key_cost',
        'is_released',
        'release_date',
        'is_advance',
        'unlock_priority',
      ];

      for (const [key, value] of Object.entries(fields)) {
        if (allowedFields.includes(key)) {
          updateFields.push(`${key} = ?`);
          updateValues.push(value);
        }
      }

      if (updateFields.length === 0) continue;

      // 如果修改了 chapter_number，需要重新检测重复
      if (fields.chapter_number !== undefined) {
        const [existingChapters] = await db.execute(
          'SELECT id FROM chapter WHERE novel_id = ? AND chapter_number = ?',
          [novelId, fields.chapter_number]
        );
        const status = existingChapters.length > 0 ? 'duplicate_existing' : 'draft';
        updateFields.push('status = ?');
        updateValues.push(status);
      }

      // 如果修改了内容，重新计算字数
      if (fields.raw_content !== undefined || fields.clean_content !== undefined) {
        const content = fields.clean_content || fields.raw_content;
        const wordCount = calculateWordCount(content);
        updateFields.push('word_count = ?');
        updateValues.push(wordCount);
      }

      updateValues.push(id);

      await db.execute(
        `UPDATE novel_import_chapter 
         SET ${updateFields.join(', ')}, updated_at = NOW()
         WHERE id = ? AND batch_id = ?`,
        [...updateValues, batchId]
      );
    }

    // 返回更新后的章节列表
    const result = await getImportBatchDetails(batchId);
    return result.chapters;
  } catch (error) {
    console.error('[NovelImportService] updateImportChapters error:', error);
    throw error;
  } finally {
    if (db) await db.end();
  }
}

/**
 * 标记批次准备翻译
 * @param {number} batchId - 批次ID
 * @returns {Promise<void>}
 */
async function markBatchReadyForTranslation(batchId) {
  let db;
  try {
    db = await mysql.createConnection(dbConfig);

    // 更新批次状态
    await db.execute(
      'UPDATE novel_import_batch SET status = ? WHERE id = ?',
      ['confirmed', batchId]
    );

    // 更新所有 draft 状态的章节为 ready_for_translation
    // duplicate_existing 的保持不动
    await db.execute(
      `UPDATE novel_import_chapter 
       SET status = 'ready_for_translation' 
       WHERE batch_id = ? AND status = 'draft'`,
      [batchId]
    );
  } catch (error) {
    console.error('[NovelImportService] markBatchReadyForTranslation error:', error);
    throw error;
  } finally {
    if (db) await db.end();
  }
}

module.exports = {
  createImportBatchFromText,
  getImportBatchDetails,
  updateImportChapters,
  markBatchReadyForTranslation,
  calculateWordCount,
};

