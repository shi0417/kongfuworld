/**
 * Admin AI 批量翻译导入路由
 */

const express = require('express');
const mysql = require('mysql2/promise');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const fs = require('fs').promises;
const path = require('path');
const router = express.Router();

const translationTaskService = require('../ai/translationTaskService');
const novelImportService = require('../services/novelImportService');

// 配置 multer 用于文件上传（内存存储）
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['.txt', '.md', '.docx'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('不支持的文件类型，仅支持 .txt, .md, .docx'));
    }
  },
});

// 数据库配置
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '123456',
  database: process.env.DB_NAME || 'kongfuworld',
  charset: 'utf8mb4'
};

// JWT验证中间件（管理员）
const authenticateAdmin = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ success: false, message: '请先登录' });
  }

  try {
    const decoded = jwt.verify(token, 'admin-secret-key');
    
    // 从数据库获取最新的admin信息
    const db = await mysql.createConnection(dbConfig);
    const [admins] = await db.execute(
      'SELECT id, name, level, role, status FROM admin WHERE id = ?',
      [decoded.adminId]
    );
    await db.end();
    
    if (admins.length === 0) {
      return res.status(403).json({ success: false, message: '管理员不存在' });
    }
    
    const admin = admins[0];
    
    // 检查账号状态
    if (admin.status === 0) {
      return res.status(403).json({ success: false, message: '账号已被禁用' });
    }
    
    req.admin = {
      ...decoded,
      adminId: decoded.adminId,
      role: admin.role || 'editor',
      status: admin.status
    };
    next();
  } catch (err) {
    return res.status(403).json({ success: false, message: 'Token无效或已过期' });
  }
};

/**
 * POST /api/admin/ai-translation/start-from-text
 * 从文本开始翻译任务
 */
router.post('/start-from-text', authenticateAdmin, async (req, res) => {
  try {
    const { novelId, sourceText, importConfig } = req.body;
    const adminId = req.admin.adminId;

    // 验证参数
    if (!novelId || !sourceText) {
      return res.status(400).json({
        success: false,
        message: 'novelId and sourceText are required'
      });
    }

    // 验证小说是否存在
    const db = await mysql.createConnection(dbConfig);
    const [novels] = await db.execute('SELECT id FROM novel WHERE id = ?', [novelId]);
    await db.end();

    if (novels.length === 0) {
      return res.status(404).json({
        success: false,
        message: `Novel with ID ${novelId} not found`
      });
    }

    // 创建翻译任务（包含 importConfig）
    const { taskId, totalChapters, importConfig: finalImportConfig } = await translationTaskService.createTranslationTaskFromText({
      novelId: parseInt(novelId),
      sourceText: sourceText.trim(),
      adminId: adminId,
      targetLanguage: 'en',
      sourceLanguage: 'zh',
      importConfig: importConfig, // 传入导入配置
    });

    // 获取初始任务详情
    const taskDetails = await translationTaskService.getTaskDetails(taskId);

    // 异步执行翻译任务（避免请求超时）
    // 注意：这里使用 setTimeout 来异步执行，实际生产环境建议使用任务队列
    setImmediate(async () => {
      try {
        await translationTaskService.runTranslationTask(taskId, finalImportConfig);
        console.log(`[AdminAITranslation] Task ${taskId} completed`);
      } catch (error) {
        console.error(`[AdminAITranslation] Task ${taskId} failed:`, error);
      }
    });

    res.json({
      success: true,
      data: {
        taskId,
        task: taskDetails.task,
        chapters: taskDetails.chapters,
        totalChapters,
        importConfig: finalImportConfig, // 返回使用的配置
      }
    });

  } catch (error) {
    console.error('[AdminAITranslation] Error starting translation task:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to start translation task'
    });
  }
});

/**
 * GET /api/admin/ai-translation/task/:taskId
 * 获取任务详情和进度
 */
router.get('/task/:taskId', authenticateAdmin, async (req, res) => {
  try {
    const { taskId } = req.params;

    if (!taskId) {
      return res.status(400).json({
        success: false,
        message: 'taskId is required'
      });
    }

    const taskDetails = await translationTaskService.getTaskDetails(parseInt(taskId));

    res.json({
      success: true,
      data: {
        task: taskDetails.task,
        chapters: taskDetails.chapters,
      }
    });

  } catch (error) {
    console.error('[AdminAITranslation] Error getting task details:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to get task details'
    });
  }
});

/**
 * POST /api/admin/ai-translation/upload-source-file
 * 从文件上传开始翻译任务
 */
router.post('/upload-source-file', authenticateAdmin, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: '请上传文件'
      });
    }

    const { novelId, importConfig: importConfigStr } = req.body;
    const adminId = req.admin.adminId;

    // 验证参数
    if (!novelId) {
      return res.status(400).json({
        success: false,
        message: 'novelId is required'
      });
    }

    // 验证小说是否存在
    const db = await mysql.createConnection(dbConfig);
    const [novels] = await db.execute('SELECT id FROM novel WHERE id = ?', [novelId]);
    await db.end();

    if (novels.length === 0) {
      return res.status(404).json({
        success: false,
        message: `Novel with ID ${novelId} not found`
      });
    }

    // 解析 importConfig
    let importConfig = null;
    if (importConfigStr) {
      try {
        importConfig = JSON.parse(importConfigStr);
      } catch (e) {
        console.warn('[AdminAITranslation] Failed to parse importConfig:', e);
      }
    }

    // 读取文件内容
    let sourceText = '';
    const fileExt = path.extname(req.file.originalname).toLowerCase();

    if (fileExt === '.txt' || fileExt === '.md') {
      // 文本文件直接读取
      sourceText = req.file.buffer.toString('utf8');
    } else if (fileExt === '.docx') {
      // DOCX 文件使用 mammoth 解析
      try {
        const mammoth = require('mammoth');
        const result = await mammoth.extractRawText({ buffer: req.file.buffer });
        sourceText = result.value;
      } catch (error) {
        console.error('[AdminAITranslation] Error parsing DOCX:', error);
        return res.status(400).json({
          success: false,
          message: 'DOCX 文件解析失败: ' + error.message + '，请使用 .txt 或 .md 格式'
        });
      }
    }

    if (!sourceText || !sourceText.trim()) {
      return res.status(400).json({
        success: false,
        message: '文件内容为空'
      });
    }

    // 创建翻译任务（包含 importConfig）
    const { taskId, totalChapters, importConfig: finalImportConfig } = await translationTaskService.createTranslationTaskFromText({
      novelId: parseInt(novelId),
      sourceText: sourceText.trim(),
      adminId: adminId,
      targetLanguage: 'en',
      sourceLanguage: 'zh',
      importConfig: importConfig,
    });

    // 获取初始任务详情
    const taskDetails = await translationTaskService.getTaskDetails(taskId);

    // 异步执行翻译任务（避免请求超时）
    setImmediate(async () => {
      try {
        await translationTaskService.runTranslationTask(taskId, finalImportConfig);
        console.log(`[AdminAITranslation] Task ${taskId} completed`);
      } catch (error) {
        console.error(`[AdminAITranslation] Task ${taskId} failed:`, error);
      }
    });

    res.json({
      success: true,
      data: {
        taskId,
        task: taskDetails.task,
        chapters: taskDetails.chapters,
        totalChapters,
        importConfig: finalImportConfig,
      }
    });

  } catch (error) {
    console.error('[AdminAITranslation] Error uploading file:', error);
    res.status(500).json({
      success: false,
      message: error.message || '文件上传失败'
    });
  }
});

/**
 * ============================================
 * 新的导入预览接口（LangChain 流程）
 * ============================================
 * 注意：原有的 /start-from-text 和 /upload-source-file 接口保留不变
 * 未来推荐使用新的 /preview-import-* + /import-batch/* 流程
 */

/**
 * POST /api/admin/ai-translation/preview-import-from-text
 * 从文本预览导入（不立即翻译）
 */
router.post('/preview-import-from-text', authenticateAdmin, async (req, res) => {
  try {
    const { novelId, sourceText, importConfig } = req.body;
    const adminId = req.admin.adminId;

    // 验证参数
    if (!novelId || !sourceText) {
      return res.status(400).json({
        success: false,
        message: 'novelId and sourceText are required'
      });
    }

    // 验证小说是否存在
    const db = await mysql.createConnection(dbConfig);
    const [novels] = await db.execute('SELECT id FROM novel WHERE id = ?', [novelId]);
    await db.end();

    if (novels.length === 0) {
      return res.status(404).json({
        success: false,
        message: `Novel with ID ${novelId} not found`
      });
    }

    // 创建导入批次和章节草稿
    const result = await novelImportService.createImportBatchFromText({
      novelId: parseInt(novelId),
      sourceText: sourceText.trim(),
      adminId: adminId,
      importConfig: importConfig,
    });

    res.json({
      success: true,
      data: {
        batch: result.batch,
        chapters: result.chapters,
      }
    });

  } catch (error) {
    console.error('[AdminAITranslation] Error previewing import from text:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to preview import'
    });
  }
});

/**
 * POST /api/admin/ai-translation/preview-import-from-file
 * 从文件预览导入（不立即翻译）
 */
router.post('/preview-import-from-file', authenticateAdmin, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: '请上传文件'
      });
    }

    const { novelId, importConfig: importConfigStr } = req.body;
    const adminId = req.admin.adminId;

    // 验证参数
    if (!novelId) {
      return res.status(400).json({
        success: false,
        message: 'novelId is required'
      });
    }

    // 验证小说是否存在
    const db = await mysql.createConnection(dbConfig);
    const [novels] = await db.execute('SELECT id FROM novel WHERE id = ?', [novelId]);
    await db.end();

    if (novels.length === 0) {
      return res.status(404).json({
        success: false,
        message: `Novel with ID ${novelId} not found`
      });
    }

    // 解析 importConfig
    let importConfig = null;
    if (importConfigStr) {
      try {
        importConfig = JSON.parse(importConfigStr);
      } catch (e) {
        console.warn('[AdminAITranslation] Failed to parse importConfig:', e);
      }
    }

    // 读取文件内容
    let sourceText = '';
    const fileExt = path.extname(req.file.originalname).toLowerCase();

    if (fileExt === '.txt' || fileExt === '.md') {
      // 文本文件直接读取
      sourceText = req.file.buffer.toString('utf8');
    } else if (fileExt === '.docx') {
      // DOCX 文件使用 mammoth 解析
      try {
        const mammoth = require('mammoth');
        const result = await mammoth.extractRawText({ buffer: req.file.buffer });
        sourceText = result.value;
      } catch (error) {
        console.error('[AdminAITranslation] Error parsing DOCX:', error);
        return res.status(400).json({
          success: false,
          message: 'DOCX 文件解析失败: ' + error.message + '，请使用 .txt 或 .md 格式'
        });
      }
    }

    if (!sourceText || !sourceText.trim()) {
      return res.status(400).json({
        success: false,
        message: '文件内容为空'
      });
    }

    // 创建导入批次和章节草稿
    const result = await novelImportService.createImportBatchFromText({
      novelId: parseInt(novelId),
      sourceText: sourceText.trim(),
      adminId: adminId,
      importConfig: importConfig,
      sourceFileName: req.file.originalname,
    });

    res.json({
      success: true,
      data: {
        batch: result.batch,
        chapters: result.chapters,
      }
    });

  } catch (error) {
    console.error('[AdminAITranslation] Error previewing import from file:', error);
    res.status(500).json({
      success: false,
      message: error.message || '文件预览失败'
    });
  }
});

/**
 * GET /api/admin/ai-translation/import-batch/:batchId
 * 获取导入批次详情
 */
router.get('/import-batch/:batchId', authenticateAdmin, async (req, res) => {
  try {
    const { batchId } = req.params;

    if (!batchId) {
      return res.status(400).json({
        success: false,
        message: 'batchId is required'
      });
    }

    const result = await novelImportService.getImportBatchDetails(parseInt(batchId));

    res.json({
      success: true,
      data: {
        batch: result.batch,
        chapters: result.chapters,
      }
    });

  } catch (error) {
    console.error('[AdminAITranslation] Error getting import batch details:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to get import batch details'
    });
  }
});

/**
 * POST /api/admin/ai-translation/import-batch/:batchId/update
 * 更新导入章节信息
 */
router.post('/import-batch/:batchId/update', authenticateAdmin, async (req, res) => {
  try {
    const { batchId } = req.params;
    const { updates } = req.body;

    if (!batchId) {
      return res.status(400).json({
        success: false,
        message: 'batchId is required'
      });
    }

    if (!Array.isArray(updates)) {
      return res.status(400).json({
        success: false,
        message: 'updates must be an array'
      });
    }

    const chapters = await novelImportService.updateImportChapters(parseInt(batchId), updates);

    res.json({
      success: true,
      data: {
        chapters,
      }
    });

  } catch (error) {
    console.error('[AdminAITranslation] Error updating import chapters:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to update import chapters'
    });
  }
});

/**
 * POST /api/admin/ai-translation/import-batch/:batchId/confirm
 * 确认批次，标记为准备翻译
 */
router.post('/import-batch/:batchId/confirm', authenticateAdmin, async (req, res) => {
  try {
    const { batchId } = req.params;

    if (!batchId) {
      return res.status(400).json({
        success: false,
        message: 'batchId is required'
      });
    }

    await novelImportService.markBatchReadyForTranslation(parseInt(batchId));

    // 获取更新后的批次详情
    const result = await novelImportService.getImportBatchDetails(parseInt(batchId));

    res.json({
      success: true,
      data: {
        batch: result.batch,
        chapters: result.chapters,
      }
    });

  } catch (error) {
    console.error('[AdminAITranslation] Error confirming import batch:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to confirm import batch'
    });
  }
});

/**
 * POST /api/admin/ai-translation/import-batch/:batchId/start-translation
 * 启动翻译任务（基于导入批次）
 * 注意：这个接口会在后续步骤中实现，目前先预留
 */
router.post('/import-batch/:batchId/start-translation', authenticateAdmin, async (req, res) => {
  try {
    const { batchId } = req.params;

    if (!batchId) {
      return res.status(400).json({
        success: false,
        message: 'batchId is required'
      });
    }

    // 1. 确认批次（如果还未确认）
    const batchDetails = await novelImportService.getImportBatchDetails(parseInt(batchId));
    if (batchDetails.batch.status === 'draft') {
      await novelImportService.markBatchReadyForTranslation(parseInt(batchId));
    }

    // 2. 创建翻译任务
    const { taskId, totalChapters } = await translationTaskService.createTranslationTaskFromImportBatch({
      batchId: parseInt(batchId),
      adminId: req.admin.adminId,
    });

    // 3. 获取初始任务详情
    const taskDetails = await translationTaskService.getTaskDetails(taskId);

    // 4. 异步执行翻译任务（使用新的 LangChain 流水线）
    setImmediate(async () => {
      try {
        // 构建导入配置
        const { buildChapterImportConfig } = require('../services/aiChapterImportConfig');
        const importConfig = buildChapterImportConfig({ novelId: batchDetails.batch.novel_id });
        
        await translationTaskService.runTranslationTaskFromImportBatch(taskId, importConfig);
        console.log(`[AdminAITranslation] Task ${taskId} completed`);
      } catch (error) {
        console.error(`[AdminAITranslation] Task ${taskId} failed:`, error);
      }
    });

    res.json({
      success: true,
      data: {
        taskId,
        task: taskDetails.task,
        chapters: taskDetails.chapters,
        totalChapters,
      }
    });

  } catch (error) {
    console.error('[AdminAITranslation] Error starting translation from batch:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to start translation'
    });
  }
});

module.exports = router;

