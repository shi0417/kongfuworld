/**
 * 小说导入服务
 * 负责从文本/文件生成导入批次和章节草稿，支持预览和编辑
 */

const mysql = require('mysql2/promise');
const { segmentChapters, extractChapterNumber, numberToChinese } = require('../ai/chapterSegmentation');
const { buildChapterImportConfig } = require('./aiChapterImportConfig');
const {
  calcPriceByWordCount,
  calcVolumeId,
  calcReleaseInfo,
} = require('./aiChapterImportService');
const { getOpenAIClient } = require('../ai/translationModel');
const { batchByLength } = require('../ai/utils/batchByLength');
const { getGlobalRateLimiter } = require('../ai/langchain/rateLimiter');
const { checkTitlesReasonableness } = require('../ai/titleReasonablenessChecker');

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

    // 4. 检查是否已有该小说的导入批次（避免重复导入）
    // 如果已有该小说的批次，检查是否所有章节都已存在
    const [existingBatches] = await db.execute(
      `SELECT id, status, total_chapters, created_at 
       FROM novel_import_batch 
       WHERE novel_id = ? 
       ORDER BY id DESC 
       LIMIT 1`,
      [novelId]
    );

    let batchId;
    let isNewBatch = true;

    if (existingBatches.length > 0) {
      const latestBatch = existingBatches[0];
      // 检查最新批次是否包含所有要导入的章节
      const chapterNumbers = segmentedChapters.map(ch => ch.chapterNumber);
      const [existingChapters] = await db.execute(
        `SELECT DISTINCT chapter_number 
         FROM novel_import_chapter 
         WHERE novel_id = ? AND batch_id = ? AND chapter_number IN (${chapterNumbers.map(() => '?').join(',')})`,
        [novelId, latestBatch.id, ...chapterNumbers]
      );
      
      const existingChapterNumbers = new Set(existingChapters.map(ch => ch.chapter_number));
      const allChaptersExist = chapterNumbers.every(num => existingChapterNumbers.has(num));

      if (allChaptersExist && existingChapters.length >= segmentedChapters.length) {
        // 所有章节都已存在，提示用户
        console.log(`[NovelImportService] 警告：小说 ID=${novelId} 的所有章节（${segmentedChapters.length} 章）已存在于批次 ${latestBatch.id} 中`);
        // 仍然创建新批次，但会在后续逻辑中跳过重复章节
      }
    }

    // 创建新的导入批次记录
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
    batchId = batchResult.insertId;

    // 5. 处理每个章节
    const now = new Date();
    const chapters = [];

    // 计算平均字数（用于检测异常）
    let avgWordCount = 0;
    if (segmentedChapters.length > 1) {
      const wordCounts = segmentedChapters.map(ch => {
        const content = ch.content || '';
        return content.replace(/\s/g, '').length;
      });
      avgWordCount = Math.floor(wordCounts.reduce((a, b) => a + b, 0) / wordCounts.length);
      console.log(`[NovelImportService] 计算平均字数: ${avgWordCount} (基于 ${segmentedChapters.length} 个章节)`);
    }
    
    for (let i = 0; i < segmentedChapters.length; i++) {
      const segChapter = segmentedChapters[i];
      const chapterNumber = segChapter.chapterNumber;
      const rawTitle = segChapter.title || '';
      const rawContent = segChapter.content || '';

      // 5.1 计算字数
      const wordCount = calculateWordCount(rawContent);
      
      // 检测字数异常
      let wordCountWarning = null;
      if (avgWordCount > 0 && wordCount > avgWordCount * 2) {
        wordCountWarning = `字数异常：${wordCount} 字，超过平均字数 ${avgWordCount} 的2倍，可能包含了下一章的内容`;
        console.log(`[NovelImportService] ⚠️ 章节 ${chapterNumber} ${wordCountWarning}`);
        console.log(`[NovelImportService] 章节 ${chapterNumber} 内容预览: "${rawContent.substring(0, 200)}..."`);
        // 检查内容中是否包含下一章的标题
        const nextChapterNumber = chapterNumber + 1;
        const nextChapterChinese = numberToChinese(nextChapterNumber);
        const hasNextChapterTitle = rawContent.includes(`第${nextChapterChinese}章`) || 
                                     rawContent.includes(`第${nextChapterNumber}章`) ||
                                     rawContent.includes(`弟${nextChapterChinese}章`) ||
                                     rawContent.includes(`第${nextChapterChinese} `) ||
                                     rawContent.includes(`第${nextChapterNumber} `);
        if (hasNextChapterTitle) {
          wordCountWarning += `。检测到内容中包含第${nextChapterNumber}章的标题，确认切分错误。`;
          console.log(`[NovelImportService] ⚠️ 章节 ${chapterNumber} 内容中包含第${nextChapterNumber}章的标题，确认切分错误`);
        }
      }

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
      // 注意：数据库 ENUM 值为 'free','key','karma','subscription'
      // 免费章节用 'free'，收费章节用 'karma'（按字数计算价格）
      const unlockPriority = isFree ? 'free' : 'karma';

      // 5.7 检查是否与现有章节重复
      // 检查 novel_import_chapter 表中是否已有相同的 novel_id + chapter_number
      // 如果已存在，需要检查章节号是否与标题中的中文数字匹配
      const [existingImportChapters] = await db.execute(
        `SELECT id, batch_id, raw_title, raw_content, clean_title, clean_content, 
                en_title, en_content, word_count, unlock_price, key_cost, 
                is_advance, unlock_priority, is_released, release_date, status, chapter_id
         FROM novel_import_chapter 
         WHERE novel_id = ? AND chapter_number = ? 
         ORDER BY id DESC LIMIT 1`,
        [novelId, chapterNumber]
      );
      
      if (existingImportChapters.length > 0) {
        const existingChapter = existingImportChapters[0];
        
        // 检查已存在章节的标题中的中文数字是否与章节号匹配
        const existingTitle = existingChapter.raw_title || existingChapter.clean_title || '';
        const extractedChapterNumber = extractChapterNumber(existingTitle);
        
        // 如果提取的章节号与当前章节号一致，说明匹配正确，跳过导入
        if (extractedChapterNumber !== null && extractedChapterNumber === chapterNumber) {
          console.log(`[NovelImportService] 章节 ${chapterNumber} 已存在且匹配正确 (id: ${existingChapter.id}, batch_id: ${existingChapter.batch_id})，跳过导入`);
          
          // 直接使用旧数据，不插入新记录
          chapters.push({
            id: existingChapter.id,
            batch_id: existingChapter.batch_id, // 保留原批次ID
            novel_id: novelId,
            chapter_number: chapterNumber,
            volume_id: volumeId, // 使用新计算的 volume_id（可能不同）
            raw_title: existingChapter.raw_title, // 使用旧数据
            raw_content: existingChapter.raw_content, // 使用旧数据
            clean_title: existingChapter.clean_title,
            clean_content: existingChapter.clean_content,
            en_title: existingChapter.en_title,
            en_content: existingChapter.en_content,
            word_count: existingChapter.word_count,
            unlock_price: existingChapter.unlock_price,
            key_cost: existingChapter.key_cost,
            is_advance: existingChapter.is_advance,
            unlock_priority: existingChapter.unlock_priority,
            review_status: 'draft',
            is_released: existingChapter.is_released,
            release_date: existingChapter.release_date,
            status: existingChapter.status || 'duplicate_existing', // 保持原有状态或标记为重复
            chapter_id: existingChapter.chapter_id,
            created_at: existingChapter.created_at,
            updated_at: existingChapter.updated_at,
          });
          continue; // 跳过后续处理，不插入新记录
        } else {
          // 章节号不匹配，需要更新该章节
          console.log(`[NovelImportService] 章节 ${chapterNumber} 已存在但标题不匹配 (现有标题: "${existingTitle}", 提取的章节号: ${extractedChapterNumber}, 期望章节号: ${chapterNumber})，更新章节内容`);
          
          // 检测新标题中的章节号是否与 chapterNumber 一致
          const newExtractedChapterNumber = extractChapterNumber(rawTitle);
          let hasIssue = 0;
          let issueTags = null;
          let issueSummary = null;
          
          console.log(`[NovelImportService] 更新章节时检测：章节号=${chapterNumber}, 标题="${rawTitle}", 提取的章节号=${newExtractedChapterNumber}`);
          
          if (newExtractedChapterNumber !== null && newExtractedChapterNumber !== chapterNumber) {
            hasIssue = 1;
            issueTags = 'chapter_number_mismatch';
            issueSummary = `章节号不一致：数据库章节号为 ${chapterNumber}，但标题中提取的章节号为 ${newExtractedChapterNumber}。请检查源文件是否正确。`;
            console.log(`[NovelImportService] ⚠️ 章节号不一致：章节 ${chapterNumber}，标题 "${rawTitle}"，提取的章节号 ${newExtractedChapterNumber}`);
          } else if (newExtractedChapterNumber === null) {
            console.log(`[NovelImportService] ⚠️ 无法从标题中提取章节号：标题="${rawTitle}"`);
          } else {
            console.log(`[NovelImportService] ✓ 章节号一致：章节 ${chapterNumber}，标题 "${rawTitle}"`);
          }
          
          // 更新已存在的章节记录
          // 注意：由于原始内容已更新，清理后的标题和内容也需要重新生成，所以清空它们
          await db.execute(
            `UPDATE novel_import_chapter SET
              batch_id = ?,
              volume_id = ?,
              raw_title = ?,
              raw_content = ?,
              clean_title = NULL,
              clean_content = NULL,
              word_count = ?,
              unlock_price = ?,
              key_cost = ?,
              is_advance = ?,
              unlock_priority = ?,
              is_released = ?,
              release_date = ?,
              status = 'draft',
              has_issue = ?,
              issue_tags = ?,
              issue_summary = ?,
              updated_at = NOW()
            WHERE id = ?`,
            [
              batchId, // 更新为当前批次ID
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
              hasIssue,
              issueTags,
              issueSummary,
              existingChapter.id,
            ]
          );
          
          // 返回更新后的章节数据
          chapters.push({
            id: existingChapter.id,
            batch_id: batchId, // 更新为当前批次ID
            novel_id: novelId,
            chapter_number: chapterNumber,
            volume_id: volumeId,
            raw_title: rawTitle,
            raw_content: rawContent,
            clean_title: null, // 清空，需要重新生成
            clean_content: null, // 清空，需要重新生成
            en_title: existingChapter.en_title, // 保留原有的英文标题（如果有）
            en_content: existingChapter.en_content, // 保留原有的英文内容（如果有）
            word_count: wordCount,
            unlock_price: priceInfo.unlock_price,
            key_cost: priceInfo.key_cost,
            is_advance: isAdvance,
            unlock_priority: unlockPriority,
            review_status: 'draft',
            is_released: is_released,
            release_date: release_date,
            status: 'draft',
            chapter_id: existingChapter.chapter_id,
            has_issue: hasIssue,
            issue_tags: issueTags,
            issue_summary: issueSummary,
            created_at: existingChapter.created_at,
            updated_at: new Date(),
          });
          continue; // 跳过插入新记录
        }
      }
      
      // 5.8 检测章节号不一致：从 raw_title 中提取章节号，与 chapterNumber 比较
      const extractedChapterNumber = extractChapterNumber(rawTitle);
      let hasIssue = 0;
      let issueTags = null;
      let issueSummary = null;
      
      console.log(`[NovelImportService] 检测章节号一致性：章节号=${chapterNumber}, 标题="${rawTitle}", 提取的章节号=${extractedChapterNumber}`);
      
      if (extractedChapterNumber !== null && extractedChapterNumber !== chapterNumber) {
        hasIssue = 1;
        issueTags = 'chapter_number_mismatch';
        issueSummary = `章节号不一致：数据库章节号为 ${chapterNumber}，但标题中提取的章节号为 ${extractedChapterNumber}。请检查源文件是否正确。`;
        console.log(`[NovelImportService] ⚠️ 章节号不一致：章节 ${chapterNumber}，标题 "${rawTitle}"，提取的章节号 ${extractedChapterNumber}`);
      } else if (extractedChapterNumber === null) {
        console.log(`[NovelImportService] ⚠️ 无法从标题中提取章节号：标题="${rawTitle}"`);
      } else {
        console.log(`[NovelImportService] ✓ 章节号一致：章节 ${chapterNumber}，标题 "${rawTitle}"`);
      }
      
      // 5.8.1 检测字数异常：如果字数超过平均字数的2倍，标记为异常
      if (wordCountWarning) {
        if (!hasIssue) {
          hasIssue = 1;
          issueTags = 'word_count_abnormal';
          issueSummary = wordCountWarning;
        } else {
          // 如果已经有其他问题，追加到摘要中
          issueTags = issueTags + ',word_count_abnormal';
          issueSummary = issueSummary + '；' + wordCountWarning;
        }
        console.log(`[NovelImportService] ⚠️ 章节 ${chapterNumber} 字数异常，已标记`);
      }

      // 5.9 插入新章节草稿记录（章节不存在于 chapter 表中）
      const [chapterResult] = await db.execute(
        `INSERT INTO novel_import_chapter (
          batch_id, novel_id, chapter_number, volume_id,
          raw_title, raw_content,
          word_count, unlock_price, key_cost, is_advance,
          unlock_priority, is_released, release_date, status,
          has_issue, issue_tags, issue_summary
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
          'draft',
          hasIssue,
          issueTags,
          issueSummary,
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
        status: 'draft',
        chapter_id: null,
        has_issue: hasIssue,
        issue_tags: issueTags,
        issue_summary: issueSummary,
        created_at: new Date(),
        updated_at: new Date(),
      });
    }

    // 6. 读取该小说的所有已有章节（从第一章到最后一章），确保列表完整
    // 这样即使某些章节已存在，用户也能在列表中看到并操作它们
    const [allExistingChapters] = await db.execute(
      `SELECT * FROM novel_import_chapter 
       WHERE novel_id = ? 
       ORDER BY chapter_number ASC, id ASC`,
      [novelId]
    );

    // 7. 合并新导入的章节和已有章节
    // 使用 Map 来去重，优先使用新导入的章节（如果章节号相同）
    const chapterMap = new Map();
    
    // 先添加已有章节
    allExistingChapters.forEach(ch => {
      chapterMap.set(ch.chapter_number, {
        id: ch.id,
        batch_id: ch.batch_id,
        novel_id: ch.novel_id,
        chapter_number: ch.chapter_number,
        volume_id: ch.volume_id,
        raw_title: ch.raw_title,
        raw_content: ch.raw_content,
        clean_title: ch.clean_title,
        clean_content: ch.clean_content,
        en_title: ch.en_title,
        en_content: ch.en_content,
        word_count: ch.word_count,
        unlock_price: ch.unlock_price,
        key_cost: ch.key_cost,
        is_advance: ch.is_advance,
        unlock_priority: ch.unlock_priority,
        review_status: ch.review_status || 'draft',
        is_released: ch.is_released,
        release_date: ch.release_date,
        status: ch.status || 'draft',
        chapter_id: ch.chapter_id,
        has_issue: ch.has_issue || 0,
        issue_tags: ch.issue_tags,
        issue_summary: ch.issue_summary,
        created_at: ch.created_at,
        updated_at: ch.updated_at,
      });
    });

    // 再添加/覆盖新导入的章节（新章节优先）
    chapters.forEach(ch => {
      chapterMap.set(ch.chapter_number, ch);
    });

    // 转换为数组并按章节号排序
    const allChapters = Array.from(chapterMap.values()).sort((a, b) => a.chapter_number - b.chapter_number);

    // 8. 统计实际导入的章节数（排除重复的）
    const newChaptersCount = chapters.filter(ch => ch.status === 'draft' && ch.batch_id === batchId).length;
    const duplicateChaptersCount = chapters.filter(ch => ch.status === 'duplicate_existing' || ch.batch_id !== batchId).length;
    
    // 更新批次的总章节数（包含所有章节，因为用户需要看到完整列表）
    await db.execute(
      'UPDATE novel_import_batch SET total_chapters = ? WHERE id = ?',
      [allChapters.length, batchId]
    );
    
    console.log(`[NovelImportService] 导入完成：新章节 ${newChaptersCount} 个，已有章节 ${duplicateChaptersCount} 个，总计 ${allChapters.length} 章（已合并显示）`);

    // 9. 获取批次信息
    const [batches] = await db.execute(
      'SELECT * FROM novel_import_batch WHERE id = ?',
      [batchId]
    );

    return {
      batch: batches[0],
      chapters: allChapters, // 返回该小说的所有章节（从第一章到最后一章）
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

    const novelId = batches[0].novel_id;

    // 获取该小说的所有章节（不仅仅是当前批次的，因为前端需要显示所有章节）
    // 这样与 createImportBatchFromText 的行为保持一致
    const [chapters] = await db.execute(
      `SELECT * FROM novel_import_chapter 
       WHERE novel_id = ? 
       ORDER BY chapter_number ASC, id ASC`,
      [novelId]
    );

    // 调试：统计有问题的章节
    const chaptersWithIssues = chapters.filter(ch => ch.has_issue === 1 || ch.has_issue === true);
    const chaptersWithMismatch = chapters.filter(ch => 
      (ch.has_issue === 1 || ch.has_issue === true) && ch.issue_tags === 'chapter_number_mismatch'
    );
    console.log(`[NovelImportService] getImportBatchDetails: 总章节数=${chapters.length}, 有问题的章节数=${chaptersWithIssues.length}, 章节号不一致的章节数=${chaptersWithMismatch.length}`);
    if (chaptersWithMismatch.length > 0) {
      console.log(`[NovelImportService] 章节号不一致的章节列表:`, chaptersWithMismatch.map(ch => ({
        id: ch.id,
        chapter_number: ch.chapter_number,
        raw_title: ch.raw_title,
        has_issue: ch.has_issue,
        issue_tags: ch.issue_tags,
        issue_summary: ch.issue_summary
      })));
    }

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

      // 检测章节号不一致：如果更新了 chapter_number 或 raw_title，需要重新检测
      let hasIssue = 0;
      let issueTags = null;
      let issueSummary = null;
      
      if (fields.chapter_number !== undefined || fields.raw_title !== undefined) {
        // 获取当前章节的完整信息
        const [currentChapters] = await db.execute(
          'SELECT chapter_number, raw_title FROM novel_import_chapter WHERE id = ?',
          [id]
        );
        
        if (currentChapters.length > 0) {
          const currentChapter = currentChapters[0];
          const finalChapterNumber = fields.chapter_number !== undefined ? fields.chapter_number : currentChapter.chapter_number;
          const finalRawTitle = fields.raw_title !== undefined ? fields.raw_title : currentChapter.raw_title;
          
          // 从标题中提取章节号
          const extractedChapterNumber = extractChapterNumber(finalRawTitle || '');
          
          console.log(`[NovelImportService] 更新章节时检测：章节号=${finalChapterNumber}, 标题="${finalRawTitle}", 提取的章节号=${extractedChapterNumber}`);
          
          if (extractedChapterNumber !== null && extractedChapterNumber !== finalChapterNumber) {
            hasIssue = 1;
            issueTags = 'chapter_number_mismatch';
            issueSummary = `章节号不一致：数据库章节号为 ${finalChapterNumber}，但标题中提取的章节号为 ${extractedChapterNumber}。请检查源文件是否正确。`;
            console.log(`[NovelImportService] ⚠️ 更新时发现章节号不一致：章节 ${finalChapterNumber}，标题 "${finalRawTitle}"，提取的章节号 ${extractedChapterNumber}`);
            
            // 添加到更新字段
            updateFields.push('has_issue = ?');
            updateFields.push('issue_tags = ?');
            updateFields.push('issue_summary = ?');
            updateValues.push(hasIssue, issueTags, issueSummary);
          } else {
            // 如果之前有章节号不一致的问题，现在修复了，清除标记
            console.log(`[NovelImportService] ✓ 更新时章节号一致或无法提取：章节 ${finalChapterNumber}，标题 "${finalRawTitle}"`);
            updateFields.push('has_issue = ?');
            updateFields.push('issue_tags = ?');
            updateFields.push('issue_summary = ?');
            updateValues.push(0, null, null);
          }
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

/**
 * 运行导入章节预检查
 * @param {number} batchId - 批次ID
 * @returns {Promise<{total: number, issueCount: number}>}
 */
/**
 * 构建标题统计画像
 * @param {Array<string>} titles - 标题数组
 * @returns {Object} 统计画像对象
 */
function buildTitleStats(titles) {
  if (titles.length === 0) {
    return null;
  }

  const lengths = titles.map(t => t.length).sort((a, b) => a - b);
  const n = lengths.length;
  const median = lengths[Math.floor(n / 2)];
  const p25 = lengths[Math.floor(n * 0.25)];
  const p75 = lengths[Math.floor(n * 0.75)];
  const iqr = Math.max(2, p75 - p25); // 四分位距，至少 2
  const minNormalLen = Math.max(3, median - iqr);
  const maxNormalLen = median + iqr;

  const chapterStyleCount = titles.filter(t => /^第.{1,6}(章|节)/.test(t)).length;
  const chapterStyleRatio = chapterStyleCount / n;

  const punctuationCount = titles.filter(t => /[，。！？、,.!?]/.test(t)).length;
  const punctuationRatio = punctuationCount / n;

  return {
    medianLen: median,
    p25,
    p75,
    iqr,
    minNormalLen,
    maxNormalLen,
    chapterStyleRatio,
    punctuationRatio,
    useChapterStyle: chapterStyleRatio > 0.6,           // 超过 60% 就认为是"第X章/节"风格为主
    allowSentencePunctuation: punctuationRatio > 0.3,   // 超过 30% 标题里有句读，就认为标点是常见现象
  };
}

/**
 * 使用 AI 分析标题风格并生成规则
 * @param {Array<string>} titles - 标题数组
 * @param {Object} stats - 统计画像
 * @returns {Promise<Object|null>} AI 生成的规则对象，失败返回 null
 */
async function buildAiTitleRules(titles, stats) {
  try {
    const client = getOpenAIClient();
    const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';
    const rateLimiter = getGlobalRateLimiter();

    // 配置：最大字符数（避免 prompt 太长）
    // 注意：不再限制样本数量，而是直接按字符数分批，这样可以处理更多标题
    const MAX_SAMPLE_CHARS = 8000; // 预留一些空间给 prompt 本身

    // 直接对所有标题使用 batchByLength 分批，不先抽样
    // 这样可以让更多标题参与分析，提高规则准确性
    const batches = batchByLength(
      titles,
      (t) => t,
      MAX_SAMPLE_CHARS,
      Infinity // 不限制每批的标题数量，只限制总字符数
    );

    console.log(`[buildAiTitleRules] 共 ${titles.length} 个标题，分成 ${batches.length} 批处理（每批最多 ${MAX_SAMPLE_CHARS} 字符）`);

    // 如果只有一批，直接处理；如果有多批，合并规则
    let allRules = [];

    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex];
      const batchTotalChars = batch.reduce((sum, t) => sum + t.length, 0);
      console.log(`[buildAiTitleRules] 处理第 ${batchIndex + 1}/${batches.length} 批，包含 ${batch.length} 个标题，总字符数 ${batchTotalChars}`);

      const prompt = `下面是同一本网络小说的若干章节标题，请你观察它们的共同风格，并输出一段 JSON 规则，用来判断某个标题是否"显得异常"。

请特别考虑：
1. 标题的一般长度范围（正常的最短/最长）；
2. 标题是否通常以"第X章/节"开头；
3. 标题里是否经常出现句子级标点（，。！？等）；
4. 你认为判断"把正文句子混进标题"的简单规则是什么。

只输出 JSON，不要解释。例如：
{
  "min_reasonable_length": 4,
  "max_reasonable_length": 26,
  "typical_prefix_regex": "^第.{1,4}章",
  "allow_sentence_punctuation": false
}

以下是本书的一部分标题（每行一个）：
${batch.join('\n')}`;

      // 使用 RateLimiter 调度 API 调用，确保遵守 RPM 限制
      // 如果遇到 429 错误，自动重试（最多重试 3 次）
      let response;
      let retryCount = 0;
      const maxRetries = 3;
      
      while (retryCount <= maxRetries) {
        try {
          response = await rateLimiter.schedule(async () => {
            return await client.chat.completions.create({
              model: OPENAI_MODEL,
              messages: [
                {
                  role: 'user',
                  content: prompt,
                },
              ],
              temperature: 0.3,
              max_tokens: 500,
            });
          });
          break; // 成功则跳出循环
        } catch (err) {
          // 如果是 429 错误，等待后重试
          if (err.message && err.message.includes('429') && retryCount < maxRetries) {
            const waitTime = 20000 + (retryCount * 5000); // 20秒 + 递增延迟
            console.log(`[buildAiTitleRules] 批次 ${batchIndex + 1} 遇到 429 错误，等待 ${waitTime / 1000} 秒后重试 (${retryCount + 1}/${maxRetries})...`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
            retryCount++;
          } else {
            // 其他错误或重试次数用完，抛出错误
            throw err;
          }
        }
      }
      
      if (!response) {
        throw new Error(`批次 ${batchIndex + 1} 在 ${maxRetries} 次重试后仍然失败`);
      }

      const text = response.choices[0]?.message?.content || '';
      
      // 尝试解析 JSON
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.warn(`[buildAiTitleRules] 批次 ${batchIndex + 1} AI response does not contain valid JSON`);
        continue;
      }

      try {
        const parsed = JSON.parse(jsonMatch[0]);
        allRules.push(parsed);
        console.log(`[buildAiTitleRules] 批次 ${batchIndex + 1} 解析成功`);
      } catch (parseErr) {
        console.warn(`[buildAiTitleRules] 批次 ${batchIndex + 1} JSON 解析失败:`, parseErr.message);
      }
    }

    // 如果有多批规则，合并它们（取平均值或第一个）
    if (allRules.length === 0) {
      console.warn('[buildAiTitleRules] 所有批次都解析失败，返回 null');
      return null;
    }

    // 合并规则：如果有多个，取第一个（或者可以取平均值，这里简化处理）
    const mergedRules = allRules[0];
    if (allRules.length > 1) {
      console.log(`[buildAiTitleRules] 合并 ${allRules.length} 批规则，使用第一批的规则`);
      // 可以在这里实现更复杂的合并逻辑，比如取平均值
    }

    return mergedRules;
  } catch (err) {
    console.error('[NovelImportService] buildAiTitleRules error:', err.message);
    // 如果是 429 错误，记录更详细的信息
    if (err.message && err.message.includes('429')) {
      console.error('[NovelImportService] Rate limit exceeded. Please wait and try again later.');
    }
    return null;
  }
}

/**
 * 合并统计规则和 AI 规则
 * @param {Object} stats - 统计画像
 * @param {Object|null} aiRules - AI 生成的规则
 * @returns {Object} 最终生效的规则对象
 */
function mergeTitleRulesFromStatsAndAI(stats, aiRules) {
  if (!stats) {
    // 如果没有统计画像，使用默认值
    return {
      minLen: 3,
      maxLen: 30,
      useChapterStyle: false,
      allowSentencePunctuation: false,
      chapterPrefixRegex: null,
    };
  }

  if (!aiRules) {
    return {
      minLen: stats.minNormalLen,
      maxLen: stats.maxNormalLen,
      useChapterStyle: stats.useChapterStyle,
      allowSentencePunctuation: stats.allowSentencePunctuation,
      chapterPrefixRegex: stats.useChapterStyle ? '^第.{1,6}(章|节)' : null,
    };
  }

  // 有 AI 规则时，用 AI 的字段覆盖部分统计结果；缺省字段用 stats 补充
  return {
    minLen: typeof aiRules.min_reasonable_length === 'number'
      ? aiRules.min_reasonable_length
      : stats.minNormalLen,
    maxLen: typeof aiRules.max_reasonable_length === 'number'
      ? aiRules.max_reasonable_length
      : stats.maxNormalLen,
    useChapterStyle: typeof aiRules.typical_prefix_regex === 'string'
      ? true
      : stats.useChapterStyle,
    allowSentencePunctuation: typeof aiRules.allow_sentence_punctuation === 'boolean'
      ? aiRules.allow_sentence_punctuation
      : stats.allowSentencePunctuation,
    chapterPrefixRegex: typeof aiRules.typical_prefix_regex === 'string'
      ? aiRules.typical_prefix_regex
      : (stats.useChapterStyle ? '^第.{1,6}(章|节)' : null),
  };
}

/**
 * 使用规则检查标题
 * @param {string} title - 标题
 * @param {Object} rules - 规则对象
 * @param {Set} issueTags - 问题标签集合
 */
function checkTitleWithRules(title, rules, issueTags) {
  const t = title.trim();
  if (!t) {
    issueTags.add('title_empty');
    return;
  }

  const len = t.length;

  // 1. 远超本书正常长度上限：认为带正文的概率很大
  if (len > rules.maxLen + 5) {
    issueTags.add('title_too_long_for_book');
  }

  // 2. 明显短得离谱（可能错误切割）
  if (len < rules.minLen - 3) {
    issueTags.add('title_too_short_for_book');
  }

  // 3. 如果本书标题多数没有句读，这个标题却有很多句读且偏长，则怀疑是句子
  const hasSentencePunctuation = /[，。！？、,.!?]/.test(t);
  if (!rules.allowSentencePunctuation && hasSentencePunctuation && len > rules.maxLen) {
    issueTags.add('title_like_sentence');
  }

  // 4. 如果绝大部分标题是"第X章/节"，但这个不是这种模式，则认为风格不一致
  if (rules.useChapterStyle && rules.chapterPrefixRegex) {
    const re = new RegExp(rules.chapterPrefixRegex);
    if (!re.test(t)) {
      issueTags.add('title_style_mismatch');
    }
  }
}

/**
 * 检查标题中的广告规则
 * @param {string} title - 标题
 * @param {Set} issueTags - 问题标签集合
 */
function checkTitleAdRules(title, issueTags) {
  if (/www\.|\.com\b|小说网|免费阅读|记住本站|手机阅读/.test(title)) {
    issueTags.add('title_ad_like');
  }
}

/**
 * 运行导入章节预检查
 * @param {number} batchId - 批次ID
 * @returns {Promise<{total: number, issueCount: number}>}
 */
async function runImportChapterPrecheck(batchId) {
  let db;
  try {
    db = await mysql.createConnection(dbConfig);

    // 先获取批次信息，获取 novel_id
    const [batches] = await db.execute(
      'SELECT novel_id FROM novel_import_batch WHERE id = ?',
      [batchId]
    );

    if (batches.length === 0) {
      throw new Error(`Import batch with ID ${batchId} not found`);
    }

    const novelId = batches[0].novel_id;

    // 获取该小说的所有章节（不仅仅是当前批次的，因为前端显示的是所有章节）
    const [chapters] = await db.execute(
      `SELECT id, chapter_number, clean_title, raw_title, clean_content, raw_content, en_content 
       FROM novel_import_chapter 
       WHERE novel_id = ?
       ORDER BY chapter_number ASC`,
      [novelId]
    );

    const AD_KEYWORDS = [
      '微信', 'QQ群', '扣群', '企鹅群', '公众号',
      '扫二维码', '加群', '加我', '加VX',
      '记住本站', '本站', '小说网', '免费小说',
      '.com', '.net', '.org', 'www.', 'http://', 'https://'
    ];

    // 直接调用 AI 批量检查所有标题并自动修复（一次性处理，不分批）
    let aiResults = [];
    let autoFixedCount = 0;
    let suspectCount = 0;

    try {
      // 构造标题数组
      const titleItems = chapters.map(ch => ({
        chapterNumber: ch.chapter_number,
        title: (ch.clean_title || ch.raw_title || '').trim(),
      }));

      if (titleItems.length > 0) {
        console.log(`[NovelImportService] 开始调用 AI 一次性检查 ${titleItems.length} 个标题的合理性并自动修复...`);
        aiResults = await checkTitlesReasonableness(titleItems);
        console.log(`[NovelImportService] AI 标题检查完成，返回 ${aiResults.length} 个结果`);

        // 统计
        suspectCount = aiResults.filter(r => !r.is_reasonable).length;
        autoFixedCount = aiResults.filter(r => r.is_modified).length;
      }
    } catch (err) {
      console.error('[NovelImportService] AI 标题检查失败:', err.message);
      throw err; // 如果 AI 检查失败，直接抛出错误
    }

    // 建立 AI 结果映射
    const aiMap = new Map();
    aiResults.forEach(r => {
      aiMap.set(r.chapterNumber, r);
    });

    let issueCount = 0;

    // 六、对每个章节进行检查并应用 AI 修复
    for (const chapter of chapters) {
      const issueTags = new Set();
      const ai = aiMap.get(chapter.chapter_number);

      // 获取原始标题和正文
      let rawTitle = (chapter.clean_title || chapter.raw_title || '').trim();
      let zhContent = (chapter.clean_content || chapter.raw_content || '').trim();
      const enContent = (chapter.en_content || '').trim();
      const combinedContent = `${zhContent}\n${enContent}`;

      // 应用 AI 修复（如果存在）
      let displayTitle = rawTitle;
      let displayContent = zhContent;
      let autoFixedTitle = false;
      let autoFixReason = '';
      let movedTextPreview = '';

      if (ai) {
        // 如果 AI 表示此条已经做了修改，就应用"截断 + 正文前置"
        if (ai.is_modified && ai.cleaned_title) {
          displayTitle = ai.cleaned_title.trim();
          autoFixedTitle = true;
          autoFixReason = ai.reason || '';
        }

        if (ai.move_to_body_prefix) {
          const prefix = ai.move_to_body_prefix.trim();
          if (prefix) {
            movedTextPreview = prefix;
            // 真正应用到正文预览：把这段文字插入正文开头
            displayContent = prefix + '\n' + (displayContent || '');
            autoFixedTitle = true; // 只要移动过内容，也算自动修复
            if (!autoFixReason) {
              autoFixReason = ai.reason || 'AI 自动将部分标题内容移入正文开头';
            }
          }
        }

        // 如果标题不合理，标记问题
        if (!ai.is_reasonable) {
          issueTags.add('title_unreasonable');
        }
      }

      // 规则 1：标题广告检查（不再使用统计规则，完全依赖 AI 判断）
      checkTitleAdRules(displayTitle, issueTags);

      // 规则 2：正文广告/外链/站点信息
      for (const kw of AD_KEYWORDS) {
        if (combinedContent.includes(kw)) {
          issueTags.add('ad_line');
          break;
        }
      }
      if (/(http:\/\/|https:\/\/|www\.)\S+/i.test(combinedContent)) {
        issueTags.add('url_in_content');
      }

      // 规则 3：正文极端长度
      const wordLen = (displayContent || '').length;
      if (wordLen < 20 || wordLen > 20000) {
        issueTags.add('length_suspect');
      }

      const hasIssue = issueTags.size > 0;
      const issueTagsStr = hasIssue ? Array.from(issueTags).join(',') : null;
      let issueSummary = hasIssue ? `规则触发：${issueTagsStr}` : null;

      // 如果 AI 自动修复了，在 issue_summary 中说明
      if (autoFixedTitle) {
        if (issueSummary) {
          issueSummary = `AI 已自动修复：${autoFixReason}；${issueSummary}`;
        } else {
          issueSummary = `AI 已自动修复：${autoFixReason}`;
        }
      }

      if (hasIssue) {
        issueCount++;
      }

      // 更新章节：应用 AI 修复后的标题和正文，并更新预检查标记
      await db.execute(
        `UPDATE novel_import_chapter 
         SET clean_title = ?, clean_content = ?, 
             has_issue = ?, issue_tags = ?, issue_summary = ?, updated_at = NOW()
         WHERE id = ?`,
        [
          displayTitle, // 应用修复后的标题
          displayContent, // 应用修复后的正文
          hasIssue ? 1 : 0,
          issueTagsStr,
          issueSummary,
          chapter.id
        ]
      );
    }

    return {
      total: chapters.length,
      issueCount,
      suspectCount, // AI 判断不合理的标题数
      autoFixedCount, // AI 自动修复的标题数
    };
  } catch (error) {
    console.error('[NovelImportService] runImportChapterPrecheck error:', error);
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
  runImportChapterPrecheck,
};

