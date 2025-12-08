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
const { getOpenAIClient } = require('../ai/translationModel');

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
      // 注意：数据库 ENUM 值为 'free','key','karma','subscription'
      // 免费章节用 'free'，收费章节用 'karma'（按字数计算价格）
      const unlockPriority = isFree ? 'free' : 'karma';

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

    // 简单抽样，避免 prompt 太长：取前 80 个或 titles 总数
    const sample = titles.slice(0, 80);

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
${sample.join('\n')}`;

    const response = await client.chat.completions.create({
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

    const text = response.choices[0]?.message?.content || '';
    
    // 尝试解析 JSON
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.warn('[NovelImportService] AI response does not contain valid JSON');
      return null;
    }

    const parsed = JSON.parse(jsonMatch[0]);
    return parsed;
  } catch (err) {
    console.error('[NovelImportService] buildAiTitleRules error:', err.message);
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

    // 获取批次的所有章节
    const [chapters] = await db.execute(
      `SELECT id, clean_title, raw_title, clean_content, raw_content, en_content 
       FROM novel_import_chapter 
       WHERE batch_id = ?`,
      [batchId]
    );

    const AD_KEYWORDS = [
      '微信', 'QQ群', '扣群', '企鹅群', '公众号',
      '扫二维码', '加群', '加我', '加VX',
      '记住本站', '本站', '小说网', '免费小说',
      '.com', '.net', '.org', 'www.', 'http://', 'https://'
    ];

    // 一、提取所有标题，生成统计画像
    const allTitles = chapters
      .map(ch => (ch.clean_title || ch.raw_title || '').trim())
      .filter(t => t.length > 0);

    let titleStats = null;
    let aiTitleRules = null;
    let effectiveTitleRules = null;

    if (allTitles.length > 0) {
      // 二、构建统计画像（纯统计自适应规则）
      titleStats = buildTitleStats(allTitles);

      // 三、可选：调用 AI 生成补充规则
      try {
        aiTitleRules = await buildAiTitleRules(allTitles, titleStats);
      } catch (err) {
        console.warn('[NovelImportService] AI title rules generation failed, using stats only:', err.message);
      }

      // 四、合并统计规则和 AI 规则
      effectiveTitleRules = mergeTitleRulesFromStatsAndAI(titleStats, aiTitleRules);

      // 开发环境日志（可选）
      if (process.env.NODE_ENV === 'development') {
        console.log('[NovelImportService] Title precheck stats:', {
          titleStats,
          aiTitleRules,
          effectiveTitleRules,
        });
      }
    } else {
      // 如果没有标题，使用默认规则
      effectiveTitleRules = {
        minLen: 3,
        maxLen: 30,
        useChapterStyle: false,
        allowSentencePunctuation: false,
        chapterPrefixRegex: null,
      };
    }

    let issueCount = 0;

    // 五、对每个章节进行检查
    for (const chapter of chapters) {
      const issueTags = new Set();

      // 获取标题
      const rawTitle = (chapter.clean_title || chapter.raw_title || '').trim();
      const zhContent = (chapter.clean_content || chapter.raw_content || '').trim();
      const enContent = (chapter.en_content || '').trim();
      const combinedContent = `${zhContent}\n${enContent}`;

      // 规则 1：标题检查（使用统计+AI规则）
      if (effectiveTitleRules) {
        checkTitleWithRules(rawTitle, effectiveTitleRules, issueTags);
      }
      checkTitleAdRules(rawTitle, issueTags);

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
      const wordLen = (combinedContent || '').length;
      if (wordLen < 20 || wordLen > 20000) {
        issueTags.add('length_suspect');
      }

      const hasIssue = issueTags.size > 0;
      const issueTagsStr = hasIssue ? Array.from(issueTags).join(',') : null;
      const issueSummary = hasIssue ? `规则触发：${issueTagsStr}` : null;

      if (hasIssue) {
        issueCount++;
      }

      // 更新章节的预检查标记
      await db.execute(
        `UPDATE novel_import_chapter 
         SET has_issue = ?, issue_tags = ?, issue_summary = ?, updated_at = NOW()
         WHERE id = ?`,
        [hasIssue ? 1 : 0, issueTagsStr, issueSummary, chapter.id]
      );
    }

    return {
      total: chapters.length,
      issueCount,
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

