/**
 * 小说翻译 Workflow
 * 基于 LangChain 的有状态流水线实现
 */

const mysql = require('mysql2/promise');
const { getWorkflowContext } = require('./workflowContext');
const { segmentChapters } = require('../chapterSegmentation');
const { batchTranslateTitles } = require('./chapterTranslationPipeline');
const { runChapterPipeline } = require('./chapterTranslationPipeline');
const { getGlobalRateLimiter } = require('./rateLimiter');
const { buildChapterImportConfig } = require('../../services/aiChapterImportConfig');
const { buildChapterRowFromDraft, calcPriceByWordCount, calcVolumeId, calcReleaseInfo } = require('../../services/aiChapterImportService');
// 注意：buildAiTitleRules 是 novelImportService 的内部函数
// 我们需要通过 require 获取它，但由于它是内部函数，暂时跳过 AI 规则生成
// 未来可以将其提取为独立函数

// 数据库配置
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '123456',
  database: process.env.DB_NAME || 'kongfuworld',
  charset: 'utf8mb4'
};

/**
 * 获取翻译任务信息
 */
async function getTranslationTask(taskId) {
  const db = await mysql.createConnection(dbConfig);
  try {
    const [tasks] = await db.execute(
      'SELECT * FROM translation_task WHERE id = ?',
      [taskId]
    );
    if (tasks.length === 0) {
      throw new Error(`Translation task ${taskId} not found`);
    }
    return tasks[0];
  } finally {
    await db.end();
  }
}

/**
 * 更新任务步骤
 */
async function updateTaskStep(taskId, currentStep, checkpoint = null) {
  const db = await mysql.createConnection(dbConfig);
  try {
    if (checkpoint) {
      await db.execute(
        'UPDATE translation_task SET current_step = ?, checkpoint = ? WHERE id = ?',
        [currentStep, JSON.stringify(checkpoint), taskId]
      );
    } else {
      await db.execute(
        'UPDATE translation_task SET current_step = ? WHERE id = ?',
        [currentStep, taskId]
      );
    }
  } finally {
    await db.end();
  }
}

/**
 * 更新任务状态
 */
async function updateTaskStatus(taskId, { status, currentStep, errorMessage }) {
  const db = await mysql.createConnection(dbConfig);
  try {
    if (errorMessage) {
      await db.execute(
        'UPDATE translation_task SET status = ?, current_step = ?, error_message = ? WHERE id = ?',
        [status, currentStep, errorMessage.substring(0, 1000), taskId]
      );
    } else {
      await db.execute(
        'UPDATE translation_task SET status = ?, current_step = ? WHERE id = ?',
        [status, currentStep, taskId]
      );
    }
  } finally {
    await db.end();
  }
}

/**
 * 节点 1：章节切分
 */
async function segmentChaptersNode(taskId) {
  const { log } = getWorkflowContext();
  const db = await mysql.createConnection(dbConfig);
  
  try {
    log(`[Workflow][segmentChapters] 开始处理任务 ${taskId}`);
    
    const task = await getTranslationTask(taskId);
    
    // 检查是否已有章节记录
    const [existingChapters] = await db.execute(
      'SELECT COUNT(*) as count FROM chapter_translation WHERE task_id = ?',
      [taskId]
    );
    
    if (existingChapters[0].count > 0) {
      log(`[Workflow][segmentChapters] 任务 ${taskId} 已有 ${existingChapters[0].count} 个章节记录，跳过切分`);
      return;
    }
    
    // 获取源文本（从任务关联的导入批次或直接读取）
    // 这里需要根据实际情况获取 sourceText
    // 暂时假设从某个地方可以获取到
    log(`[Workflow][segmentChapters] 开始切分章节...`);
    
    // TODO: 需要从任务或导入批次中获取源文本
    // 这里先标记为需要实现
    log(`[Workflow][segmentChapters] ⚠️ 需要实现：从任务/批次获取源文本`);
    
    // 如果是从导入批次创建的任务，章节应该已经在 novel_import_chapter 中
    // 这里我们假设章节已经通过其他方式创建了 chapter_translation 记录
    log(`[Workflow][segmentChapters] 章节切分完成（或已存在）`);
    
  } catch (error) {
    log(`[Workflow][segmentChapters] 错误:`, error.message);
    throw error;
  } finally {
    await db.end();
  }
}

/**
 * 节点 2：分析标题规则
 */
async function analyzeTitleRulesNode(taskId) {
  const { log } = getWorkflowContext();
  const db = await mysql.createConnection(dbConfig);
  
  try {
    log(`[Workflow][analyzeTitleRules] 开始分析任务 ${taskId} 的标题规则`);
    
    const task = await getTranslationTask(taskId);
    
    // 检查是否已有规则（从 checkpoint 读取）
    if (task.checkpoint) {
      try {
        const checkpoint = JSON.parse(task.checkpoint);
        if (checkpoint.titleRules) {
          log(`[Workflow][analyzeTitleRules] 任务 ${taskId} 已有标题规则，跳过分析`);
          return;
        }
      } catch (e) {
        // checkpoint 解析失败，继续执行
      }
    }
    
    // 从 chapter_translation 获取所有标题（抽样前 N 个）
    const [chapters] = await db.execute(
      `SELECT title FROM chapter_translation 
       WHERE task_id = ? AND (title IS NOT NULL AND title != '')
       ORDER BY chapter_number ASC 
       LIMIT 100`,
      [taskId]
    );
    
    if (chapters.length === 0) {
      log(`[Workflow][analyzeTitleRules] 任务 ${taskId} 没有标题数据，跳过分析`);
      return;
    }
    
    const titles = chapters.map(ch => ch.title).filter(t => t && t.trim());
    
    if (titles.length === 0) {
      log(`[Workflow][analyzeTitleRules] 任务 ${taskId} 没有有效标题，跳过分析`);
      return;
    }
    
    log(`[Workflow][analyzeTitleRules] 抽取 ${titles.length} 个标题进行分析`);
    
    // 调用 buildAiTitleRules（通过 novelImportService）
    // 注意：buildAiTitleRules 是 novelImportService 的内部函数，我们需要通过其他方式调用
    // 这里我们使用一个间接方式：通过 batchId 来调用 runImportChapterPrecheck 中的逻辑
    // 或者直接在这里实现一个简化版本的标题规则分析
    
    // 由于 buildAiTitleRules 是内部函数，我们暂时跳过 AI 规则生成
    // 未来可以将其提取为独立函数或通过其他方式调用
    log(`[Workflow][analyzeTitleRules] 标题规则分析功能暂未实现，跳过 AI 规则生成`);
    
    // 保存一个空的规则对象到 checkpoint（表示已执行过分析）
    const checkpoint = task.checkpoint ? JSON.parse(task.checkpoint) : {};
    checkpoint.titleRulesAnalyzed = true;
    
    await db.execute(
      'UPDATE translation_task SET checkpoint = ? WHERE id = ?',
      [JSON.stringify(checkpoint), taskId]
    );
    
  } catch (error) {
    log(`[Workflow][analyzeTitleRules] 错误:`, error.message);
    throw error;
  } finally {
    await db.end();
  }
}

/**
 * 节点 3：批量翻译标题
 */
async function translateTitlesNode(taskId) {
  const { log } = getWorkflowContext();
  const db = await mysql.createConnection(dbConfig);
  const rateLimiter = getGlobalRateLimiter();
  
  try {
    log(`[Workflow][translateTitles] 开始翻译任务 ${taskId} 的标题`);
    
    // 获取所有待翻译标题的章节（status 为 pending 或 NULL，且 title 看起来像中文）
    const [chapters] = await db.execute(
      `SELECT id, chapter_number, title 
       FROM chapter_translation 
       WHERE task_id = ? 
         AND (status IS NULL OR status = 'pending' OR status = 'title_translated')
         AND (title IS NULL OR title = '' OR title REGEXP '[\\u4e00-\\u9fa5]')
       ORDER BY chapter_number ASC`,
      [taskId]
    );
    
    if (chapters.length === 0) {
      log(`[Workflow][translateTitles] 任务 ${taskId} 没有待翻译的标题`);
      return;
    }
    
    log(`[Workflow][translateTitles] 找到 ${chapters.length} 个待翻译标题`);
    
    // 组装为 batchTranslateTitles 需要的格式
    const items = chapters.map((ch, index) => ({
      index: index,
      chapterTranslationId: ch.id,
      chapterNumber: ch.chapter_number,
      chineseTitle: (ch.title || '').trim(),
    })).filter(it => it.chineseTitle && it.chineseTitle.length > 0);
    
    if (items.length === 0) {
      log(`[Workflow][translateTitles] 没有有效的中文标题`);
      return;
    }
    
    // 调用批量标题翻译
    const translatedList = await rateLimiter.schedule(async () => {
      return await batchTranslateTitles(
        items.map(it => ({
          index: it.index,
          chineseTitle: it.chineseTitle,
        })),
        {
          maxCharsPerBatch: 8000,
          maxItemsPerBatch: 50,
        }
      );
    });
    
    // 更新 chapter_translation
    const byIndex = new Map();
    for (const item of translatedList) {
      byIndex.set(item.index, item.translatedTitle);
    }
    
    await db.beginTransaction();
    try {
      let updateCount = 0;
      for (const it of items) {
        const translatedTitle = byIndex.get(it.index);
        if (!translatedTitle) {
          log(`[Workflow][translateTitles] 章节 ${it.chapterNumber} 没有翻译结果`);
          continue;
        }
        
        await db.execute(
          `UPDATE chapter_translation 
           SET title = ?, status = 'title_translated', last_step = 'translate_title' 
           WHERE id = ?`,
          [translatedTitle, it.chapterTranslationId]
        );
        updateCount++;
      }
      await db.commit();
      log(`[Workflow][translateTitles] 成功翻译 ${updateCount}/${items.length} 个标题`);
    } catch (err) {
      await db.rollback();
      throw err;
    }
    
  } catch (error) {
    log(`[Workflow][translateTitles] 错误:`, error.message);
    throw error;
  } finally {
    await db.end();
  }
}

/**
 * 节点 4：翻译正文
 */
async function translateBodiesNode(taskId) {
  const { log } = getWorkflowContext();
  const db = await mysql.createConnection(dbConfig);
  const rateLimiter = getGlobalRateLimiter();
  
  try {
    log(`[Workflow][translateBodies] 开始翻译任务 ${taskId} 的正文`);
    
    const task = await getTranslationTask(taskId);
    
    // 获取所有待翻译正文的章节（status 为 title_translated 或 pending，但正文未翻译）
    const [chapters] = await db.execute(
      `SELECT ct.*, nic.raw_title, nic.raw_content, nic.clean_title, nic.clean_content
       FROM chapter_translation ct
       LEFT JOIN translation_task tt ON ct.task_id = tt.id
       LEFT JOIN novel_import_batch nib ON tt.novel_id = nib.novel_id 
         AND tt.created_by_admin_id = nib.created_by_admin_id
       LEFT JOIN novel_import_chapter nic ON nib.id = nic.batch_id 
         AND ct.chapter_number = nic.chapter_number
       WHERE ct.task_id = ? 
         AND (ct.status = 'title_translated' OR (ct.status = 'pending' AND ct.title IS NOT NULL AND ct.title != '' AND ct.title NOT REGEXP '[\\u4e00-\\u9fa5]'))
         AND (ct.content IS NULL OR ct.content = '')
       ORDER BY ct.chapter_number ASC`,
      [taskId]
    );
    
    if (chapters.length === 0) {
      log(`[Workflow][translateBodies] 任务 ${taskId} 没有待翻译的正文`);
      return;
    }
    
    log(`[Workflow][translateBodies] 找到 ${chapters.length} 个待翻译正文的章节`);
    
    let completedCount = 0;
    let failedCount = 0;
    
    for (let i = 0; i < chapters.length; i++) {
      const chapter = chapters[i];
      try {
        log(`[Workflow][translateBodies] 处理章节 ${chapter.chapter_number} (${i + 1}/${chapters.length})`);
        
        // 获取原始内容（从 novel_import_chapter 或 chapter_translation）
        const rawTitle = chapter.raw_title || chapter.title || '';
        const rawContent = chapter.raw_content || '';
        const cleanTitle = chapter.clean_title || '';
        const cleanContent = chapter.clean_content || '';
        
        if (!rawContent && !cleanContent) {
          log(`[Workflow][translateBodies] 章节 ${chapter.chapter_number} 没有内容，跳过`);
          continue;
        }
        
        // 使用已翻译的标题（如果存在）
        const existingEnglishTitle = chapter.title && 
          !/[\\u4e00-\\u9fa5]/.test(chapter.title) 
          ? chapter.title 
          : null;
        
        // 调用翻译流水线（只翻译正文，不翻译标题）
        const pipelineResult = await rateLimiter.schedule(async () => {
          return await runChapterPipeline({
            raw_title: rawTitle,
            raw_content: rawContent,
            clean_title: cleanTitle,
            clean_content: cleanContent,
            existingEnglishTitle: existingEnglishTitle,
          });
        });
        
        // 更新 chapter_translation
        await db.execute(
          `UPDATE chapter_translation 
           SET content = ?, status = 'body_translated', last_step = 'translate_body' 
           WHERE id = ?`,
          [pipelineResult.en_content, chapter.id]
        );
        
        completedCount++;
        log(`[Workflow][translateBodies] 章节 ${chapter.chapter_number} 翻译完成`);
        
      } catch (error) {
        log(`[Workflow][translateBodies] 章节 ${chapter.chapter_number} 翻译失败:`, error.message);
        failedCount++;
        
        await db.execute(
          `UPDATE chapter_translation 
           SET status = 'failed', error_message = ? 
           WHERE id = ?`,
          [error.message.substring(0, 1000), chapter.id]
        );
      }
    }
    
    log(`[Workflow][translateBodies] 完成：成功 ${completedCount}，失败 ${failedCount}`);
    
  } catch (error) {
    log(`[Workflow][translateBodies] 错误:`, error.message);
    throw error;
  } finally {
    await db.end();
  }
}

/**
 * 节点 5：质量检查
 */
async function qualityCheckNode(taskId) {
  const { log } = getWorkflowContext();
  const db = await mysql.createConnection(dbConfig);
  
  try {
    log(`[Workflow][qualityCheck] 开始质量检查任务 ${taskId}`);
    
    // 获取所有待检查的章节（status 为 body_translated）
    const [chapters] = await db.execute(
      `SELECT id, chapter_number, title, content 
       FROM chapter_translation 
       WHERE task_id = ? AND status = 'body_translated'
       ORDER BY chapter_number ASC`,
      [taskId]
    );
    
    if (chapters.length === 0) {
      log(`[Workflow][qualityCheck] 任务 ${taskId} 没有待检查的章节`);
      return;
    }
    
    log(`[Workflow][qualityCheck] 找到 ${chapters.length} 个待检查章节`);
    
    let passCount = 0;
    let failCount = 0;
    
    for (const chapter of chapters) {
      const issues = [];
      
      // 检查 1：内容是否为空
      if (!chapter.content || chapter.content.trim().length === 0) {
        issues.push('content_empty');
      }
      
      // 检查 2：内容是否过短（少于 50 字符）
      if (chapter.content && chapter.content.trim().length < 50) {
        issues.push('content_too_short');
      }
      
      // 检查 3：内容是否包含大量中文（可能是翻译失败）
      if (chapter.content) {
        const chineseCharCount = (chapter.content.match(/[\u4e00-\u9fa5]/g) || []).length;
        const totalCharCount = chapter.content.length;
        if (totalCharCount > 0 && chineseCharCount / totalCharCount > 0.3) {
          issues.push('too_many_chinese_chars');
        }
      }
      
      // 检查 4：标题是否为空
      if (!chapter.title || chapter.title.trim().length === 0) {
        issues.push('title_empty');
      }
      
      const qaStatus = issues.length > 0 ? 'fail' : 'pass';
      const status = issues.length > 0 ? 'qa_failed' : 'ready_to_import';
      const errorMessage = issues.length > 0 ? `QA failed: ${issues.join(', ')}` : null;
      
      await db.execute(
        `UPDATE chapter_translation 
         SET qa_status = ?, status = ?, error_message = ?, last_step = 'qa_check' 
         WHERE id = ?`,
        [qaStatus, status, errorMessage, chapter.id]
      );
      
      if (qaStatus === 'pass') {
        passCount++;
      } else {
        failCount++;
        log(`[Workflow][qualityCheck] 章节 ${chapter.chapter_number} QA 失败: ${issues.join(', ')}`);
      }
    }
    
    log(`[Workflow][qualityCheck] 完成：通过 ${passCount}，失败 ${failCount}`);
    
  } catch (error) {
    log(`[Workflow][qualityCheck] 错误:`, error.message);
    throw error;
  } finally {
    await db.end();
  }
}

/**
 * 节点 6：导入章节
 */
async function importChaptersNode(taskId) {
  const { log } = getWorkflowContext();
  const db = await mysql.createConnection(dbConfig);
  
  try {
    log(`[Workflow][importChapters] 开始导入任务 ${taskId} 的章节`);
    
    const task = await getTranslationTask(taskId);
    
    // 获取导入配置
    let importConfig;
    try {
      importConfig = buildChapterImportConfig({ novelId: task.novel_id });
    } catch (error) {
      log(`[Workflow][importChapters] 构建导入配置失败:`, error.message);
      throw new Error('Import config is required');
    }
    
    // 获取所有待导入的章节（status 为 ready_to_import）
    const [chapters] = await db.execute(
      `SELECT ct.*, nic.raw_title, nic.raw_content
       FROM chapter_translation ct
       LEFT JOIN translation_task tt ON ct.task_id = tt.id
       LEFT JOIN novel_import_batch nib ON tt.novel_id = nib.novel_id 
         AND tt.created_by_admin_id = nib.created_by_admin_id
       LEFT JOIN novel_import_chapter nic ON nib.id = nic.batch_id 
         AND ct.chapter_number = nic.chapter_number
       WHERE ct.task_id = ? AND ct.status = 'ready_to_import'
       ORDER BY ct.chapter_number ASC`,
      [taskId]
    );
    
    if (chapters.length === 0) {
      log(`[Workflow][importChapters] 任务 ${taskId} 没有待导入的章节`);
      return;
    }
    
    log(`[Workflow][importChapters] 找到 ${chapters.length} 个待导入章节`);
    
    // 获取所有章节以计算索引
    const [allChapters] = await db.execute(
      `SELECT id FROM chapter_translation 
       WHERE task_id = ? AND status != 'failed'
       ORDER BY chapter_number ASC`,
      [taskId]
    );
    
    let importedCount = 0;
    let skippedCount = 0;
    const now = new Date();
    
    for (const chapter of chapters) {
      try {
        // 检查章节是否已存在
        const [existing] = await db.execute(
          'SELECT id FROM chapter WHERE novel_id = ? AND chapter_number = ?',
          [task.novel_id, chapter.chapter_number]
        );
        
        if (existing.length > 0) {
          log(`[Workflow][importChapters] 章节 ${chapter.chapter_number} 已存在，跳过`);
          await db.execute(
            `UPDATE chapter_translation SET status = 'skipped', last_step = 'import' WHERE id = ?`,
            [chapter.id]
          );
          skippedCount++;
          continue;
        }
        
        // 计算字数
        const wordCount = (chapter.content || '').replace(/\s/g, '').length;
        
        // 构建 draft
        const draft = {
          chapterNumber: chapter.chapter_number,
          title: chapter.title || '',
          content: chapter.content || '',
          wordCount: wordCount,
        };
        
        // 计算在批次中的索引
        const indexInBatch = allChapters.findIndex(c => c.id === chapter.id);
        
        // 构建章节行数据
        const chapterRow = await buildChapterRowFromDraft(draft, importConfig, indexInBatch, now);
        
        // 确保 volume 存在
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
        
        // 插入章节
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
        
        // 更新 chapter_translation
        await db.execute(
          `UPDATE chapter_translation 
           SET chapter_id = ?, status = 'imported', last_step = 'import' 
           WHERE id = ?`,
          [chapterId, chapter.id]
        );
        
        importedCount++;
        log(`[Workflow][importChapters] 章节 ${chapter.chapter_number} 导入成功 (chapter_id: ${chapterId})`);
        
      } catch (error) {
        log(`[Workflow][importChapters] 章节 ${chapter.chapter_number} 导入失败:`, error.message);
        
        await db.execute(
          `UPDATE chapter_translation 
           SET status = 'failed', error_message = ? 
           WHERE id = ?`,
          [error.message.substring(0, 1000), chapter.id]
        );
      }
    }
    
    log(`[Workflow][importChapters] 完成：导入 ${importedCount}，跳过 ${skippedCount}`);
    
  } catch (error) {
    log(`[Workflow][importChapters] 错误:`, error.message);
    throw error;
  } finally {
    await db.end();
  }
}

/**
 * Workflow 总控制器
 */
async function runNovelTranslationWorkflow(taskId, options = {}) {
  const { log, error } = getWorkflowContext();
  
  try {
    const task = await getTranslationTask(taskId);
    
    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }
    
    if (task.status === 'paused') {
      log(`任务 ${taskId} 处于暂停状态，终止执行`);
      return;
    }
    
    if (task.status === 'completed') {
      log(`任务 ${taskId} 已完成，无需再次执行`);
      return;
    }
    
    // 更新任务状态为 running
    await updateTaskStatus(taskId, { status: 'running', currentStep: task.current_step || 'segmenting' });
    
    log(`开始执行 Workflow，task=${taskId}, current_step=${task.current_step || 'segmenting'}`);
    
    const currentStep = task.current_step || 'segmenting';
    
    try {
      switch (currentStep) {
        case 'segmenting':
          await segmentChaptersNode(taskId);
          await updateTaskStep(taskId, 'analyzing_titles');
          // fallthrough
          
        case 'analyzing_titles':
          await analyzeTitleRulesNode(taskId);
          await updateTaskStep(taskId, 'translating_titles');
          // fallthrough
          
        case 'translating_titles':
          await translateTitlesNode(taskId);
          await updateTaskStep(taskId, 'translating_bodies');
          // fallthrough
          
        case 'translating_bodies':
          await translateBodiesNode(taskId);
          await updateTaskStep(taskId, 'quality_checking');
          // fallthrough
          
        case 'quality_checking':
          await qualityCheckNode(taskId);
          await updateTaskStep(taskId, 'importing');
          // fallthrough
          
        case 'importing':
          await importChaptersNode(taskId);
          await updateTaskStatus(taskId, { status: 'completed', currentStep: 'done' });
          log(`[Workflow] 任务 ${taskId} 全部完成`);
          break;
          
        default:
          log(`未知 current_step=${currentStep}，不执行任何操作`);
      }
    } catch (workflowError) {
      error(`[Workflow] 任务 ${taskId} 执行失败:`, workflowError.message);
      await updateTaskStatus(taskId, {
        status: 'failed',
        currentStep: currentStep,
        errorMessage: workflowError.message,
      });
      throw workflowError;
    }
    
  } catch (err) {
    error(`[Workflow] runNovelTranslationWorkflow 错误:`, err.message);
    throw err;
  }
}

module.exports = {
  runNovelTranslationWorkflow,
  segmentChaptersNode,
  analyzeTitleRulesNode,
  translateTitlesNode,
  translateBodiesNode,
  qualityCheckNode,
  importChaptersNode,
};

