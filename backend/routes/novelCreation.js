const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const router = express.Router();
const authorDailyWordCountService = require('../services/authorDailyWordCountService');

// 数据库配置：已迁移到 backend/db/index.js 的 pool（Db.query / Db.getPool）
// 目的：避免模块级单连接在断连后被复用，导致 EPIPE/closed state 错误
const Db = require('../db');
const pool = Db.getPool();

// Multer配置用于封面图片上传
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../avatars');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'cover-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage, 
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

// 计算章节价格（按字数计价）
function calculateChapterPrice(chapterNumber, wordCount, config) {
  const { karma_per_1000, min_karma, max_karma, default_free_chapters } = config;
  
  // 1. 前N章免费
  if (chapterNumber <= default_free_chapters) {
    return 0;
  }
  
  // 2. 没字数时默认用min_karma
  if (!wordCount || wordCount <= 0) {
    return min_karma;
  }
  
  // 3. 按字数计算基础价：向上取整
  let basePrice = Math.ceil((wordCount / 1000) * karma_per_1000);
  
  // 4. 限制在 [min_karma, max_karma] 区间
  if (basePrice < min_karma) basePrice = min_karma;
  if (basePrice > max_karma) basePrice = max_karma;
  
  return basePrice;
}

// 获取所有类型/genre
router.get('/genre/all', async (req, res) => {
  const query = 'SELECT id, name, chinese_name, slug FROM genre WHERE is_active = 1 ORDER BY name';
  
  try {
    const [results] = await Db.query(query, [], { tag: 'novelCreation.genre.all', idempotent: true });
    res.json(results);
  } catch (err) {
    console.error('获取类型失败:', { code: err && err.code, fatal: !!(err && err.fatal) });
    return res.status(500).json({ message: 'Failed to fetch genres' });
  }
});

// 获取所有语言
router.get('/languages/all', async (req, res) => {
  const query = 'SELECT id, language FROM languages ORDER BY language';
  
  try {
    const [results] = await Db.query(query, [], { tag: 'novelCreation.languages.all', idempotent: true });
    res.json(results);
  } catch (err) {
    console.error('获取语言失败:', { code: err && err.code, fatal: !!(err && err.fatal) });
    return res.status(500).json({ message: 'Failed to fetch languages' });
  }
});

// 创建新语言
router.post('/languages/create', async (req, res) => {
  const { language } = req.body;
  
  if (!language || !language.trim()) {
    return res.status(400).json({ message: 'Language name is required' });
  }
  
  const query = 'INSERT INTO languages (language) VALUES (?)';
  
  try {
    const [result] = await Db.query(query, [language.trim()], { tag: 'novelCreation.languages.create', idempotent: false });
    res.json({ id: result.insertId, language: language.trim() });
  } catch (err) {
    if (err && err.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ message: 'Language already exists' });
    }
    console.error('创建语言失败:', { code: err && err.code, fatal: !!(err && err.fatal) });
    return res.status(500).json({ message: 'Failed to create language' });
  }
});

// 创建小说
router.post('/novel/create', upload.single('cover'), async (req, res) => {
  const { 
    title, 
    description, 
    recommendation, 
    status, 
    language, 
    user_id,
    genre_id_1,
    genre_id_2
  } = req.body;
  
  // 验证必填字段
  if (!title || !title.trim()) {
    return res.status(400).json({ message: 'Title is required' });
  }
  
  if (!user_id) {
    return res.status(400).json({ message: 'User ID is required' });
  }
  
  if (!genre_id_1) {
    return res.status(400).json({ message: 'At least one genre is required' });
  }
  
  // 验证状态
  const validStatuses = ['ongoing', 'completed', 'hiatus'];
  if (status && !validStatuses.includes(status)) {
    return res.status(400).json({ message: 'Invalid status' });
  }
  
  // 构建封面URL
  let coverUrl = null;
  if (req.file) {
    coverUrl = `/covers/${req.file.filename}`;
  }
  
  const pool = Db.getPool();
  let conn = null;
  
  try {
    // 处理语言字段：如果languages表中没有该语言，先创建
    let processedLanguage = null;
    if (language && language.trim()) {
      const langName = language.trim();
      console.log('处理语言字段:', langName);
      
      try {
        const [langResults] = await Db.query('SELECT id FROM languages WHERE language = ?', [langName], { tag: 'novelCreation.language.check', idempotent: true });
        
        if (langResults.length > 0) {
          console.log('语言已存在:', langName);
          processedLanguage = langName;
        } else {
          try {
            await Db.query('INSERT INTO languages (language) VALUES (?)', [langName], { tag: 'novelCreation.language.create', idempotent: false });
            console.log('创建新语言:', langName);
            processedLanguage = langName;
          } catch (insertErr) {
            if (insertErr.code === 'ER_DUP_ENTRY') {
              // 并发情况下可能已创建，重新查询
              const [recheckResults] = await Db.query('SELECT id FROM languages WHERE language = ?', [langName], { tag: 'novelCreation.language.recheck', idempotent: true });
              processedLanguage = langName;
            } else {
              throw insertErr;
            }
          }
        }
      } catch (langErr) {
        console.error('处理语言失败:', langErr);
        return res.status(500).json({ message: 'Failed to process language' });
      }
    } else {
      console.log('语言字段为空，将保存为null');
    }
    
    // 获取连接并开始事务
    conn = await pool.getConnection();
    await conn.beginTransaction();
    
    console.log('处理后的语言值:', processedLanguage);
    
    // 1. 插入小说基本信息
    const novelQuery = `
      INSERT INTO novel (
        title, 
        description, 
        recommendation, 
        languages, 
        status, 
        cover, 
        user_id,
        chapters,
        rating,
        reviews,
        review_status,
        licensed_from
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0, 0, ?, ?)
    `;
    
    const novelValues = [
      title.trim(),
      description ? description.trim() : null,
      recommendation ? recommendation.trim() : null,
      processedLanguage || null, // languages字段
      status || 'ongoing',
      coverUrl,
      parseInt(user_id),
      'created', // review_status 默认状态（新建小说为草稿状态）
      'KongFuWorld' // licensed_from 固定值
    ];
    
    console.log('准备插入小说，languages字段值:', processedLanguage || null);
    const [novelResult] = await conn.execute(novelQuery, novelValues);
    
    const novelId = novelResult.insertId;
    console.log('小说创建成功，ID:', novelId, 'languages字段已保存为:', processedLanguage || null);
    
    // 2. 插入类型关联
    const genrePromises = [];
    
    if (genre_id_1) {
      genrePromises.push(
        conn.execute('INSERT INTO novel_genre_relation (novel_id, genre_id_1) VALUES (?, ?)', [novelId, parseInt(genre_id_1)])
      );
    }
    
    // 更新 genre_id_2（如果提供了第二个类型）
    if (genre_id_2) {
      const [checkResults] = await conn.execute('SELECT id FROM novel_genre_relation WHERE novel_id = ?', [novelId]);
      
      if (checkResults.length > 0) {
        // 更新已有记录
        genrePromises.push(
          conn.execute('UPDATE novel_genre_relation SET genre_id_2 = ? WHERE novel_id = ?', [parseInt(genre_id_2), novelId])
        );
      } else {
        // 如果没有记录（不应该发生），创建一个新的
        genrePromises.push(
          conn.execute('INSERT INTO novel_genre_relation (novel_id, genre_id_1, genre_id_2) VALUES (?, ?, ?)', [novelId, parseInt(genre_id_1), parseInt(genre_id_2)])
        );
      }
    }
    
    // 3. 插入主角名
    const protagonistPromises = [];
    const protagonistKeys = Object.keys(req.body).filter(key => key.startsWith('protagonist_'));
    
    for (const key of protagonistKeys) {
      const name = req.body[key];
      if (name && name.trim()) {
        protagonistPromises.push(
          conn.execute('INSERT INTO protagonist (novel_id, name) VALUES (?, ?)', [novelId, name.trim()])
        );
      }
    }
    
    // 执行所有插入操作
    await Promise.all([...genrePromises, ...protagonistPromises]);
    
    // 提交事务
    await conn.commit();
    
    // 事务提交成功后，查询并创建unlockprice记录（如果不存在）
    try {
      const [unlockResults] = await Db.query(
        'SELECT id FROM unlockprice WHERE novel_id = ? AND user_id = ?',
        [novelId, parseInt(user_id)],
        { tag: 'novelCreation.unlockprice.check', idempotent: true }
      );
      
      // 使用 INSERT ... ON DUPLICATE KEY UPDATE 确保唯一性
      await Db.query(
        `INSERT INTO unlockprice 
         (user_id, novel_id, karma_per_1000, min_karma, max_karma, default_free_chapters, pricing_style, created_at, updated_at)
         VALUES (?, ?, 6, 5, 30, 50, 'per_word', NOW(), NOW())
         ON DUPLICATE KEY UPDATE updated_at = NOW()`,
        [parseInt(user_id), novelId],
        { tag: 'novelCreation.unlockprice.create', idempotent: false }
      );
      
      console.log('成功创建或更新unlockprice记录，novel_id:', novelId, 'user_id:', user_id);
    } catch (unlockErr) {
      console.error('创建unlockprice记录失败:', unlockErr);
      // 即使创建失败，也返回成功（不影响小说创建）
    }
    
    res.json({ 
      success: true, 
      id: novelId,
      data: { id: novelId },
      message: 'Novel created successfully'
    });
    
  } catch (err) {
    if (conn) {
      try {
        await conn.rollback();
      } catch (rollbackErr) {
        console.error('回滚事务失败:', rollbackErr);
      }
    }
    console.error('创建小说失败:', err);
    res.status(500).json({ message: err.message || 'Failed to create novel' });
  } finally {
    if (conn) {
      conn.release();
    }
  }
});

// 获取用户的小说列表（带统计信息）
router.get('/novels/user/:user_id', async (req, res) => {
  const { user_id } = req.params;
  console.log('获取用户小说列表，user_id:', user_id);
  
  const query = `
    SELECT 
      n.id,
      n.title,
      n.status,
      n.cover,
      n.chapters,
      n.rating,
      n.reviews,
      n.review_status,
      n.languages,
      -- 最新章节信息
      latest_chapter.id as latest_chapter_id,
      latest_chapter.title as latest_chapter_title,
      latest_chapter.chapter_number as latest_chapter_number,
      latest_chapter.created_at as latest_chapter_created_at,
      -- 本月更新字数统计（当前月份）
      COALESCE(monthly_stats.word_count, 0) as monthly_word_count,
      -- 已审核字数统计
      COALESCE(reviewed_stats.reviewed_word_count, 0) as reviewed_word_count
    FROM novel n
    -- 获取最新章节
    LEFT JOIN (
      SELECT 
        c1.novel_id,
        c1.id,
        c1.title,
        c1.chapter_number,
        c1.created_at,
        ROW_NUMBER() OVER (PARTITION BY c1.novel_id ORDER BY c1.id DESC) as rn
      FROM chapter c1
      WHERE c1.review_status = 'approved'
    ) latest_chapter ON n.id = latest_chapter.novel_id AND latest_chapter.rn = 1
    -- 本月更新字数统计
    LEFT JOIN (
      SELECT 
        c2.novel_id,
        SUM(COALESCE(c2.word_count, LENGTH(c2.content))) as word_count
      FROM chapter c2
      WHERE c2.novel_id IN (SELECT id FROM novel WHERE user_id = ?)
        AND YEAR(c2.created_at) = YEAR(CURRENT_DATE())
        AND MONTH(c2.created_at) = MONTH(CURRENT_DATE())
        AND c2.review_status = 'approved'
      GROUP BY c2.novel_id
    ) monthly_stats ON n.id = monthly_stats.novel_id
    -- 已审核字数统计（review_status = 'approved'）
    LEFT JOIN (
      SELECT 
        c3.novel_id,
        SUM(COALESCE(c3.word_count, LENGTH(c3.content))) as reviewed_word_count
      FROM chapter c3
      WHERE c3.novel_id IN (SELECT id FROM novel WHERE user_id = ?)
        AND c3.review_status = 'approved'
        AND c3.review_status = 'approved'
      GROUP BY c3.novel_id
    ) reviewed_stats ON n.id = reviewed_stats.novel_id
    WHERE n.user_id = ?
    ORDER BY n.id DESC
  `;
  
  try {
    const [results] = await Db.query(query, [parseInt(user_id), parseInt(user_id), parseInt(user_id)], { tag: 'novelCreation.novels.user', idempotent: true });
    
    console.log(`找到 ${results.length} 本小说`);
    
    // 处理封面URL - 返回相对路径，由前端使用 toAssetUrl 处理
    const novels = results.map(novel => ({
      ...novel,
      cover: novel.cover ? (novel.cover.startsWith('http') ? novel.cover : novel.cover.startsWith('/') ? novel.cover : `/${novel.cover}`) : null,
      monthly_word_count: parseInt(novel.monthly_word_count) || 0,
      reviewed_word_count: parseInt(novel.reviewed_word_count) || 0
    }));
    
    console.log('返回的小说列表:', novels.length, '本');
    
    res.json({
      success: true,
      data: novels,
      count: novels.length
    });
  } catch (err) {
    console.error('获取用户小说列表失败:', { code: err && err.code, fatal: !!(err && err.fatal) });
    return res.status(500).json({ 
      success: false,
      message: 'Failed to fetch user novels'
    });
  }
});

// 获取小说详细信息（包括标签、主角等）
router.get('/novel/:id', async (req, res) => {
  const { id } = req.params;
  
  const query = `
    SELECT 
      n.*,
      n.id as novel_id,
      n.user_id
    FROM novel n
    WHERE n.id = ?
  `;
  
  try {
    const [results] = await Db.query(query, [parseInt(id)], { tag: 'novelCreation.novel.id', idempotent: true });
    if (results.length === 0) {
      return res.status(404).json({ success: false, message: '小说不存在' });
    }
    res.json({ success: true, data: results[0] });
  } catch (err) {
    console.error('获取小说信息失败:', { code: err && err.code, fatal: !!(err && err.fatal) });
    return res.status(500).json({ success: false, message: '获取小说信息失败' });
  }
});

// 获取小说详细信息（包括标签、主角、类型等）
router.get('/novel/:id/detail', async (req, res) => {
  const { id } = req.params;
  
  const query = `
    SELECT 
      n.*,
      GROUP_CONCAT(DISTINCT g.id ORDER BY g.id) as genre_ids,
      GROUP_CONCAT(DISTINCT g.name ORDER BY g.id SEPARATOR ',') as genre_names,
      GROUP_CONCAT(DISTINCT g.chinese_name ORDER BY g.id SEPARATOR ',') as genre_chinese_names
    FROM novel n
    LEFT JOIN novel_genre_relation ngr ON n.id = ngr.novel_id
    LEFT JOIN genre g ON (ngr.genre_id_1 = g.id OR ngr.genre_id_2 = g.id)
    WHERE n.id = ?
    GROUP BY n.id
  `;
  
  try {
    const [results] = await Db.query(query, [parseInt(id)], { tag: 'novelCreation.novel.detail', idempotent: true });
    if (results.length === 0) {
      return res.status(404).json({ success: false, message: '小说不存在' });
    }
    const novel = results[0];
    
    // 获取标签信息
    const genres = [];
    if (novel.genre_ids) {
      const genreIds = novel.genre_ids.split(',').filter(id => id && id !== 'null');
      const genreNames = novel.genre_names.split(',').filter(name => name);
      const genreChineseNames = novel.genre_chinese_names.split(',').filter(name => name);
      
      genreIds.forEach((genreId, index) => {
        if (genreId && genreNames[index] && genreChineseNames[index]) {
          genres.push({
            id: parseInt(genreId),
            name: genreNames[index],
            chinese_name: genreChineseNames[index]
          });
        }
      });
    }
    
    // 查询主角信息
    const protagonistQuery = 'SELECT id, name FROM protagonist WHERE novel_id = ? ORDER BY created_at ASC';
    let protagonistResults = [];
    try {
      const [protagonistRows] = await Db.query(protagonistQuery, [parseInt(id)], { tag: 'novelCreation.novel.detail.protagonist', idempotent: true });
      protagonistResults = protagonistRows;
    } catch (protagonistErr) {
      console.error('查询主角信息失败:', { code: protagonistErr && protagonistErr.code, fatal: !!(protagonistErr && protagonistErr.fatal) });
      // 即使查询主角失败，也返回其他数据
    }
    
    const protagonistNames = protagonistResults.map((p) => p.name);
    
    res.json({
      success: true,
      data: {
        ...novel,
        genres,
        protagonists: protagonistNames
      }
    });
  } catch (err) {
    console.error('获取小说详细信息失败:', { code: err && err.code, fatal: !!(err && err.fatal) });
    return res.status(500).json({ success: false, message: '获取小说详细信息失败' });
  }
});

// 更新小说信息
router.post('/novel/update', upload.single('cover'), async (req, res) => {
  const { 
    novel_id,
    title, 
    description, 
    recommendation, 
    status, 
    language,
    genre_id_1,
    genre_id_2
  } = req.body;
  
  // 验证必填字段
  if (!novel_id) {
    return res.status(400).json({ success: false, message: 'Novel ID is required' });
  }
  
  if (!title || !title.trim()) {
    return res.status(400).json({ success: false, message: 'Title is required' });
  }
  
  if (!genre_id_1) {
    return res.status(400).json({ success: false, message: 'At least one genre is required' });
  }
  
  // 验证状态
  const validStatuses = ['ongoing', 'completed', 'hiatus'];
  if (status && !validStatuses.includes(status)) {
    return res.status(400).json({ success: false, message: 'Invalid status' });
  }
  
  // 构建封面URL
  let coverUrl = null;
  if (req.file) {
    coverUrl = `/covers/${req.file.filename}`;
  }
  
  const pool = Db.getPool();
  let conn = null;
  
  try {
    // 处理语言字段：如果languages表中没有该语言，先创建
    let processedLanguage = null;
    if (language && language.trim()) {
      const langName = language.trim();
      console.log('处理语言字段:', langName);
      
      try {
        const [langResults] = await Db.query('SELECT id FROM languages WHERE language = ?', [langName], { tag: 'novelCreation.update.language.check', idempotent: true });
        
        if (langResults.length > 0) {
          console.log('语言已存在:', langName);
          processedLanguage = langName;
        } else {
          try {
            await Db.query('INSERT INTO languages (language) VALUES (?)', [langName], { tag: 'novelCreation.update.language.create', idempotent: false });
            console.log('创建新语言:', langName);
            processedLanguage = langName;
          } catch (insertErr) {
            if (insertErr.code === 'ER_DUP_ENTRY') {
              // 并发情况下可能已创建，重新查询
              const [recheckResults] = await Db.query('SELECT id FROM languages WHERE language = ?', [langName], { tag: 'novelCreation.update.language.recheck', idempotent: true });
              processedLanguage = langName;
            } else {
              throw insertErr;
            }
          }
        }
      } catch (langErr) {
        console.error('处理语言失败:', langErr);
        return res.status(500).json({ success: false, message: 'Failed to process language' });
      }
    } else {
      console.log('语言字段为空，将保存为null');
    }
    
    // 获取连接并开始事务
    conn = await pool.getConnection();
    await conn.beginTransaction();
    
    console.log('处理后的语言值:', processedLanguage);
    
    // 1. 更新小说基本信息
    const novelQuery = `
      UPDATE novel SET
        title = ?,
        description = ?,
        recommendation = ?,
        languages = ?,
        status = ?
        ${coverUrl ? ', cover = ?' : ''}
      WHERE id = ?
    `;
    
    const novelValues = [
      title.trim(),
      description ? description.trim() : null,
      recommendation ? recommendation.trim() : null,
      processedLanguage || null,
      status || 'ongoing',
      ...(coverUrl ? [coverUrl] : []),
      parseInt(novel_id)
    ];
    
    console.log('准备更新小说，languages字段值:', processedLanguage || null);
    await conn.execute(novelQuery, novelValues);
    
    console.log('小说更新成功，ID:', novel_id, 'languages字段已更新为:', processedLanguage || null);
    
    // 2. 更新类型关联（先删除旧的，再插入新的）
    const genrePromises = [];
    
    // 先删除旧的标签关联
    genrePromises.push(
      conn.execute('DELETE FROM novel_genre_relation WHERE novel_id = ?', [parseInt(novel_id)])
    );
    
    // 插入新的标签关联
    if (genre_id_1) {
      genrePromises.push(
        conn.execute('INSERT INTO novel_genre_relation (novel_id, genre_id_1, genre_id_2) VALUES (?, ?, ?)', [parseInt(novel_id), parseInt(genre_id_1), genre_id_2 ? parseInt(genre_id_2) : null])
      );
    }
    
    // 3. 更新主角名（先删除旧的，再插入新的）
    const protagonistPromises = [];
    
    // 先删除旧的主角
    protagonistPromises.push(
      conn.execute('DELETE FROM protagonist WHERE novel_id = ?', [parseInt(novel_id)])
    );
    
    // 插入新的主角
    const protagonistKeys = Object.keys(req.body).filter(key => key.startsWith('protagonist_'));
    for (const key of protagonistKeys) {
      const name = req.body[key];
      if (name && name.trim()) {
        protagonistPromises.push(
          conn.execute('INSERT INTO protagonist (novel_id, name) VALUES (?, ?)', [parseInt(novel_id), name.trim()])
        );
      }
    }
    
    // 执行所有更新操作
    await Promise.all([...genrePromises, ...protagonistPromises]);
    
    // 提交事务
    await conn.commit();
    
    res.json({ 
      success: true,
      message: 'Novel updated successfully'
    });
    
  } catch (err) {
    if (conn) {
      try {
        await conn.rollback();
      } catch (rollbackErr) {
        console.error('回滚事务失败:', rollbackErr);
      }
    }
    console.error('更新小说失败:', err);
    res.status(500).json({ success: false, message: err.message || 'Failed to update novel' });
  } finally {
    if (conn) {
      conn.release();
    }
  }
});

// 获取下一个章节号（用于上传章节页面，查询所有状态的章节）
router.get('/chapters/novel/:novelId/next-number', async (req, res) => {
  const { novelId } = req.params;
  
  const query = `
    SELECT MAX(chapter_number) as max_chapter_number
    FROM chapter
    WHERE novel_id = ?
  `;
  
  try {
    const [results] = await Db.query(query, [parseInt(novelId)], { tag: 'novelCreation.nextChapterNumber', idempotent: true });
    
    const maxChapterNumber = results[0]?.max_chapter_number || 0;
    const nextChapterNumber = maxChapterNumber + 1;
    
    res.json({ 
      success: true, 
      data: {
        next_chapter_number: nextChapterNumber,
        max_chapter_number: maxChapterNumber
      }
    });
  } catch (err) {
    console.error('获取下一个章节号失败:', err);
    return res.status(500).json({ success: false, message: '获取下一个章节号失败' });
  }
});

// 获取小说的最后一章节状态（用于判断按钮是否可用）
router.get('/chapters/novel/:novelId/last-chapter-status', async (req, res) => {
  const { novelId } = req.params;
  const query = `
    SELECT 
      id,
      chapter_number,
      title,
      review_status,
      is_released,
      release_date
    FROM chapter
    WHERE novel_id = ?
    ORDER BY chapter_number DESC
    LIMIT 1
  `;
  
  try {
    const [results] = await Db.query(query, [parseInt(novelId)], { tag: 'novelCreation.lastChapterStatus', idempotent: true });

    if (results.length === 0) {
      // 没有章节，返回null表示所有按钮都可用（第一个章节）
      return res.json({ success: true, data: { review_status: null, is_released: null, chapter_number: null, title: null, release_date: null } });
    }

    res.json({ success: true, data: results[0] });
  } catch (err) {
    console.error('获取最新章节状态失败:', err);
    return res.status(500).json({ success: false, message: 'Failed to get last chapter status' });
  }
});

// 获取指定章节的前一章节状态
router.get('/chapters/novel/:novelId/chapter/:chapterId/prev-chapter-status', async (req, res) => {
  const { novelId, chapterId } = req.params;
  
  try {
    // 首先获取当前章节的chapter_number
    const [currentResults] = await Db.query(
      'SELECT chapter_number FROM chapter WHERE id = ? AND novel_id = ?',
      [parseInt(chapterId), parseInt(novelId)],
      { tag: 'novelCreation.currentChapter', idempotent: true }
    );

    if (currentResults.length === 0) {
      return res.status(404).json({ success: false, message: 'Chapter not found' });
    }

    const currentChapterNumber = currentResults[0].chapter_number;
    const prevChapterNumber = currentChapterNumber - 1;

    if (prevChapterNumber < 1) {
      // 没有前一章节
      return res.json({ success: true, data: null });
    }

    // 获取前一章节的状态
    const [prevResults] = await Db.query(
      `SELECT 
        id,
        chapter_number,
        title,
        review_status,
        is_released,
        release_date
      FROM chapter
      WHERE novel_id = ? AND chapter_number = ?
      LIMIT 1`,
      [parseInt(novelId), prevChapterNumber],
      { tag: 'novelCreation.prevChapterStatus', idempotent: true }
    );

    if (prevResults.length === 0) {
      return res.json({ success: true, data: null });
    }

    res.json({ success: true, data: prevResults[0] });
  } catch (err) {
    console.error('获取前一章节状态失败:', err);
    return res.status(500).json({ success: false, message: 'Failed to get previous chapter status' });
  }
});

// 获取小说的章节列表（章节管理选项卡：review_status != 'draft'）
router.get('/chapters/novel/:novelId', (req, res) => {
  const { novelId } = req.params;
  const { review_status, sort = 'desc', volumeId } = req.query;
  
  let query = `
    SELECT 
      c.id,
      c.chapter_number,
      c.title,
      COALESCE(c.word_count, LENGTH(c.content)) as word_count,
      c.review_status,
      c.created_at,
      c.release_date,
      c.is_released,
      c.unlock_price,
      c.volume_id
    FROM chapter c
    WHERE c.novel_id = ? AND c.review_status != 'draft'
  `;
  
  const params = [parseInt(novelId)];
  
  if (review_status && review_status !== 'all') {
    query += ' AND c.review_status = ?';
    params.push(review_status);
  }
  
  if (volumeId && volumeId !== 'all') {
    query += ' AND c.volume_id = ?';
    params.push(parseInt(volumeId));
  }
  
  query += ` ORDER BY c.chapter_number ${sort === 'asc' ? 'ASC' : 'DESC'}`;
  
  Db.query(query, params, { tag: 'novelCreation.chapters.list', idempotent: true })
    .then(([results]) => {
      res.json({ success: true, data: results });
    })
    .catch((err) => {
      console.error('获取章节列表失败:', err);
      return res.status(500).json({ success: false, message: '获取章节列表失败' });
    });
});

// 获取草稿列表（草稿箱选项卡：review_status = 'draft'）
router.get('/chapters/novel/:novelId/drafts', (req, res) => {
  const { novelId } = req.params;
  const { sort = 'desc' } = req.query;
  
  const query = `
    SELECT 
      id,
      chapter_number,
      title,
      COALESCE(word_count, LENGTH(content)) as word_count,
      created_at
    FROM chapter
    WHERE novel_id = ? 
      AND review_status = 'draft'
    ORDER BY chapter_number ${sort === 'asc' ? 'ASC' : 'DESC'}
  `;
  
  Db.query(query, [parseInt(novelId)], { tag: 'novelCreation.chapters.drafts', idempotent: true })
    .then(([results]) => {
      res.json({ success: true, data: results });
    })
    .catch((err) => {
      console.error('获取草稿列表失败:', err);
      return res.status(500).json({ success: false, message: '获取草稿列表失败' });
    });
});

// 提交草稿审核（将 review_status 从 'draft' 改为 'submitted'）
router.post('/chapter/:chapterId/submit', (req, res) => {
  const { chapterId } = req.params;
  
  // 先检查章节是否存在且为草稿状态
  const checkQuery = 'SELECT id, review_status FROM chapter WHERE id = ?';
  
  Db.query(checkQuery, [parseInt(chapterId)], { tag: 'novelCreation.chapter.submit.check', idempotent: true })
    .then(([results]) => {
      if (results.length === 0) {
        return res.status(404).json({ success: false, message: '章节不存在' });
      }
      
      if (results[0].review_status !== 'draft') {
        return res.status(400).json({ success: false, message: '只能提交草稿状态的章节' });
      }
      
      // 更新状态为 submitted
      const updateQuery = `
        UPDATE chapter 
        SET review_status = 'submitted'
        WHERE id = ?
      `;
      
      return Db.query(updateQuery, [parseInt(chapterId)], { tag: 'novelCreation.chapter.submit.update', idempotent: false });
    })
    .then(() => {
      res.json({ success: true, message: '章节已提交审核' });
    })
    .catch((err) => {
      console.error('提交章节审核失败:', err);
      return res.status(500).json({ success: false, message: err.message || '提交章节审核失败' });
    });
});

// 获取小说的卷列表（用于章节管理）
router.get('/novels/:novelId/volumes', async (req, res) => {
  const { novelId } = req.params;
  
  const query = `
    SELECT 
      id,
      novel_id,
      volume_id,
      title
    FROM volume
    WHERE novel_id = ?
    ORDER BY volume_id ASC
  `;
  
  try {
    const [results] = await Db.query(query, [parseInt(novelId)], { tag: 'novelCreation.volumes.list', idempotent: true });
    res.json({ success: true, data: results });
  } catch (err) {
    console.error('获取卷列表失败:', err);
    return res.status(500).json({ success: false, message: '获取卷列表失败' });
  }
});

// 更新章节所属卷
router.patch('/chapter/:chapterId/volume', async (req, res) => {
  const { chapterId } = req.params;
  const { volume_id } = req.body;
  
  try {
    // 先检查章节是否存在
    const [results] = await Db.query('SELECT id, novel_id FROM chapter WHERE id = ?', [parseInt(chapterId)], { tag: 'novelCreation.chapter.check', idempotent: true });
    
    if (results.length === 0) {
      return res.status(404).json({ success: false, message: '章节不存在' });
    }
    
    const novelId = results[0].novel_id;
    
    // 如果指定了volume_id，验证卷是否存在
    if (volume_id !== null && volume_id !== undefined) {
      const [volResults] = await Db.query('SELECT id FROM volume WHERE id = ? AND novel_id = ?', [parseInt(volume_id), novelId], { tag: 'novelCreation.volume.check', idempotent: true });
      
      if (volResults.length === 0) {
        return res.status(400).json({ success: false, message: '指定的卷不存在' });
      }
      
      // 更新章节的volume_id
      await updateChapterVolume(chapterId, volume_id, res);
    } else {
      // volume_id为null，表示"无卷"
      await updateChapterVolume(chapterId, null, res);
    }
  } catch (err) {
    console.error('更新章节卷失败:', err);
    return res.status(500).json({ success: false, message: '更新章节卷失败' });
  }
});

async function updateChapterVolume(chapterId, volumeId, res) {
  const updateQuery = `
    UPDATE chapter 
    SET volume_id = ?
    WHERE id = ?
  `;
  
  try {
    await Db.query(updateQuery, [volumeId, parseInt(chapterId)], { tag: 'novelCreation.chapter.updateVolume', idempotent: false });
    res.json({ success: true, message: '卷轴已更新' });
  } catch (updateErr) {
    console.error('更新章节卷失败:', updateErr);
    return res.status(500).json({ success: false, message: '更新章节卷失败' });
  }
}

// Multer配置用于处理FormData（文本字段）
const textFieldsMulter = multer();

// 创建章节
router.post('/chapter/create', textFieldsMulter.none(), async (req, res) => {
  const novel_id = req.body.novel_id;
  const chapter_number = req.body.chapter_number;
  const title = req.body.title;
  const content = req.body.content;
  const translator_note = req.body.translator_note;
  const is_visible = req.body.is_visible || '0';
  const is_draft = req.body.is_draft || '1';
  const word_count = req.body.word_count;
  const release_date = req.body.release_date; // 定时发布时间
  const is_released = req.body.is_released !== undefined ? req.body.is_released : '1'; // 是否已发布，默认为1
  
  // 转换变量
  const novelId = parseInt(novel_id) || 0;
  const chapterNumber = parseInt(chapter_number) || 0;
  const chapterTitle = title || '';
  const chapterContent = content || '';
  const note = translator_note || '';
  const visible = is_visible || '0';
  const wordCount = word_count || '';

  // 验证必填字段
  if (!novelId) {
    return res.status(400).json({ success: false, message: 'Novel ID is required' });
  }
  
  if (!chapterNumber) {
    return res.status(400).json({ success: false, message: 'Chapter number is required' });
  }

  if (!chapterTitle || !chapterTitle.trim()) {
    return res.status(400).json({ success: false, message: 'Chapter title is required' });
  }

  // 计算字数（去除空格）
  const calculatedWordCount = wordCount || (chapterContent ? chapterContent.replace(/\s/g, '').length : 0);

  // 设置默认volume_id为1（如果没有volume概念）
  const volume_id = 1;

  // 根据is_draft决定review_status
  // review_status 枚举类型为 enum('submitted','reviewing','approved','rejected','draft')
  // 如果 is_draft === '1'，设置为 'draft'（存为草稿）
  // 否则设置为 'submitted'（发布章节，进入审核流程）
  let reviewStatus;
  let isReleased;
  let releaseDate = null;
  
  if (is_draft === '1' || is_draft === 1) {
    reviewStatus = 'draft';
    isReleased = 0;
  } else {
    reviewStatus = 'submitted';
    // 如果有release_date，说明是定时发布
    if (release_date) {
      isReleased = 0; // 定时发布时is_released=0
      releaseDate = release_date;
    } else {
      // 立即发布
      isReleased = parseInt(is_released) === 1 ? 1 : 0;
      // 使用当地时间而不是UTC时间
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');
      const seconds = String(now.getSeconds()).padStart(2, '0');
      releaseDate = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`; // 当前时间（当地时间）
    }
  }

  try {
    // 1. 先获取 user_id
    const [novelUserResults] = await Db.query('SELECT user_id FROM novel WHERE id = ?', [novelId], { tag: 'novelCreation.chapter.create.novelUser', idempotent: true });

    // 检查查询结果
    if (!novelUserResults || novelUserResults.length === 0) {
      return res.status(404).json({ success: false, message: 'Novel not found' });
    }

    const userId = novelUserResults[0]?.user_id;
    
    if (!userId) {
      // 如果 novel.user_id 为 NULL，直接返回错误
      return res.status(400).json({ success: false, message: 'Novel user not found' });
    }

    // 2. 查询 unlockprice 表（新版本：按字数计价），获取免费章节数配置
    const [unlockPriceResults] = await Db.query(`
      SELECT karma_per_1000, min_karma, max_karma, default_free_chapters
      FROM unlockprice
      WHERE novel_id = ? AND user_id = ?
      LIMIT 1
    `, [novelId, userId], { tag: 'novelCreation.chapter.create.unlockPrice', idempotent: true });

    // 获取或创建 unlockprice 配置
    let config;
    if (!unlockPriceResults || unlockPriceResults.length === 0) {
      // 如果没有数据，创建一条默认数据（使用ON DUPLICATE KEY UPDATE防止重复）
      try {
        await Db.query(`
          INSERT INTO unlockprice (user_id, novel_id, karma_per_1000, min_karma, max_karma, default_free_chapters, pricing_style)
          VALUES (?, ?, 6, 5, 30, 50, 'per_word')
          ON DUPLICATE KEY UPDATE updated_at = NOW()
        `, [userId, novelId], { tag: 'novelCreation.chapter.create.unlockPriceCreate', idempotent: false });
        // 使用默认配置
        config = { karma_per_1000: 6, min_karma: 5, max_karma: 30, default_free_chapters: 50 };
      } catch (err) {
        console.error('创建 unlockprice 记录失败:', err);
        // 使用默认值
        config = { karma_per_1000: 6, min_karma: 5, max_karma: 30, default_free_chapters: 50 };
      }
    } else {
      config = unlockPriceResults[0];
    }

    const defaultFreeChapters = config.default_free_chapters || 0;

    // 3. 判断是免费章节还是收费章节（基于 unlockprice.default_free_chapters）
    let isAdvance, keyCost, unlockPrice;

    if (chapterNumber <= defaultFreeChapters) {
      // 免费章节：前 default_free_chapters 章免费
      isAdvance = 0;
      keyCost = 0;
      unlockPrice = 0;
    } else {
      // 收费章节：第 default_free_chapters 章之后收费
      keyCost = 1;

      // 处理 is_advance 逻辑（只有收费章节才考虑预读）
      // 1. 查询小说的 champion_status
      const [novelResults] = await Db.query('SELECT champion_status FROM novel WHERE id = ?', [novelId], { tag: 'novelCreation.chapter.create.championStatus', idempotent: true });

      const championStatus = novelResults[0]?.champion_status || 'invalid';

      console.log(`Novel ${novelId} champion_status: ${championStatus}`);

      if (championStatus === 'approved') {
        // 2. 查询最大 tier_level 的 advance_chapters 值（设为A）
        // 先找到最大 tier_level，然后获取该 tier_level 的 advance_chapters
        const [tierResults] = await Db.query(`
          SELECT advance_chapters
          FROM novel_champion_tiers
          WHERE novel_id = ? AND is_active = 1
            AND tier_level = (
              SELECT MAX(tier_level)
              FROM novel_champion_tiers
              WHERE novel_id = ? AND is_active = 1
            )
          LIMIT 1
        `, [novelId, novelId], { tag: 'novelCreation.chapter.create.tierLevel', idempotent: true });

        const maxAdvanceChapters = tierResults[0]?.advance_chapters || 0;
        console.log(`Max advance chapters: ${maxAdvanceChapters}`);

        if (maxAdvanceChapters > 0) {
          // 3. 查询该小说 chapter 表中 is_advance=1 的数据条数（设为B）
          const [advanceCountResults] = await Db.query(`
            SELECT COUNT(*) as count
            FROM chapter
            WHERE novel_id = ? AND is_advance = 1
          `, [novelId], { tag: 'novelCreation.chapter.create.advanceCount', idempotent: true });

          const currentAdvanceCount = advanceCountResults[0]?.count || 0;
          console.log(`Current advance count: ${currentAdvanceCount}`);

          if (maxAdvanceChapters > currentAdvanceCount) {
            // A > B，新增数据时直接设定 is_advance=1
            isAdvance = 1;
            console.log(`Setting is_advance=1 (A > B)`);
          } else if (maxAdvanceChapters === currentAdvanceCount) {
            // A = B，新增数据时 is_advance=1，同时设定倒数第 A+1 条数据的 is_advance=0
            isAdvance = 1;
            console.log(`Setting is_advance=1 (A = B), will update old chapter`);
            
            // 查找倒数第 A+1 条 is_advance=1 的数据
            // 如果 A=5，那么倒数第1条是OFFSET 0，倒数第6条（A+1）是OFFSET 5
            const [oldAdvanceChapters] = await Db.query(`
              SELECT id
              FROM chapter
              WHERE novel_id = ? AND is_advance = 1
              ORDER BY chapter_number DESC
              LIMIT 1 OFFSET ?
            `, [novelId, maxAdvanceChapters], { tag: 'novelCreation.chapter.create.oldAdvance', idempotent: true });

            if (oldAdvanceChapters && oldAdvanceChapters.length > 0) {
              // 更新倒数第 A+1 条数据的 is_advance=0
              await Db.query(`
                UPDATE chapter
                SET is_advance = 0
                WHERE id = ?
              `, [oldAdvanceChapters[0].id], { tag: 'novelCreation.chapter.create.updateAdvance', idempotent: false });
              console.log(`Updated chapter ${oldAdvanceChapters[0].id} is_advance to 0`);
            }
          } else {
            // A < B（理论上不应该发生，但为了安全处理）
            isAdvance = 0;
            console.log(`Setting is_advance=0 (A < B, unexpected)`);
          }
        } else {
          isAdvance = 0;
          console.log(`Setting is_advance=0 (maxAdvanceChapters = 0)`);
        }
      } else {
        // champion_status 不是 approved，is_advance=0
        isAdvance = 0;
        console.log(`Setting is_advance=0 (champion_status is not approved: ${championStatus})`);
      }

      // 计算 unlock_price（使用已获取的 config）
      unlockPrice = calculateChapterPrice(chapterNumber, wordCount || 0, config);
    }

    // 检查是否存在相同章节号的章节
    const checkQuery = `
      SELECT id, title, review_status, is_released, release_date, created_at
      FROM chapter
      WHERE novel_id = ? AND chapter_number = ?
      LIMIT 1
    `;

    try {
      const [checkResults] = await Db.query(checkQuery, [novelId, chapterNumber], { tag: 'novelCreation.chapter.create.checkDuplicate', idempotent: true });

      // 如果存在相同章节号的章节，返回需要确认的信息
      if (checkResults && checkResults.length > 0) {
        const existingChapter = checkResults[0];
        return res.status(409).json({
          success: false,
          code: 'CHAPTER_EXISTS',
          message: 'A chapter with this number already exists',
          existingChapter: {
            id: existingChapter.id,
            title: existingChapter.title,
            review_status: existingChapter.review_status,
            is_released: existingChapter.is_released,
            release_date: existingChapter.release_date,
            created_at: existingChapter.created_at
          }
        });
      }

      // 插入章节数据
      const query = `
        INSERT INTO chapter (
          novel_id,
          volume_id,
          chapter_number,
          title,
          content,
          translator_note,
          is_advance,
          key_cost,
          unlock_price,
          review_status,
          word_count,
          is_released,
          release_date
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      const values = [
        novelId,
        volume_id,
        chapterNumber,
        chapterTitle.trim(),
        chapterContent || '',
        note || '',
        isAdvance,
        keyCost,
        unlockPrice,
        reviewStatus,
        calculatedWordCount,
        isReleased,
        releaseDate
      ];

      try {
        const [result] = await Db.query(query, values, { tag: 'novelCreation.chapter.create.insert', idempotent: false });
        const newChapterId = result.insertId;

        // 如果是定时发布，插入scheduledrelease表
        if (releaseDate && isReleased === 0) {
          try {
            await Db.query(`
              INSERT INTO scheduledrelease (novel_id, chapter_id, release_time, is_released)
              VALUES (?, ?, ?, 0)
            `, [novelId, newChapterId, releaseDate], { tag: 'novelCreation.chapter.create.scheduledRelease', idempotent: false });
          } catch (scheduledErr) {
            console.error('创建定时发布记录失败:', scheduledErr);
            // 即使scheduledrelease插入失败，也返回成功（章节已创建）
          }
        }

        // 如果章节已发布（is_released === 1 且 release_date 不为空），记录字数变更
        if (isReleased === 1 && releaseDate) {
          try {
            // 获取作者ID
            const [authorResults] = await Db.query('SELECT user_id FROM novel WHERE id = ? LIMIT 1', [novelId], { tag: 'novelCreation.chapter.create.authorId', idempotent: true });
            if (authorResults && authorResults.length > 0) {
              const authorId = authorResults[0].user_id;
              if (authorId) {
                try {
                  await authorDailyWordCountService.recordChapterReleaseChange({
                    authorId,
                    novelId,
                    chapterId: newChapterId,
                    wordCount: calculatedWordCount,
                    releaseDate: releaseDate,
                  });
                } catch (wordCountErr) {
                  console.error('记录章节字数变更失败:', wordCountErr);
                  // 不影响主流程，继续返回成功
                }
              }
            }
          } catch (authorErr) {
            console.error('获取作者ID失败:', authorErr);
            // 不影响主流程，继续返回成功
          }
        }

        res.json({ 
          success: true, 
          message: 'Chapter created successfully',
          chapter_id: newChapterId
        });
      } catch (err) {
        // 检查是否是唯一约束错误
        if (err.code === 'ER_DUP_ENTRY' || err.errno === 1062) {
          // 再次查询现有章节信息
          try {
            const [dupCheckResults] = await Db.query(checkQuery, [novelId, chapterNumber], { tag: 'novelCreation.chapter.create.dupCheck', idempotent: true });
            if (!dupCheckResults || dupCheckResults.length === 0) {
              return res.status(409).json({
                success: false,
                code: 'CHAPTER_EXISTS',
                message: 'A chapter with this number already exists'
              });
            }
            const existingChapter = dupCheckResults[0];
            return res.status(409).json({
              success: false,
              code: 'CHAPTER_EXISTS',
              message: 'A chapter with this number already exists',
              existingChapter: {
                id: existingChapter.id,
                title: existingChapter.title,
                review_status: existingChapter.review_status,
                is_released: existingChapter.is_released,
                release_date: existingChapter.release_date,
                created_at: existingChapter.created_at
              }
            });
          } catch (dupCheckErr) {
            return res.status(409).json({
              success: false,
              code: 'CHAPTER_EXISTS',
              message: 'A chapter with this number already exists'
            });
          }
        }
        console.error('创建章节失败:', err);
        return res.status(500).json({ success: false, message: 'Failed to create chapter', error: err.message });
      }
    } catch (checkErr) {
      console.error('检查章节是否存在失败:', checkErr);
      return res.status(500).json({ success: false, message: 'Failed to check chapter existence', error: checkErr.message });
    }
  } catch (error) {
    console.error('创建章节时出错:', error);
    return res.status(500).json({ success: false, message: 'Failed to create chapter', error: error.message });
  }
});

// 更新章节
router.post('/chapter/update', textFieldsMulter.none(), async (req, res) => {
  const chapter_id = req.body.chapter_id;
  const novel_id = req.body.novel_id;
  const chapter_number = req.body.chapter_number;
  const title = req.body.title;
  const content = req.body.content;
  const translator_note = req.body.translator_note;
  const is_visible = req.body.is_visible || '0';
  const is_draft = req.body.is_draft;
  const word_count = req.body.word_count;
  const release_date = req.body.release_date; // 定时发布时间
  const is_released = req.body.is_released; // 是否已发布
  const action = req.body.action; // 操作类型：'draft', 'publish', 'schedule'
  
  // 转换变量
  const chapterId = chapter_id || '';
  const novelId = novel_id || '';
  const chapterNumber = chapter_number || '';
  const chapterTitle = title || '';
  const chapterContent = content || '';
  const note = translator_note || '';
  const visible = is_visible || '0';
  const wordCount = word_count || '';

  // 验证必填字段
  if (!chapterId) {
    return res.status(400).json({ success: false, message: 'Chapter ID is required' });
  }

  if (!chapterTitle || !chapterTitle.trim()) {
    return res.status(400).json({ success: false, message: 'Chapter title is required' });
  }

  // 在更新之前先查出旧状态
  let oldChapter = null;
  try {
    const [oldRows] = await Db.query(
      'SELECT novel_id, is_released, word_count, release_date FROM chapter WHERE id = ? LIMIT 1',
      [chapterId],
      { tag: 'novelCreation.chapter.update.oldState', idempotent: true }
    );
    oldChapter = oldRows && oldRows.length > 0 ? oldRows[0] : null;
  } catch (err) {
    console.error('查询章节旧状态失败:', err);
    // 继续执行，不影响主流程
  }

  // 计算字数（去除空格）
  const calculatedWordCount = wordCount || (chapterContent ? chapterContent.replace(/\s/g, '').length : 0);

  // 只更新提供的字段
  const updateFields = [];
  const updateValues = [];
  
  if (chapterNumber !== undefined && chapterNumber !== '') {
    updateFields.push('chapter_number = ?');
    updateValues.push(parseInt(chapterNumber));
  }
  
  if (chapterTitle !== undefined && chapterTitle !== '') {
    updateFields.push('title = ?');
    updateValues.push(chapterTitle.trim());
  }
  
  if (chapterContent !== undefined) {
    updateFields.push('content = ?');
    updateValues.push(chapterContent);
  }
  
  if (note !== undefined) {
    updateFields.push('translator_note = ?');
    updateValues.push(note);
  }
  
  // 根据action或is_draft参数决定review_status、is_released和release_date
  // action优先级高于is_draft
  if (action === 'publish') {
    // 更新立即发布
    updateFields.push('review_status = ?');
    updateValues.push('submitted');
    updateFields.push('is_released = ?');
    updateValues.push(1);
    updateFields.push('release_date = ?');
    // 使用当地时间而不是UTC时间
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    const localDateTimeString = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
    updateValues.push(localDateTimeString);
  } else if (action === 'schedule') {
    // 更新定时发布
    updateFields.push('review_status = ?');
    updateValues.push('submitted');
    if (release_date) {
      updateFields.push('release_date = ?');
      updateValues.push(release_date);
      // is_released不更新（保持原值），只更新title, content, translator_note, word_count
    }
  } else if (action === 'draft' || (is_draft !== undefined && is_draft !== null && (is_draft === '1' || is_draft === 1))) {
    // 更新存为草稿
    updateFields.push('review_status = ?');
    updateValues.push('draft');
    updateFields.push('is_released = ?');
    updateValues.push(0);
  } else if (is_draft !== undefined && is_draft !== null) {
    // 从草稿状态发布，设置为 submitted
    updateFields.push('review_status = ?');
    updateValues.push('submitted');
  } else if (visible !== undefined && visible !== '') {
    // 如果没有传递 is_draft，但传递了 is_visible，根据 is_visible 判断
    // 如果 is_visible === '1'，说明是发布章节，设置为 submitted
    if (visible === '1' || visible === 1) {
      updateFields.push('review_status = ?');
      updateValues.push('submitted');
    }
  }
  
  if (calculatedWordCount !== undefined && calculatedWordCount !== '') {
    updateFields.push('word_count = ?');
    updateValues.push(parseInt(calculatedWordCount));
  }
  
  // 如果是发布操作（立即发布或定时发布），需要计算unlock_price
  if ((action === 'publish' || action === 'schedule') && chapterNumber) {
    // 先获取章节信息，然后计算unlock_price
    try {
      const [chapterResults] = await Db.query('SELECT novel_id FROM chapter WHERE id = ?', [parseInt(chapterId)], { tag: 'novelCreation.chapter.update.novelId', idempotent: true });
      if (!chapterResults || chapterResults.length === 0) {
        console.error('无法获取章节信息');
      } else {
        const currentNovelId = chapterResults[0].novel_id;
        const currentChapterNumber = parseInt(chapterNumber);

        try {
          // 获取user_id
          const [novelInfoRows] = await Db.query('SELECT user_id FROM novel WHERE id = ?', [currentNovelId], { tag: 'novelCreation.chapter.update.userId', idempotent: true });
          if (!novelInfoRows || !novelInfoRows[0] || !novelInfoRows[0].user_id) {
            console.error('无法获取小说信息');
          } else {
            const userId = novelInfoRows[0].user_id;

            // 查询unlockprice表
            const [unlockPriceResults] = await Db.query(`
              SELECT karma_per_1000, min_karma, max_karma, default_free_chapters
              FROM unlockprice
              WHERE novel_id = ? AND user_id = ?
              LIMIT 1
            `, [currentNovelId, userId], { tag: 'novelCreation.chapter.update.unlockPrice', idempotent: true });

            let unlockPrice = 0;
            if (!unlockPriceResults || unlockPriceResults.length === 0) {
              // 如果没有数据，创建一条默认数据（使用ON DUPLICATE KEY UPDATE防止重复）
              try {
                await Db.query(`
                  INSERT INTO unlockprice (user_id, novel_id, karma_per_1000, min_karma, max_karma, default_free_chapters, pricing_style)
                  VALUES (?, ?, 6, 5, 30, 50, 'per_word')
                  ON DUPLICATE KEY UPDATE updated_at = NOW()
                `, [userId, currentNovelId], { tag: 'novelCreation.chapter.update.unlockPriceCreate', idempotent: false });
                // 使用默认配置计算价格
                const config = { karma_per_1000: 6, min_karma: 5, max_karma: 30, default_free_chapters: 50 };
                unlockPrice = calculateChapterPrice(currentChapterNumber, parseInt(calculatedWordCount) || 0, config);
              } catch (err) {
                console.error('创建 unlockprice 记录失败:', err);
                // 使用默认值计算
                const config = { karma_per_1000: 6, min_karma: 5, max_karma: 30, default_free_chapters: 50 };
                unlockPrice = calculateChapterPrice(currentChapterNumber, parseInt(calculatedWordCount) || 0, config);
              }
            } else {
              const config = unlockPriceResults[0];
              // 如果章节序号大于免费章节数，则计算价格
              if (currentChapterNumber > config.default_free_chapters) {
                unlockPrice = calculateChapterPrice(currentChapterNumber, parseInt(calculatedWordCount) || 0, config);
              } else {
                unlockPrice = 0; // 免费章节
              }
            }

            // 更新unlock_price
            try {
              await Db.query('UPDATE chapter SET unlock_price = ? WHERE id = ?', [unlockPrice, parseInt(chapterId)], { tag: 'novelCreation.chapter.update.unlockPriceUpdate', idempotent: false });
            } catch (updateErr) {
              console.error('更新unlock_price失败:', updateErr);
            }
          }
        } catch (error) {
          console.error('计算unlock_price时出错:', error);
        }
      }
    } catch (chapterErr) {
      console.error('无法获取章节信息:', chapterErr);
    }
  }
  
  if (updateFields.length === 0) {
    return res.status(400).json({ success: false, message: 'No fields to update' });
  }
  
  updateValues.push(parseInt(chapterId));

  const updateQuery = `UPDATE chapter SET ${updateFields.join(', ')} WHERE id = ?`;

  try {
    await Db.query(updateQuery, updateValues, { tag: 'novelCreation.chapter.update.main', idempotent: false });

    // 处理scheduledrelease表
    if (action === 'schedule' && release_date) {
      try {
        // 检查是否已存在定时发布记录
        const [checkResults] = await Db.query(`SELECT id FROM scheduledrelease WHERE chapter_id = ? LIMIT 1`, [parseInt(chapterId)], { tag: 'novelCreation.chapter.update.scheduledCheck', idempotent: true });
        
        if (checkResults && checkResults.length > 0) {
          // 更新现有记录
          await Db.query(`
            UPDATE scheduledrelease
            SET release_time = ?, is_released = 0, updated_at = CURRENT_TIMESTAMP
            WHERE chapter_id = ?
          `, [release_date, parseInt(chapterId)], { tag: 'novelCreation.chapter.update.scheduledUpdate', idempotent: false });
        } else {
          // 插入新记录
          await Db.query(`
            INSERT INTO scheduledrelease (novel_id, chapter_id, release_time, is_released)
            VALUES (?, ?, ?, 0)
          `, [parseInt(novelId) || 0, parseInt(chapterId), release_date], { tag: 'novelCreation.chapter.update.scheduledInsert', idempotent: false });
        }
      } catch (scheduledErr) {
        console.error('处理定时发布记录失败:', scheduledErr);
        // 不影响主流程
      }
    } else if (action === 'publish') {
      try {
        // 立即发布时，检查章节是否是从定时发布状态转为立即发布
        const [checkScheduledResults] = await Db.query(`SELECT id FROM scheduledrelease WHERE chapter_id = ? LIMIT 1`, [parseInt(chapterId)], { tag: 'novelCreation.chapter.update.scheduledPublishCheck', idempotent: true });
        
        // 如果存在定时发布记录，则更新为已发布
        if (checkScheduledResults && checkScheduledResults.length > 0) {
          await Db.query(`
            UPDATE scheduledrelease
            SET is_released = 1, updated_at = CURRENT_TIMESTAMP
            WHERE chapter_id = ?
          `, [parseInt(chapterId)], { tag: 'novelCreation.chapter.update.scheduledPublishUpdate', idempotent: false });
        }
      } catch (scheduledErr) {
        console.error('处理定时发布记录失败:', scheduledErr);
        // 不影响主流程
      }
    }

    // 更新完成后，再查一次最新章节状态（保证拿到数据库中的最终值）
    const [newRows] = await Db.query(
      'SELECT novel_id, is_released, word_count, release_date FROM chapter WHERE id = ? LIMIT 1',
      [parseInt(chapterId)],
      { tag: 'novelCreation.chapter.update.finalState', idempotent: true }
    );

    const newChapter = newRows && newRows.length > 0 ? newRows[0] : null;
    
    if (newChapter) {
      // 需要记录发布变更的场景：
      // A. 原来未发布，更新后已发布
      // B. 原来已发布，这次修改后字数发生变化
      const shouldRecord = 
        (!oldChapter || !oldChapter.is_released) && newChapter.is_released == 1 ||
        (oldChapter && oldChapter.is_released == 1 && newChapter.is_released == 1 && 
         (oldChapter.word_count || 0) !== (newChapter.word_count || 0));

      if (shouldRecord) {
        try {
          // 获取作者ID
          const [authorResults] = await Db.query('SELECT user_id FROM novel WHERE id = ? LIMIT 1', [newChapter.novel_id], { tag: 'novelCreation.chapter.update.authorId', idempotent: true });
          if (authorResults && authorResults.length > 0) {
            const authorId = authorResults[0].user_id;
            if (authorId) {
              try {
                await authorDailyWordCountService.recordChapterReleaseChange({
                  authorId,
                  novelId: newChapter.novel_id,
                  chapterId: parseInt(chapterId),
                  wordCount: newChapter.word_count || 0,
                  releaseDate: newChapter.release_date || new Date(),
                });
              } catch (wordCountErr) {
                console.error('记录章节字数变更失败:', wordCountErr);
                // 不影响主流程
              }
            }
          }
        } catch (authorErr) {
          console.error('获取作者ID失败:', authorErr);
          // 不影响主流程
        }
      }
    }

    res.json({ 
      success: true, 
      message: 'Chapter updated successfully'
    });
  } catch (err) {
    console.error('更新章节失败:', err);
    return res.status(500).json({ success: false, message: 'Failed to update chapter', error: err.message });
  }
});

// 章节详情 API 已迁移到 backend/server.js 的权威入口：GET /api/chapter/:chapterId
// 目的：避免在 server.js 与 novelCreation.js 两处同时定义导致的覆盖/冲突，以及避免此处模块级单连接 db 在断连后被持续复用。

// 删除章节
router.delete('/chapter/:chapterId', (req, res) => {
  const { chapterId } = req.params;

  // 首先检查章节是否存在
  const checkQuery = `SELECT id, novel_id, chapter_number, title FROM chapter WHERE id = ?`;
  
  Db.query(checkQuery, [parseInt(chapterId)], { tag: 'novelCreation.chapter.delete.check', idempotent: true })
    .then(([results]) => {
      if (results.length === 0) {
        return res.status(404).json({ success: false, message: 'Chapter not found' });
      }

      const chapter = results[0];

      // 删除章节
      const deleteQuery = `DELETE FROM chapter WHERE id = ?`;
      
      return Promise.all([
        Promise.resolve(chapter),
        Db.query(deleteQuery, [parseInt(chapterId)], { tag: 'novelCreation.chapter.delete', idempotent: false })
      ]);
    })
    .then(([chapter]) => {
      res.json({ 
        success: true, 
        message: 'Chapter deleted successfully',
        data: {
          deletedChapterId: parseInt(chapterId),
          novelId: chapter.novel_id,
          chapterNumber: chapter.chapter_number,
          title: chapter.title
        }
      });
    })
    .catch((err) => {
      console.error('删除章节失败:', err);
      return res.status(500).json({ success: false, message: err.message || 'Failed to delete chapter' });
    });
});

// ==================== 收费管理相关API ====================
// 注意：unlockprice 相关的 API 已迁移到 /api/pricing 路由
// 请使用 pricing.js 中的新接口

// 获取第51章及以后的章节列表（用于收费管理，带分页）
router.get('/chapters/novel/:novelId/paid', (req, res) => {
  const { novelId } = req.params;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const offset = (page - 1) * limit;
  
  // 先获取总数
  const countQuery = `
    SELECT COUNT(*) as total
    FROM chapter
    WHERE novel_id = ? AND chapter_number >= 51
  `;
  
  Db.query(countQuery, [parseInt(novelId)], { tag: 'novelCreation.chapters.paid.count', idempotent: true })
    .then(([countResults]) => {
      const total = countResults[0].total;
      
      // 获取分页数据
      const query = `
        SELECT 
          id,
          chapter_number,
          title,
          unlock_price,
          review_status,
          created_at
        FROM chapter
        WHERE novel_id = ? AND chapter_number >= 51
        ORDER BY chapter_number ASC
        LIMIT ? OFFSET ?
      `;
      
      return Promise.all([
        Promise.resolve(total),
        Db.query(query, [parseInt(novelId), limit, offset], { tag: 'novelCreation.chapters.paid.list', idempotent: true })
      ]);
    })
    .then(([total, [results]]) => {
      res.json({ 
        success: true, 
        data: results,
        pagination: {
          total: total,
          page: page,
          limit: limit,
          totalPages: Math.ceil(total / limit)
        }
      });
    })
    .catch((err) => {
      console.error('获取付费章节列表失败:', err);
      return res.status(500).json({ success: false, message: '获取付费章节列表失败' });
    });
});

// 批量更新章节的unlock_price（新版本：按字数计价）
router.post('/chapters/batch-update-unlock-price', (req, res) => {
  const { novel_id, user_id } = req.body;
  
  if (!novel_id || !user_id) {
    return res.status(400).json({ success: false, message: '参数不完整' });
  }
  
  // 先获取 unlockprice 配置
  const getConfigQuery = `
    SELECT karma_per_1000, min_karma, max_karma, default_free_chapters
    FROM unlockprice
    WHERE novel_id = ? AND user_id = ?
    LIMIT 1
  `;
  
  Db.query(getConfigQuery, [parseInt(novel_id), parseInt(user_id)], { tag: 'novelCreation.batchUpdate.config', idempotent: true })
    .then(([configResults]) => {
      if (configResults.length === 0) {
        return res.status(404).json({ success: false, message: '未找到价格配置，请先设置费用规则' });
      }
      
      const config = configResults[0];
      
      // 获取所有章节（需要 word_count 和 chapter_number）
      const getChaptersQuery = `
        SELECT id, chapter_number, 
               CASE 
                 WHEN word_count IS NULL OR word_count = 0 THEN LENGTH(REPLACE(COALESCE(content, ''), ' ', ''))
                 ELSE word_count
               END as word_count
        FROM chapter 
        WHERE novel_id = ?
        ORDER BY chapter_number ASC
      `;
      
      return Promise.all([
        Promise.resolve(config),
        Db.query(getChaptersQuery, [parseInt(novel_id)], { tag: 'novelCreation.batchUpdate.chapters', idempotent: true })
      ]);
    })
    .then(([config, [chapters]]) => {
      if (chapters.length === 0) {
        return res.json({ success: true, message: '没有需要更新的章节', updated: 0 });
      }
      
      // 批量更新
      const updatePromises = chapters.map((chapter) => {
        const newPrice = calculateChapterPrice(
          chapter.chapter_number,
          chapter.word_count || 0,
          config
        );
        
        // 同时更新 word_count（如果为0）
        const updateQuery = `
          UPDATE chapter 
          SET unlock_price = ?,
              word_count = CASE 
                            WHEN word_count IS NULL OR word_count = 0 THEN ?
                            ELSE word_count
                          END
          WHERE id = ?
        `;
        
        return Db.query(updateQuery, [newPrice, chapter.word_count || 0, chapter.id], { tag: 'novelCreation.batchUpdate.update', idempotent: false })
          .then(() => ({ success: true, id: chapter.id }))
          .catch((err) => {
            console.error(`更新章节 ${chapter.id} 失败:`, err);
            return { success: false, id: chapter.id };
          });
      });
      
      return Promise.all(updatePromises);
    })
    .then((results) => {
      const updatedCount = results.filter(r => r.success).length;
      const errorCount = results.filter(r => !r.success).length;
      
      if (errorCount > 0) {
        return res.status(500).json({ 
          success: false, 
          message: `部分章节更新失败，成功: ${updatedCount}, 失败: ${errorCount}`,
          updated: updatedCount,
          failed: errorCount
        });
      }
      
      res.json({ 
        success: true, 
        message: `成功更新 ${updatedCount} 个章节的解锁价格`,
        updated: updatedCount
      });
    })
    .catch((err) => {
      console.error('批量更新章节价格失败:', err);
      return res.status(500).json({ success: false, message: err.message || '批量更新章节价格失败' });
    });
});

// 单独更新某个章节的unlock_price
router.post('/chapter/update-unlock-price', (req, res) => {
  const { chapter_id, unlock_price } = req.body;
  
  if (!chapter_id || unlock_price === undefined) {
    return res.status(400).json({ success: false, message: '章节ID和解锁价格是必需的' });
  }
  
  if (parseInt(unlock_price) < 0) {
    return res.status(400).json({ success: false, message: '解锁价格必须大于等于0' });
  }
  
  const updateQuery = 'UPDATE chapter SET unlock_price = ? WHERE id = ?';
  
  Db.query(updateQuery, [parseInt(unlock_price), parseInt(chapter_id)], { tag: 'novelCreation.chapter.updateUnlockPrice', idempotent: false })
    .then(([result]) => {
      if (result.affectedRows === 0) {
        return res.status(404).json({ success: false, message: '章节不存在' });
      }
      
      res.json({ success: true, message: '章节解锁价格更新成功' });
    })
    .catch((err) => {
      console.error('更新章节解锁价格失败:', err);
      return res.status(500).json({ success: false, message: '更新章节解锁价格失败' });
    });
});

module.exports = router;

