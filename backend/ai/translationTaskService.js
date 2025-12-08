/**
 * 翻译任务服务
 * 管理翻译任务的创建和执行
 */

const mysql = require('mysql2/promise');
const { segmentChapters } = require('./chapterSegmentation');
const { translateChapterText, translateChapterTitle } = require('./translationModel');
const { buildChapterImportConfig } = require('../services/aiChapterImportConfig');
const { buildChapterRowFromDraft } = require('../services/aiChapterImportService');
const { runChapterPipeline } = require('./langchain/chapterTranslationPipeline');
const { getGlobalRateLimiter } = require('./langchain/rateLimiter');
// 注意：翻译导入的章节默认为草稿状态，不记录字数统计，所以这里不需要导入 authorDailyWordCountService

// 数据库配置
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '123456',
  database: process.env.DB_NAME || 'kongfuworld',
  charset: 'utf8mb4'
};

/**
 * 创建翻译任务（从文本）
 * @param {Object} params
 * @param {number} params.novelId - 小说ID
 * @param {string} params.sourceText - 源文本
 * @param {number} params.adminId - 管理员ID
 * @param {string} params.targetLanguage - 目标语言（默认 'en'）
 * @param {string} params.sourceLanguage - 源语言（默认 'zh'）
 * @param {Object} [params.importConfig] - 导入配置（可选）
 * @returns {Promise<{taskId: number, totalChapters: number, importConfig: Object}>}
 */
async function createTranslationTaskFromText({ novelId, sourceText, adminId, targetLanguage = 'en', sourceLanguage = 'zh', importConfig: rawImportConfig }) {
  let db;
  try {
    db = await mysql.createConnection(dbConfig);

    // 1. 验证小说是否存在
    const [novels] = await db.execute('SELECT id, user_id FROM novel WHERE id = ?', [novelId]);
    if (novels.length === 0) {
      throw new Error(`Novel with ID ${novelId} not found`);
    }

    // 2. 构建导入配置
    let importConfig;
    try {
      importConfig = buildChapterImportConfig({ novelId, ...rawImportConfig });
    } catch (error) {
      console.warn('[TranslationTaskService] Failed to build import config, using defaults:', error.message);
      // 如果配置构建失败，使用默认配置
      importConfig = buildChapterImportConfig({ novelId });
    }

    // 3. 分割章节
    const chapters = segmentChapters(sourceText);
    if (chapters.length === 0) {
      throw new Error('No chapters found in source text');
    }

    // 4. 创建翻译任务记录
    const [taskResult] = await db.execute(
      `INSERT INTO translation_task (
        novel_id, source_language, target_language, status, total_chapters, 
        completed_chapters, failed_chapters, created_by_admin_id
      ) VALUES (?, ?, ?, 'pending', ?, 0, 0, ?)`,
      [novelId, sourceLanguage, targetLanguage, chapters.length, adminId]
    );
    const taskId = taskResult.insertId;

    // 5. 创建章节翻译占位记录
    const chapterValues = chapters.map(ch => [
      novelId,
      null, // chapter_id (待导入后填充)
      ch.chapterNumber,
      targetLanguage,
      ch.title, // 临时标题（中文），后续会被翻译
      ch.content, // 临时内容（中文），后续会被翻译
      'pending',
      taskId,
      null // error_message
    ]);

    if (chapterValues.length > 0) {
      await db.query(
        `INSERT INTO chapter_translation (
          novel_id, chapter_id, chapter_number, language, title, content, 
          status, task_id, error_message
        ) VALUES ?`,
        [chapterValues]
      );
    }

    return {
      taskId,
      totalChapters: chapters.length,
      importConfig,
    };
  } catch (error) {
    console.error('[TranslationTaskService] Error creating translation task:', error);
    throw error;
  } finally {
    if (db) await db.end();
  }
}

/**
 * 执行翻译任务
 * @param {number} taskId - 任务ID
 * @param {Object} [importConfig] - 导入配置（可选，如果任务创建时已保存则不需要）
 * @returns {Promise<void>}
 */
async function runTranslationTask(taskId, importConfig) {
  let db;
  try {
    db = await mysql.createConnection(dbConfig);

    // 1. 获取任务信息
    const [tasks] = await db.execute(
      'SELECT * FROM translation_task WHERE id = ?',
      [taskId]
    );
    if (tasks.length === 0) {
      throw new Error(`Translation task ${taskId} not found`);
    }
    const task = tasks[0];

    // 1.1 如果没有传入 importConfig，尝试从任务记录中获取（如果之前保存了）
    // 目前先使用传入的 importConfig，如果为 null 则使用默认配置
    let finalImportConfig = importConfig;
    if (!finalImportConfig) {
      try {
        finalImportConfig = buildChapterImportConfig({ novelId: task.novel_id });
      } catch (error) {
        console.warn('[TranslationTaskService] Failed to build default import config:', error.message);
        throw new Error('Import config is required');
      }
    }

    // 2. 更新任务状态为 running
    await db.execute(
      'UPDATE translation_task SET status = ? WHERE id = ?',
      ['running', taskId]
    );

    // 3. 获取所有待处理的章节翻译
    const [chapters] = await db.execute(
      `SELECT * FROM chapter_translation 
       WHERE task_id = ? AND status = 'pending' 
       ORDER BY chapter_number ASC`,
      [taskId]
    );

    let completedCount = 0;
    let failedCount = 0;

    // 4. 逐个处理章节
    // 速率限制管理：每分钟最多3次请求（RPM limit: 3）
    // 使用滑动窗口：记录最近1分钟内的请求时间
    const requestTimestamps = [];
    const RPM_LIMIT = 3;
    const WINDOW_MS = 60000; // 1分钟窗口

    for (let i = 0; i < chapters.length; i++) {
      const chapter = chapters[i];
      try {
        console.log(`[TranslationTaskService] Processing chapter ${chapter.chapter_number} (${i + 1}/${chapters.length})...`);

        // 速率限制控制：确保每分钟不超过3次请求
        if (i > 0) {
          const now = Date.now();
          // 清理1分钟前的请求记录
          while (requestTimestamps.length > 0 && now - requestTimestamps[0] > WINDOW_MS) {
            requestTimestamps.shift();
          }
          
          // 如果已经达到限制，等待到窗口内最早的请求过期
          if (requestTimestamps.length >= RPM_LIMIT) {
            const oldestRequest = requestTimestamps[0];
            const waitTime = WINDOW_MS - (now - oldestRequest) + 1000; // 额外等待1秒确保安全
            console.log(`[TranslationTaskService] Rate limit reached, waiting ${Math.ceil(waitTime / 1000)}s...`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
            // 清理过期记录
            const newNow = Date.now();
            while (requestTimestamps.length > 0 && newNow - requestTimestamps[0] > WINDOW_MS) {
              requestTimestamps.shift();
            }
          }
          
          // 记录本次请求时间
          requestTimestamps.push(Date.now());
        } else {
          // 第一次请求也记录
          requestTimestamps.push(Date.now());
        }

        // 4.1 翻译标题和内容
        const translatedTitle = await translateChapterTitle(chapter.title);
        const translatedContent = await translateChapterText(chapter.content);

        // 4.2 更新章节翻译记录
        await db.execute(
          `UPDATE chapter_translation 
           SET title = ?, content = ?, status = 'translated' 
           WHERE id = ?`,
          [translatedTitle, translatedContent, chapter.id]
        );

        // 4.3 计算字数
        const wordCount = translatedContent ? translatedContent.replace(/\s/g, '').length : 0;

        // 4.4 构建章节草稿
        const draft = {
          chapterNumber: chapter.chapter_number,
          title: translatedTitle,
          content: translatedContent,
          wordCount,
        };

        // 4.5 计算在批次中的索引（从 0 开始）
        const indexInBatch = chapters.findIndex(c => c.id === chapter.id);
        const now = new Date();

        // 4.6 使用新的服务构建章节行数据
        const chapterRow = await buildChapterRowFromDraft(draft, finalImportConfig, indexInBatch, now);

        // 4.7 检查章节号是否已存在
        const [existing] = await db.execute(
          'SELECT id FROM chapter WHERE novel_id = ? AND chapter_number = ?',
          [task.novel_id, chapter.chapter_number]
        );

        if (existing.length > 0) {
          throw new Error(`Chapter ${chapter.chapter_number} already exists for novel ${task.novel_id}`);
        }

        // 4.8 确保 volume 存在
        // 注意：chapterRow.volume_id 是卷号（1, 2, 3...），需要查找对应的 volume.id（主键）
        let [volumes] = await db.execute(
          'SELECT id FROM volume WHERE novel_id = ? AND volume_id = ?',
          [task.novel_id, chapterRow.volume_id]
        );

        let actualVolumeId;
        if (volumes.length === 0) {
          // 创建卷（使用 volume_id 作为 volume_id 字段的值）
          const [volumeResult] = await db.execute(
            'INSERT INTO volume (novel_id, volume_id, title) VALUES (?, ?, ?)',
            [task.novel_id, chapterRow.volume_id, `Volume ${chapterRow.volume_id}`]
          );
          actualVolumeId = volumeResult.insertId;
        } else {
          actualVolumeId = volumes[0].id;
        }

        // 4.9 插入章节（使用 actualVolumeId，即 volume.id）
        const [result] = await db.execute(
          `INSERT INTO chapter (
            novel_id, volume_id, chapter_number, title, content,
            translator_note, is_advance, key_cost, unlock_price,
            review_status, word_count, is_released, release_date,
            unlock_priority, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            chapterRow.novel_id,
            actualVolumeId, // 使用 volume.id（主键），而不是 volume_id（卷号）
            chapterRow.chapter_number,
            chapterRow.title.trim(),
            chapterRow.content || '',
            chapterRow.translator_note,
            chapterRow.is_advance,
            chapterRow.key_cost,
            chapterRow.unlock_price,
            chapterRow.review_status,
            chapterRow.word_count,
            chapterRow.is_released,
            chapterRow.release_date,
            chapterRow.unlock_priority,
            chapterRow.created_at,
            chapterRow.updated_at,
          ]
        );

        const chapterId = result.insertId;

        // 4.10 更新章节翻译记录的 chapter_id
        await db.execute(
          'UPDATE chapter_translation SET chapter_id = ?, status = ? WHERE id = ?',
          [chapterId, 'imported', chapter.id]
        );

        completedCount++;
        console.log(`[TranslationTaskService] Chapter ${chapter.chapter_number} completed (chapter_id: ${chapterId})`);

      } catch (error) {
        console.error(`[TranslationTaskService] Error processing chapter ${chapter.chapter_number}:`, error);
        failedCount++;

        // 更新章节翻译记录为失败
        await db.execute(
          `UPDATE chapter_translation 
           SET status = 'failed', error_message = ? 
           WHERE id = ?`,
          [error.message.substring(0, 1000), chapter.id]
        );
      }
    }

    // 5. 更新任务状态
    const finalStatus = failedCount === 0 ? 'completed' : (completedCount > 0 ? 'completed' : 'failed');
    await db.execute(
      `UPDATE translation_task 
       SET status = ?, completed_chapters = ?, failed_chapters = ? 
       WHERE id = ?`,
      [finalStatus, completedCount, failedCount, taskId]
    );

    console.log(`[TranslationTaskService] Task ${taskId} completed: ${completedCount} succeeded, ${failedCount} failed`);

  } catch (error) {
    console.error(`[TranslationTaskService] Error running translation task ${taskId}:`, error);
    
    // 更新任务状态为失败
    if (db) {
      try {
        await db.execute(
          `UPDATE translation_task 
           SET status = 'failed', error_message = ? 
           WHERE id = ?`,
          [error.message.substring(0, 1000), taskId]
        );
      } catch (updateError) {
        console.error('[TranslationTaskService] Error updating task status:', updateError);
      }
    }
    
    throw error;
  } finally {
    if (db) await db.end();
  }
}

// 注意：createChapterFromTranslation 函数已被新的 buildChapterRowFromDraft 逻辑替代
// 保留此注释以便将来参考

/**
 * 获取任务详情（包含章节列表）
 * @param {number} taskId - 任务ID
 * @returns {Promise<{task: Object, chapters: Array}>}
 */
async function getTaskDetails(taskId) {
  let db;
  try {
    db = await mysql.createConnection(dbConfig);

    // 获取任务信息
    const [tasks] = await db.execute(
      'SELECT * FROM translation_task WHERE id = ?',
      [taskId]
    );
    if (tasks.length === 0) {
      throw new Error(`Translation task ${taskId} not found`);
    }

    // 获取章节列表
    const [chapters] = await db.execute(
      `SELECT id, chapter_number, title, status, chapter_id, error_message
       FROM chapter_translation 
       WHERE task_id = ? 
       ORDER BY chapter_number ASC`,
      [taskId]
    );

    return {
      task: tasks[0],
      chapters: chapters,
    };
  } catch (error) {
    console.error('[TranslationTaskService] Error getting task details:', error);
    throw error;
  } finally {
    if (db) await db.end();
  }
}

/**
 * 从导入批次创建翻译任务
 * @param {Object} params
 * @param {number} params.batchId - 导入批次ID
 * @param {number} params.adminId - 管理员ID
 * @returns {Promise<{taskId: number, totalChapters: number}>}
 */
async function createTranslationTaskFromImportBatch({ batchId, adminId }) {
  let db;
  try {
    db = await mysql.createConnection(dbConfig);

    // 1. 读取导入批次信息
    const [batches] = await db.execute(
      'SELECT * FROM novel_import_batch WHERE id = ?',
      [batchId]
    );
    if (batches.length === 0) {
      throw new Error(`Import batch with ID ${batchId} not found`);
    }
    const batch = batches[0];

    // 2. 读取所有 ready_for_translation 状态的章节
    const [chapters] = await db.execute(
      `SELECT * FROM novel_import_chapter 
       WHERE batch_id = ? AND status = 'ready_for_translation'
       ORDER BY chapter_number ASC`,
      [batchId]
    );

    if (chapters.length === 0) {
      throw new Error(`No chapters ready for translation in batch ${batchId}`);
    }

    // 3. 创建翻译任务记录
    const [taskResult] = await db.execute(
      `INSERT INTO translation_task (
        novel_id, source_language, target_language, status, total_chapters,
        completed_chapters, failed_chapters, created_by_admin_id
      ) VALUES (?, 'zh', 'en', 'pending', ?, 0, 0, ?)`,
      [batch.novel_id, chapters.length, adminId]
    );
    const taskId = taskResult.insertId;

    // 4. 为每个章节在 chapter_translation 中创建占位记录
    for (const chapter of chapters) {
      await db.execute(
        `INSERT INTO chapter_translation (
          novel_id, chapter_id, chapter_number, language, title, content,
          status, task_id
        ) VALUES (?, NULL, ?, 'en', ?, ?, 'pending', ?)`,
        [
          batch.novel_id,
          chapter.chapter_number,
          chapter.raw_title || chapter.clean_title || '',
          chapter.raw_content || chapter.clean_content || '',
          taskId,
        ]
      );
    }

    // 5. 更新批次状态
    await db.execute(
      'UPDATE novel_import_batch SET status = ? WHERE id = ?',
      ['translating', batchId]
    );

    console.log(`[TranslationTaskService] Created translation task ${taskId} from import batch ${batchId} with ${chapters.length} chapters`);

    return {
      taskId,
      totalChapters: chapters.length,
    };
  } catch (error) {
    console.error('[TranslationTaskService] createTranslationTaskFromImportBatch error:', error);
    throw error;
  } finally {
    if (db) await db.end();
  }
}

/**
 * 运行翻译任务（基于导入批次，使用 LangChain 流水线）
 * @param {number} taskId - 任务ID
 * @param {Object} [importConfig] - 导入配置（可选）
 * @returns {Promise<void>}
 */
async function runTranslationTaskFromImportBatch(taskId, importConfig) {
  let db;
  try {
    db = await mysql.createConnection(dbConfig);

    // 1. 获取任务信息
    const [tasks] = await db.execute(
      'SELECT * FROM translation_task WHERE id = ?',
      [taskId]
    );
    if (tasks.length === 0) {
      throw new Error(`Translation task ${taskId} not found`);
    }
    const task = tasks[0];

    // 2. 获取导入批次信息（通过 novel_id 和 created_by_admin_id 查找）
    const [batches] = await db.execute(
      `SELECT * FROM novel_import_batch 
       WHERE novel_id = ? AND created_by_admin_id = ? 
       AND status = 'translating'
       ORDER BY id DESC LIMIT 1`,
      [task.novel_id, task.created_by_admin_id]
    );

    if (batches.length === 0) {
      throw new Error(`No active import batch found for task ${taskId}`);
    }
    const batch = batches[0];

    // 3. 构建导入配置
    let finalImportConfig = importConfig;
    if (!finalImportConfig) {
      try {
        finalImportConfig = buildChapterImportConfig({ novelId: task.novel_id });
      } catch (error) {
        console.warn('[TranslationTaskService] Failed to build default import config:', error.message);
        throw new Error('Import config is required');
      }
    }

    // 4. 更新任务状态为 running
    await db.execute(
      'UPDATE translation_task SET status = ? WHERE id = ?',
      ['running', taskId]
    );

    // 5. 获取所有待处理的章节翻译
    const [chapterTranslations] = await db.execute(
      `SELECT * FROM chapter_translation 
       WHERE task_id = ? AND status = 'pending' 
       ORDER BY chapter_number ASC`,
      [taskId]
    );

    let completedCount = 0;
    let failedCount = 0;

    // 6. 获取速率限制器
    const rateLimiter = getGlobalRateLimiter();

    // 7. 逐个处理章节
    for (let i = 0; i < chapterTranslations.length; i++) {
      const chapterTranslation = chapterTranslations[i];
      try {
        console.log(`[TranslationTaskService] Processing chapter ${chapterTranslation.chapter_number} (${i + 1}/${chapterTranslations.length})...`);

        // 7.1 找到对应的 novel_import_chapter 记录
        const [importChapters] = await db.execute(
          `SELECT * FROM novel_import_chapter 
           WHERE batch_id = ? AND chapter_number = ?`,
          [batch.id, chapterTranslation.chapter_number]
        );

        if (importChapters.length === 0) {
          throw new Error(`Import chapter not found for chapter ${chapterTranslation.chapter_number}`);
        }
        const importChapter = importChapters[0];

        // 7.2 通过速率限制器调度调用 LangChain 流水线
        const pipelineResult = await rateLimiter.schedule(async () => {
          return await runChapterPipeline({
            raw_title: importChapter.raw_title,
            raw_content: importChapter.raw_content,
            clean_title: importChapter.clean_title,
            clean_content: importChapter.clean_content,
          });
        });

        // 7.3 更新 novel_import_chapter
        await db.execute(
          `UPDATE novel_import_chapter 
           SET clean_title = ?, clean_content = ?,
               en_title = ?, en_content = ?, word_count = ?,
               status = 'translated'
           WHERE id = ?`,
          [
            pipelineResult.clean_title,
            pipelineResult.clean_content,
            pipelineResult.en_title,
            pipelineResult.en_content,
            pipelineResult.word_count,
            importChapter.id,
          ]
        );

        // 7.4 构建章节行数据（使用英文内容）
        const draft = {
          chapterNumber: importChapter.chapter_number,
          title: pipelineResult.en_title,
          content: pipelineResult.en_content,
          wordCount: pipelineResult.word_count,
        };

        // 计算在批次中的索引
        const [allImportChapters] = await db.execute(
          `SELECT id FROM novel_import_chapter 
           WHERE batch_id = ? AND status != 'duplicate_existing'
           ORDER BY chapter_number ASC`,
          [batch.id]
        );
        const indexInBatch = allImportChapters.findIndex(c => c.id === importChapter.id);
        const now = new Date();

        const chapterRow = await buildChapterRowFromDraft(draft, finalImportConfig, indexInBatch, now);

        // 7.5 检查章节是否已存在
        const [existing] = await db.execute(
          'SELECT id FROM chapter WHERE novel_id = ? AND chapter_number = ?',
          [task.novel_id, importChapter.chapter_number]
        );

        if (existing.length > 0) {
          console.warn(`[TranslationTaskService] Chapter ${importChapter.chapter_number} already exists, skipping import`);
          // 更新状态为 skipped
          await db.execute(
            `UPDATE novel_import_chapter SET status = 'skipped' WHERE id = ?`,
            [importChapter.id]
          );
          await db.execute(
            `UPDATE chapter_translation SET status = 'skipped' WHERE id = ?`,
            [chapterTranslation.id]
          );
          failedCount++;
          continue;
        }

        // 7.6 确保 volume 存在
        let [volumes] = await db.execute(
          'SELECT id FROM volume WHERE novel_id = ? AND volume_id = ?',
          [task.novel_id, chapterRow.volume_id]
        );

        let actualVolumeId;
        if (volumes.length === 0) {
          const [volumeResult] = await db.execute(
            'INSERT INTO volume (novel_id, volume_id, title) VALUES (?, ?, ?)',
            [task.novel_id, chapterRow.volume_id, `Volume ${chapterRow.volume_id}`]
          );
          actualVolumeId = volumeResult.insertId;
        } else {
          actualVolumeId = volumes[0].id;
        }

        // 7.7 插入章节
        const [result] = await db.execute(
          `INSERT INTO chapter (
            novel_id, volume_id, chapter_number, title, content,
            translator_note, is_advance, key_cost, unlock_price,
            review_status, word_count, is_released, release_date,
            unlock_priority, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            chapterRow.novel_id,
            actualVolumeId,
            chapterRow.chapter_number,
            chapterRow.title.trim(),
            chapterRow.content || '',
            chapterRow.translator_note,
            chapterRow.is_advance,
            chapterRow.key_cost,
            chapterRow.unlock_price,
            chapterRow.review_status,
            chapterRow.word_count,
            chapterRow.is_released,
            chapterRow.release_date,
            chapterRow.unlock_priority,
            chapterRow.created_at,
            chapterRow.updated_at,
          ]
        );

        const chapterId = result.insertId;

        // 7.8 更新 chapter_translation
        await db.execute(
          'UPDATE chapter_translation SET chapter_id = ?, status = ? WHERE id = ?',
          [chapterId, 'imported', chapterTranslation.id]
        );

        // 7.9 更新 novel_import_chapter
        await db.execute(
          'UPDATE novel_import_chapter SET chapter_id = ?, status = ? WHERE id = ?',
          [chapterId, 'imported', importChapter.id]
        );

        completedCount++;
        console.log(`[TranslationTaskService] Chapter ${importChapter.chapter_number} completed (chapter_id: ${chapterId})`);

      } catch (error) {
        console.error(`[TranslationTaskService] Error processing chapter ${chapterTranslation.chapter_number}:`, error);
        failedCount++;

        // 更新状态为失败
        await db.execute(
          `UPDATE chapter_translation 
           SET status = 'failed', error_message = ? 
           WHERE id = ?`,
          [error.message.substring(0, 1000), chapterTranslation.id]
        );

        // 更新 novel_import_chapter 状态
        const [importChapters] = await db.execute(
          `SELECT id FROM novel_import_chapter 
           WHERE batch_id = ? AND chapter_number = ?`,
          [batch.id, chapterTranslation.chapter_number]
        );
        if (importChapters.length > 0) {
          await db.execute(
            `UPDATE novel_import_chapter SET status = 'failed' WHERE id = ?`,
            [importChapters[0].id]
          );
        }
      }
    }

    // 8. 更新任务状态
    const finalStatus = failedCount === 0 ? 'completed' : (completedCount > 0 ? 'completed' : 'failed');
    await db.execute(
      `UPDATE translation_task 
       SET status = ?, completed_chapters = ?, failed_chapters = ? 
       WHERE id = ?`,
      [finalStatus, completedCount, failedCount, taskId]
    );

    // 9. 更新批次状态
    await db.execute(
      'UPDATE novel_import_batch SET status = ? WHERE id = ?',
      [finalStatus === 'completed' ? 'completed' : 'failed', batch.id]
    );

    console.log(`[TranslationTaskService] Task ${taskId} completed: ${completedCount} succeeded, ${failedCount} failed`);

  } catch (error) {
    console.error(`[TranslationTaskService] Error running translation task ${taskId}:`, error);
    
    // 更新任务状态为失败
    if (db) {
      try {
        await db.execute(
          `UPDATE translation_task 
           SET status = 'failed', error_message = ? 
           WHERE id = ?`,
          [error.message.substring(0, 1000), taskId]
        );
      } catch (updateError) {
        console.error('[TranslationTaskService] Error updating task status:', updateError);
      }
    }
    
    throw error;
  } finally {
    if (db) await db.end();
  }
}

module.exports = {
  createTranslationTaskFromText,
  createTranslationTaskFromImportBatch,
  runTranslationTask,
  runTranslationTaskFromImportBatch,
  getTaskDetails,
};

