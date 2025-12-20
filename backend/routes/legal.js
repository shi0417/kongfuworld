const express = require('express');
const mysql = require('mysql2/promise');
const router = express.Router();

// 数据库配置
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '123456',
  database: process.env.DB_NAME || 'kongfuworld',
  charset: 'utf8mb4'
};

// docKey 映射：前台短名称 -> 数据库 doc_key
const DOC_KEY_MAP = {
  'terms': 'terms_of_service',
  'privacy': 'privacy_policy',
  'cookies': 'cookie_policy',
  'cookie': 'cookie_policy',
  'contract-policy': 'writer_contract_policy',
  'contract_policy': 'writer_contract_policy',
  // 也支持直接传完整名称
  'terms_of_service': 'terms_of_service',
  'privacy_policy': 'privacy_policy',
  'cookie_policy': 'cookie_policy',
  'writer_contract_policy': 'writer_contract_policy'
};

// GET /api/legal/:docKey?lang=en
router.get('/:docKey', async (req, res) => {
  let db;
  try {
    const { docKey } = req.params;
    const lang = req.query.lang || 'en';
    
    // 映射 docKey
    const mappedDocKey = DOC_KEY_MAP[docKey];
    if (!mappedDocKey) {
      return res.status(404).json({ 
        success: false, 
        message: '文档类型不存在' 
      });
    }
    
    db = await mysql.createConnection(dbConfig);
    
    // 查询：status='published' AND is_current=1
    // 先尝试请求的语言，如果不存在则回退到英文版
    let [rows] = await db.execute(
      `
        SELECT 
          title, content_md, version, effective_at, updated_at
        FROM site_legal_documents
        WHERE doc_key = ? AND language = ? AND status = 'published' AND is_current = 1
        LIMIT 1
      `,
      [mappedDocKey, lang]
    );
    
    // 如果请求的语言不存在，且不是英文，则回退到英文版
    if (rows.length === 0 && lang !== 'en') {
      [rows] = await db.execute(
        `
          SELECT 
            title, content_md, version, effective_at, updated_at
          FROM site_legal_documents
          WHERE doc_key = ? AND language = 'en' AND status = 'published' AND is_current = 1
          LIMIT 1
        `,
        [mappedDocKey]
      );
    }
    
    if (rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: '文档未发布或未配置' 
      });
    }
    
    res.json({ success: true, data: rows[0] });
  } catch (error) {
    console.error('获取政策文档失败:', error);
    res.status(500).json({ 
      success: false, 
      message: '获取政策文档失败', 
      error: error.message 
    });
  } finally {
    if (db) await db.end();
  }
});

module.exports = router;

