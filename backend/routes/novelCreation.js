const express = require('express');
const mysql = require('mysql2');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const router = express.Router();
const authorDailyWordCountService = require('../services/authorDailyWordCountService');

// 数据库配置
const db = mysql.createConnection({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'wuxiaworld'
});

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
router.get('/genre/all', (req, res) => {
  const query = 'SELECT id, name, chinese_name, slug FROM genre WHERE is_active = 1 ORDER BY name';
  
  db.query(query, (err, results) => {
    if (err) {
      console.error('获取类型失败:', err);
      return res.status(500).json({ message: 'Failed to fetch genres' });
    }
    
    res.json(results);
  });
});

// 获取所有语言
router.get('/languages/all', (req, res) => {
  const query = 'SELECT id, language FROM languages ORDER BY language';
  
  db.query(query, (err, results) => {
    if (err) {
      console.error('获取语言失败:', err);
      return res.status(500).json({ message: 'Failed to fetch languages' });
    }
    
    res.json(results);
  });
});

// 创建新语言
router.post('/languages/create', (req, res) => {
  const { language } = req.body;
  
  if (!language || !language.trim()) {
    return res.status(400).json({ message: 'Language name is required' });
  }
  
  const query = 'INSERT INTO languages (language) VALUES (?)';
  
  db.query(query, [language.trim()], (err, result) => {
    if (err) {
      if (err.code === 'ER_DUP_ENTRY') {
        return res.status(400).json({ message: 'Language already exists' });
      }
      console.error('创建语言失败:', err);
      return res.status(500).json({ message: 'Failed to create language' });
    }
    
    res.json({ id: result.insertId, language: language.trim() });
  });
});

// 创建小说
router.post('/novel/create', upload.single('cover'), (req, res) => {
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
  
  // 处理语言字段：如果languages表中没有该语言，先创建
  const processLanguage = (languageName) => {
    return new Promise((resolve, reject) => {
      if (!languageName || !languageName.trim()) {
        console.log('语言字段为空，将保存为null');
        return resolve(null);
      }
      
      const langName = languageName.trim();
      console.log('处理语言字段:', langName);
      
      // 先查询该语言是否存在
      db.query('SELECT id FROM languages WHERE language = ?', [langName], (err, results) => {
        if (err) {
          return reject(err);
        }
        
        if (results.length > 0) {
          // 语言已存在，直接返回语言名称
          console.log('语言已存在:', langName);
          resolve(langName);
        } else {
          // 语言不存在，创建新语言
          console.log('创建新语言:', langName);
          db.query('INSERT INTO languages (language) VALUES (?)', [langName], (err, result) => {
            if (err) {
              // 如果是因为唯一约束冲突（并发情况下可能发生），查询现有记录
              if (err.code === 'ER_DUP_ENTRY') {
                db.query('SELECT id FROM languages WHERE language = ?', [langName], (err2, results2) => {
                  if (err2) return reject(err2);
                  resolve(langName);
                });
              } else {
                return reject(err);
              }
            } else {
              resolve(langName);
            }
          });
        }
      });
    });
  };
  
  // 先处理语言，然后再开始事务
  console.log('接收到的language字段:', language);
  processLanguage(language)
    .then((processedLanguage) => {
      console.log('处理后的语言值:', processedLanguage);
      // 开始事务
      db.beginTransaction((err) => {
        if (err) {
          console.error('开始事务失败:', err);
          return res.status(500).json({ message: 'Failed to start transaction' });
        }
        
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
        db.query(novelQuery, novelValues, (err, novelResult) => {
          if (err) {
            return db.rollback(() => {
              console.error('创建小说失败:', err);
              res.status(500).json({ message: 'Failed to create novel' });
            });
          }
          
          const novelId = novelResult.insertId;
          console.log('小说创建成功，ID:', novelId, 'languages字段已保存为:', processedLanguage || null);
          
          // 2. 插入类型关联
          const genrePromises = [];
          
          if (genre_id_1) {
            genrePromises.push(
              new Promise((resolve, reject) => {
                const genreQuery = 'INSERT INTO novel_genre_relation (novel_id, genre_id_1) VALUES (?, ?)';
                db.query(genreQuery, [novelId, parseInt(genre_id_1)], (err) => {
                  if (err) reject(err);
                  else resolve();
                });
              })
            );
          }
          
          // 更新 genre_id_2（如果提供了第二个类型）
          if (genre_id_2) {
            genrePromises.push(
              new Promise((resolve, reject) => {
                // 先检查是否已有记录
                const checkQuery = 'SELECT id FROM novel_genre_relation WHERE novel_id = ?';
                db.query(checkQuery, [novelId], (err, results) => {
                  if (err) {
                    reject(err);
                    return;
                  }
                  
                  if (results.length > 0) {
                    // 更新已有记录
                    const updateQuery = 'UPDATE novel_genre_relation SET genre_id_2 = ? WHERE novel_id = ?';
                    db.query(updateQuery, [parseInt(genre_id_2), novelId], (err) => {
                      if (err) reject(err);
                      else resolve();
                    });
                  } else {
                    // 如果没有记录（不应该发生），创建一个新的
                    const insertQuery = 'INSERT INTO novel_genre_relation (novel_id, genre_id_1, genre_id_2) VALUES (?, ?, ?)';
                    db.query(insertQuery, [novelId, parseInt(genre_id_1), parseInt(genre_id_2)], (err) => {
                      if (err) reject(err);
                      else resolve();
                    });
                  }
                });
              })
            );
          }
          
          // 3. 插入主角名
          const protagonistPromises = [];
          const protagonistKeys = Object.keys(req.body).filter(key => key.startsWith('protagonist_'));
          
          protagonistKeys.forEach((key, index) => {
            const name = req.body[key];
            if (name && name.trim()) {
              protagonistPromises.push(
                new Promise((resolve, reject) => {
                  const protagonistQuery = 'INSERT INTO protagonist (novel_id, name) VALUES (?, ?)';
                  db.query(protagonistQuery, [novelId, name.trim()], (err) => {
                    if (err) reject(err);
                    else resolve();
                  });
                })
              );
            }
          });
          
          // 执行所有插入操作
          Promise.all([...genrePromises, ...protagonistPromises])
            .then(() => {
              // 提交事务
              db.commit((err) => {
                if (err) {
                  return db.rollback(() => {
                    console.error('提交事务失败:', err);
                    res.status(500).json({ message: 'Failed to commit transaction' });
                  });
                }
                
                // 事务提交成功后，查询并创建unlockprice记录（如果不存在）
                db.query(
                  'SELECT id FROM unlockprice WHERE novel_id = ? AND user_id = ?',
                  [novelId, parseInt(user_id)],
                  (unlockErr, unlockResults) => {
                    if (unlockErr) {
                      console.error('查询unlockprice失败:', unlockErr);
                      // 即使查询失败，也返回成功（不影响小说创建）
                      return res.json({ 
                        success: true, 
                        id: novelId,
                        data: { id: novelId },
                        message: 'Novel created successfully'
                      });
                    }
                    
                    // 使用 INSERT ... ON DUPLICATE KEY UPDATE 确保唯一性
                    // 如果记录已存在，则更新（虽然实际上不会更新，因为值相同）
                    db.query(
                      `INSERT INTO unlockprice 
                       (user_id, novel_id, karma_per_1000, min_karma, max_karma, default_free_chapters, pricing_style, created_at, updated_at)
                       VALUES (?, ?, 6, 5, 30, 50, 'per_word', NOW(), NOW())
                       ON DUPLICATE KEY UPDATE updated_at = NOW()`,
                      [parseInt(user_id), novelId],
                      (insertErr) => {
                        if (insertErr) {
                          console.error('创建unlockprice记录失败:', insertErr);
                          // 即使创建失败，也返回成功（不影响小说创建）
                        } else {
                          console.log('成功创建或更新unlockprice记录，novel_id:', novelId, 'user_id:', user_id);
                        }
                        
                        res.json({ 
                          success: true, 
                          id: novelId,
                          data: { id: novelId },
                          message: 'Novel created successfully'
                        });
                      }
                    );
                  }
                );
              });
            })
            .catch((err) => {
              return db.rollback(() => {
                console.error('插入关联数据失败:', err);
                res.status(500).json({ message: 'Failed to create novel relations' });
              });
            });
        });
      });
    })
    .catch((err) => {
      console.error('处理语言失败:', err);
      res.status(500).json({ message: 'Failed to process language' });
    });
});

// 获取用户的小说列表（带统计信息）
router.get('/novels/user/:user_id', (req, res) => {
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
  
  db.query(query, [parseInt(user_id), parseInt(user_id), parseInt(user_id)], (err, results) => {
    if (err) {
      console.error('获取用户小说列表失败:', err);
      return res.status(500).json({ 
        success: false,
        message: 'Failed to fetch user novels',
        error: err.message 
      });
    }
    
    console.log(`找到 ${results.length} 本小说`);
    
    // 处理封面URL
    const novels = results.map(novel => ({
      ...novel,
      cover: novel.cover ? (novel.cover.startsWith('http') ? novel.cover : `http://localhost:5000${novel.cover}`) : null,
      monthly_word_count: parseInt(novel.monthly_word_count) || 0,
      reviewed_word_count: parseInt(novel.reviewed_word_count) || 0
    }));
    
    console.log('返回的小说列表:', novels.length, '本');
    
    res.json({
      success: true,
      data: novels,
      count: novels.length
    });
  });
});

// 获取小说详细信息（包括标签、主角等）
router.get('/novel/:id', (req, res) => {
  const { id } = req.params;
  
  const query = `
    SELECT 
      n.*,
      n.id as novel_id,
      n.user_id
    FROM novel n
    WHERE n.id = ?
  `;
  
  db.query(query, [parseInt(id)], (err, results) => {
    if (err) {
      console.error('获取小说信息失败:', err);
      return res.status(500).json({ success: false, message: '获取小说信息失败' });
    }
    
    if (results.length === 0) {
      return res.status(404).json({ success: false, message: '小说不存在' });
    }
    
    res.json({ success: true, data: results[0] });
  });
});

// 获取小说详细信息（包括标签、主角、类型等）
router.get('/novel/:id/detail', (req, res) => {
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
  
  db.query(query, [parseInt(id)], (err, results) => {
    if (err) {
      console.error('获取小说详细信息失败:', err);
      return res.status(500).json({ success: false, message: '获取小说详细信息失败' });
    }
    
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
    db.query(protagonistQuery, [parseInt(id)], (protagonistErr, protagonistResults) => {
      if (protagonistErr) {
        console.error('查询主角信息失败:', protagonistErr);
        // 即使查询主角失败，也返回其他数据
        return res.json({
          success: true,
          data: {
            ...novel,
            genres,
            protagonists: []
          }
        });
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
    });
  });
});

// 更新小说信息
router.post('/novel/update', upload.single('cover'), (req, res) => {
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
  
  // 处理语言字段：如果languages表中没有该语言，先创建
  const processLanguage = (languageName) => {
    return new Promise((resolve, reject) => {
      if (!languageName || !languageName.trim()) {
        console.log('语言字段为空，将保存为null');
        return resolve(null);
      }
      
      const langName = languageName.trim();
      console.log('处理语言字段:', langName);
      
      // 先查询该语言是否存在
      db.query('SELECT id FROM languages WHERE language = ?', [langName], (err, results) => {
        if (err) {
          return reject(err);
        }
        
        if (results.length > 0) {
          // 语言已存在，直接返回语言名称
          console.log('语言已存在:', langName);
          resolve(langName);
        } else {
          // 语言不存在，创建新语言
          console.log('创建新语言:', langName);
          db.query('INSERT INTO languages (language) VALUES (?)', [langName], (err, result) => {
            if (err) {
              // 如果是因为唯一约束冲突（并发情况下可能发生），查询现有记录
              if (err.code === 'ER_DUP_ENTRY') {
                db.query('SELECT id FROM languages WHERE language = ?', [langName], (err2, results2) => {
                  if (err2) return reject(err2);
                  resolve(langName);
                });
              } else {
                return reject(err);
              }
            } else {
              resolve(langName);
            }
          });
        }
      });
    });
  };
  
  // 先处理语言，然后再开始事务
  console.log('接收到的language字段:', language);
  processLanguage(language)
    .then((processedLanguage) => {
      console.log('处理后的语言值:', processedLanguage);
      // 开始事务
      db.beginTransaction((err) => {
        if (err) {
          console.error('开始事务失败:', err);
          return res.status(500).json({ success: false, message: 'Failed to start transaction' });
        }
        
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
        db.query(novelQuery, novelValues, (err, result) => {
          if (err) {
            return db.rollback(() => {
              console.error('更新小说失败:', err);
              res.status(500).json({ success: false, message: 'Failed to update novel' });
            });
          }
          
          console.log('小说更新成功，ID:', novel_id, 'languages字段已更新为:', processedLanguage || null);
          
          // 2. 更新类型关联（先删除旧的，再插入新的）
          const genrePromises = [];
          
          // 先删除旧的标签关联
          genrePromises.push(
            new Promise((resolve, reject) => {
              db.query('DELETE FROM novel_genre_relation WHERE novel_id = ?', [parseInt(novel_id)], (err) => {
                if (err) reject(err);
                else resolve();
              });
            })
          );
          
          // 插入新的标签关联
          if (genre_id_1) {
            genrePromises.push(
              new Promise((resolve, reject) => {
                const genreQuery = 'INSERT INTO novel_genre_relation (novel_id, genre_id_1, genre_id_2) VALUES (?, ?, ?)';
                db.query(genreQuery, [parseInt(novel_id), parseInt(genre_id_1), genre_id_2 ? parseInt(genre_id_2) : null], (err) => {
                  if (err) reject(err);
                  else resolve();
                });
              })
            );
          }
          
          // 3. 更新主角名（先删除旧的，再插入新的）
          const protagonistPromises = [];
          
          // 先删除旧的主角
          protagonistPromises.push(
            new Promise((resolve, reject) => {
              db.query('DELETE FROM protagonist WHERE novel_id = ?', [parseInt(novel_id)], (err) => {
                if (err) reject(err);
                else resolve();
              });
            })
          );
          
          // 插入新的主角
          const protagonistKeys = Object.keys(req.body).filter(key => key.startsWith('protagonist_'));
          protagonistKeys.forEach((key, index) => {
            const name = req.body[key];
            if (name && name.trim()) {
              protagonistPromises.push(
                new Promise((resolve, reject) => {
                  const protagonistQuery = 'INSERT INTO protagonist (novel_id, name) VALUES (?, ?)';
                  db.query(protagonistQuery, [parseInt(novel_id), name.trim()], (err) => {
                    if (err) reject(err);
                    else resolve();
                  });
                })
              );
            }
          });
          
          // 执行所有更新操作
          Promise.all([...genrePromises, ...protagonistPromises])
            .then(() => {
              // 提交事务
              db.commit((err) => {
                if (err) {
                  return db.rollback(() => {
                    console.error('提交事务失败:', err);
                    res.status(500).json({ success: false, message: 'Failed to commit transaction' });
                  });
                }
                
                res.json({ 
                  success: true,
                  message: 'Novel updated successfully'
                });
              });
            })
            .catch((err) => {
              return db.rollback(() => {
                console.error('更新关联数据失败:', err);
                res.status(500).json({ success: false, message: 'Failed to update novel relations' });
              });
            });
        });
      });
    })
    .catch((err) => {
      console.error('处理语言失败:', err);
      res.status(500).json({ success: false, message: 'Failed to process language' });
    });
});

// 获取下一个章节号（用于上传章节页面，查询所有状态的章节）
router.get('/chapters/novel/:novelId/next-number', (req, res) => {
  const { novelId } = req.params;
  
  const query = `
    SELECT MAX(chapter_number) as max_chapter_number
    FROM chapter
    WHERE novel_id = ?
  `;
  
  db.query(query, [parseInt(novelId)], (err, results) => {
    if (err) {
      console.error('获取下一个章节号失败:', err);
      return res.status(500).json({ success: false, message: '获取下一个章节号失败' });
    }
    
    const maxChapterNumber = results[0]?.max_chapter_number || 0;
    const nextChapterNumber = maxChapterNumber + 1;
    
    res.json({ 
      success: true, 
      data: {
        next_chapter_number: nextChapterNumber,
        max_chapter_number: maxChapterNumber
      }
    });
  });
});

// 获取小说的最后一章节状态（用于判断按钮是否可用）
router.get('/chapters/novel/:novelId/last-chapter-status', (req, res) => {
  const { novelId } = req.params;
  const query = `
    SELECT 
      id,
      chapter_number,
      title,
      review_status,
      is_released
    FROM chapter
    WHERE novel_id = ?
    ORDER BY chapter_number DESC
    LIMIT 1
  `;
  
  db.query(query, [parseInt(novelId)], (err, results) => {
    if (err) {
      console.error('获取最新章节状态失败:', err);
      return res.status(500).json({ success: false, message: 'Failed to get last chapter status' });
    }

    if (results.length === 0) {
      // 没有章节，返回null表示所有按钮都可用（第一个章节）
      return res.json({ success: true, data: { review_status: null, is_released: null, chapter_number: null, title: null } });
    }

    res.json({ success: true, data: results[0] });
  });
});

// 获取指定章节的前一章节状态
router.get('/chapters/novel/:novelId/chapter/:chapterId/prev-chapter-status', (req, res) => {
  const { novelId, chapterId } = req.params;
  
  // 首先获取当前章节的chapter_number
  const currentChapterQuery = `SELECT chapter_number FROM chapter WHERE id = ? AND novel_id = ?`;
  
  db.query(currentChapterQuery, [parseInt(chapterId), parseInt(novelId)], (err, currentResults) => {
    if (err) {
      console.error('获取当前章节失败:', err);
      return res.status(500).json({ success: false, message: 'Failed to get current chapter' });
    }

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
    const prevChapterQuery = `
      SELECT 
        id,
        chapter_number,
        title,
        review_status,
        is_released,
        release_date
      FROM chapter
      WHERE novel_id = ? AND chapter_number = ?
      LIMIT 1
    `;

    db.query(prevChapterQuery, [parseInt(novelId), prevChapterNumber], (prevErr, prevResults) => {
      if (prevErr) {
        console.error('获取前一章节状态失败:', prevErr);
        return res.status(500).json({ success: false, message: 'Failed to get previous chapter status' });
      }

      if (prevResults.length === 0) {
        return res.json({ success: true, data: null });
      }

      res.json({ success: true, data: prevResults[0] });
    });
  });
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
  
  db.query(query, params, (err, results) => {
    if (err) {
      console.error('获取章节列表失败:', err);
      return res.status(500).json({ success: false, message: '获取章节列表失败' });
    }
    
    res.json({ success: true, data: results });
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
  
  db.query(query, [parseInt(novelId)], (err, results) => {
    if (err) {
      console.error('获取草稿列表失败:', err);
      return res.status(500).json({ success: false, message: '获取草稿列表失败' });
    }
    
    res.json({ success: true, data: results });
  });
});

// 提交草稿审核（将 review_status 从 'draft' 改为 'submitted'）
router.post('/chapter/:chapterId/submit', (req, res) => {
  const { chapterId } = req.params;
  
  // 先检查章节是否存在且为草稿状态
  const checkQuery = 'SELECT id, review_status FROM chapter WHERE id = ?';
  
  db.query(checkQuery, [parseInt(chapterId)], (err, results) => {
    if (err) {
      console.error('查询章节失败:', err);
      return res.status(500).json({ success: false, message: '查询章节失败' });
    }
    
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
    
    db.query(updateQuery, [parseInt(chapterId)], (updateErr, updateResult) => {
      if (updateErr) {
        console.error('提交章节审核失败:', updateErr);
        return res.status(500).json({ success: false, message: '提交章节审核失败' });
      }
      
      res.json({ success: true, message: '章节已提交审核' });
    });
  });
});

// 获取小说的卷列表（用于章节管理）
router.get('/novels/:novelId/volumes', (req, res) => {
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
  
  db.query(query, [parseInt(novelId)], (err, results) => {
    if (err) {
      console.error('获取卷列表失败:', err);
      return res.status(500).json({ success: false, message: '获取卷列表失败' });
    }
    
    res.json({ success: true, data: results });
  });
});

// 更新章节所属卷
router.patch('/chapter/:chapterId/volume', (req, res) => {
  const { chapterId } = req.params;
  const { volume_id } = req.body;
  
  // 先检查章节是否存在
  const checkQuery = 'SELECT id, novel_id FROM chapter WHERE id = ?';
  
  db.query(checkQuery, [parseInt(chapterId)], (err, results) => {
    if (err) {
      console.error('查询章节失败:', err);
      return res.status(500).json({ success: false, message: '查询章节失败' });
    }
    
    if (results.length === 0) {
      return res.status(404).json({ success: false, message: '章节不存在' });
    }
    
    const novelId = results[0].novel_id;
    
    // 如果指定了volume_id，验证卷是否存在
    if (volume_id !== null && volume_id !== undefined) {
      const volumeCheckQuery = 'SELECT id FROM volume WHERE id = ? AND novel_id = ?';
      db.query(volumeCheckQuery, [parseInt(volume_id), novelId], (volErr, volResults) => {
        if (volErr) {
          console.error('查询卷失败:', volErr);
          return res.status(500).json({ success: false, message: '查询卷失败' });
        }
        
        if (volResults.length === 0) {
          return res.status(400).json({ success: false, message: '指定的卷不存在' });
        }
        
        // 更新章节的volume_id
        updateChapterVolume(chapterId, volume_id, res);
      });
    } else {
      // volume_id为null，表示"无卷"
      updateChapterVolume(chapterId, null, res);
    }
  });
});

function updateChapterVolume(chapterId, volumeId, res) {
  const updateQuery = `
    UPDATE chapter 
    SET volume_id = ?
    WHERE id = ?
  `;
  
  db.query(updateQuery, [volumeId, parseInt(chapterId)], (updateErr, updateResult) => {
    if (updateErr) {
      console.error('更新章节卷失败:', updateErr);
      return res.status(500).json({ success: false, message: '更新章节卷失败' });
    }
    
    res.json({ success: true, message: '卷轴已更新' });
  });
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
      releaseDate = new Date().toISOString().slice(0, 19).replace('T', ' '); // 当前时间
    }
  }

  try {
    // 判断是前50章节还是第50章节之后
    let isAdvance, keyCost, unlockPrice;

    if (chapterNumber <= 50) {
      // 前50章节：免费章节
      isAdvance = 0;
      keyCost = 0;
      unlockPrice = 0;
    } else {
      // 第50章节之后：收费章节
      keyCost = 1;

      // 处理 is_advance 逻辑
      // 1. 查询小说的 champion_status
      const novelResults = await new Promise((resolve, reject) => {
        db.query('SELECT champion_status FROM novel WHERE id = ?', [novelId], (err, results) => {
          if (err) reject(err);
          else resolve(results);
        });
      });

      const championStatus = novelResults[0]?.champion_status || 'invalid';

      console.log(`Novel ${novelId} champion_status: ${championStatus}`);

      if (championStatus === 'approved') {
        // 2. 查询最大 tier_level 的 advance_chapters 值（设为A）
        // 先找到最大 tier_level，然后获取该 tier_level 的 advance_chapters
        const tierResults = await new Promise((resolve, reject) => {
          db.query(`
            SELECT advance_chapters
            FROM novel_champion_tiers
            WHERE novel_id = ? AND is_active = 1
              AND tier_level = (
                SELECT MAX(tier_level)
                FROM novel_champion_tiers
                WHERE novel_id = ? AND is_active = 1
              )
            LIMIT 1
          `, [novelId, novelId], (err, results) => {
            if (err) reject(err);
            else resolve(results);
          });
        });

        const maxAdvanceChapters = tierResults[0]?.advance_chapters || 0;
        console.log(`Max advance chapters: ${maxAdvanceChapters}`);

        if (maxAdvanceChapters > 0) {
          // 3. 查询该小说 chapter 表中 is_advance=1 的数据条数（设为B）
          const advanceCountResults = await new Promise((resolve, reject) => {
            db.query(`
              SELECT COUNT(*) as count
              FROM chapter
              WHERE novel_id = ? AND is_advance = 1
            `, [novelId], (err, results) => {
              if (err) reject(err);
              else resolve(results);
            });
          });

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
            const oldAdvanceChapters = await new Promise((resolve, reject) => {
              db.query(`
                SELECT id
                FROM chapter
                WHERE novel_id = ? AND is_advance = 1
                ORDER BY chapter_number DESC
                LIMIT 1 OFFSET ?
              `, [novelId, maxAdvanceChapters], (err, results) => {
                if (err) reject(err);
                else resolve(results);
              });
            });

            if (oldAdvanceChapters && oldAdvanceChapters.length > 0) {
              // 更新倒数第 A+1 条数据的 is_advance=0
              await new Promise((resolve, reject) => {
                db.query(`
                  UPDATE chapter
                  SET is_advance = 0
                  WHERE id = ?
                `, [oldAdvanceChapters[0].id], (err, results) => {
                  if (err) reject(err);
                  else resolve(results);
                });
              });
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

      // 处理 unlock_price 逻辑
      // 1. 先获取 user_id
      const novelUserResults = await new Promise((resolve, reject) => {
        db.query('SELECT user_id FROM novel WHERE id = ?', [novelId], (err, results) => {
          if (err) reject(err);
          else resolve(results);
        });
      });

      // 检查查询结果
      if (!novelUserResults || novelUserResults.length === 0) {
        return res.status(404).json({ success: false, message: 'Novel not found' });
      }

      const userId = novelUserResults[0]?.user_id;
      
      if (!userId) {
        // 如果 novel.user_id 为 NULL，直接返回错误
        return res.status(400).json({ success: false, message: 'Novel user not found' });
      }

      // 2. 查询 unlockprice 表（新版本：按字数计价）
      const unlockPriceResults = await new Promise((resolve, reject) => {
        db.query(`
          SELECT karma_per_1000, min_karma, max_karma, default_free_chapters
          FROM unlockprice
          WHERE novel_id = ? AND user_id = ?
          LIMIT 1
        `, [novelId, userId], (err, results) => {
          if (err) reject(err);
          else resolve(results);
        });
      });

        if (!unlockPriceResults || unlockPriceResults.length === 0) {
          // 如果没有数据，创建一条默认数据（使用ON DUPLICATE KEY UPDATE防止重复）
          try {
            await new Promise((resolve, reject) => {
              db.query(`
                INSERT INTO unlockprice (user_id, novel_id, karma_per_1000, min_karma, max_karma, default_free_chapters, pricing_style)
                VALUES (?, ?, 6, 5, 30, 50, 'per_word')
                ON DUPLICATE KEY UPDATE updated_at = NOW()
              `, [userId, novelId], (err, results) => {
                if (err) reject(err);
                else resolve(results);
              });
            });
            // 使用默认配置计算价格
            const config = { karma_per_1000: 6, min_karma: 5, max_karma: 30, default_free_chapters: 50 };
            unlockPrice = calculateChapterPrice(chapterNumber, wordCount || 0, config);
          } catch (err) {
            console.error('创建 unlockprice 记录失败:', err);
            // 使用默认值计算
            const config = { karma_per_1000: 6, min_karma: 5, max_karma: 30, default_free_chapters: 50 };
            unlockPrice = calculateChapterPrice(chapterNumber, wordCount || 0, config);
          }
        } else {
          const config = unlockPriceResults[0];
          unlockPrice = calculateChapterPrice(chapterNumber, wordCount || 0, config);
        }
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

    db.query(query, values, (err, result) => {
      if (err) {
        console.error('创建章节失败:', err);
        return res.status(500).json({ success: false, message: 'Failed to create chapter', error: err.message });
      }

      const newChapterId = result.insertId;

      // 如果是定时发布，插入scheduledrelease表
      if (releaseDate && isReleased === 0) {
        const scheduledReleaseQuery = `
          INSERT INTO scheduledrelease (novel_id, chapter_id, release_time, is_released)
          VALUES (?, ?, ?, 0)
        `;
        
        db.query(scheduledReleaseQuery, [novelId, newChapterId, releaseDate], (scheduledErr) => {
          if (scheduledErr) {
            console.error('创建定时发布记录失败:', scheduledErr);
            // 即使scheduledrelease插入失败，也返回成功（章节已创建）
          }
        });
      }

      // 如果章节已发布（is_released === 1 且 release_date 不为空），记录字数变更
      if (isReleased === 1 && releaseDate) {
        // 获取作者ID
        db.query('SELECT user_id FROM novel WHERE id = ? LIMIT 1', [novelId], async (authorErr, authorResults) => {
          if (!authorErr && authorResults && authorResults.length > 0) {
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
        });
      }

      res.json({ 
        success: true, 
        message: 'Chapter created successfully',
        chapter_id: newChapterId
      });
    });
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
    const [oldRows] = await new Promise((resolve, reject) => {
      db.query(
        'SELECT novel_id, is_released, word_count, release_date FROM chapter WHERE id = ? LIMIT 1',
        [chapterId],
        (err, results) => {
          if (err) reject(err);
          else resolve(results);
        }
      );
    });
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
    updateValues.push(new Date().toISOString().slice(0, 19).replace('T', ' '));
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
  // 使用立即执行函数（IIFE）来异步处理
  if ((action === 'publish' || action === 'schedule') && chapterNumber) {
    // 先获取章节信息，然后计算unlock_price
    db.query('SELECT novel_id FROM chapter WHERE id = ?', [parseInt(chapterId)], async (chapterErr, chapterResults) => {
      if (chapterErr || !chapterResults || chapterResults.length === 0) {
        console.error('无法获取章节信息:', chapterErr);
        return;
      }

      const currentNovelId = chapterResults[0].novel_id;
      const currentChapterNumber = parseInt(chapterNumber);

      try {
        // 获取user_id
        const novelInfo = await new Promise((resolve, reject) => {
          db.query('SELECT user_id FROM novel WHERE id = ?', [currentNovelId], (err, results) => {
            if (err) reject(err);
            else resolve(results[0]);
          });
        });

        if (!novelInfo || !novelInfo.user_id) {
          console.error('无法获取小说信息');
          return;
        }

        const userId = novelInfo.user_id;

        // 查询unlockprice表
        const unlockPriceResults = await new Promise((resolve, reject) => {
          db.query(`
            SELECT karma_per_1000, min_karma, max_karma, default_free_chapters
            FROM unlockprice
            WHERE novel_id = ? AND user_id = ?
            LIMIT 1
          `, [currentNovelId, userId], (err, results) => {
            if (err) reject(err);
            else resolve(results);
          });
        });

        let unlockPrice = 0;
        if (!unlockPriceResults || unlockPriceResults.length === 0) {
          // 如果没有数据，创建一条默认数据（使用ON DUPLICATE KEY UPDATE防止重复）
          try {
            await new Promise((resolve, reject) => {
              db.query(`
                INSERT INTO unlockprice (user_id, novel_id, karma_per_1000, min_karma, max_karma, default_free_chapters, pricing_style)
                VALUES (?, ?, 6, 5, 30, 50, 'per_word')
                ON DUPLICATE KEY UPDATE updated_at = NOW()
              `, [userId, currentNovelId], (err, results) => {
                if (err) reject(err);
                else resolve(results);
              });
            });
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
        db.query('UPDATE chapter SET unlock_price = ? WHERE id = ?', [unlockPrice, parseInt(chapterId)], (updateErr) => {
          if (updateErr) {
            console.error('更新unlock_price失败:', updateErr);
          }
        });
      } catch (error) {
        console.error('计算unlock_price时出错:', error);
      }
    });
  }
  
  if (updateFields.length === 0) {
    return res.status(400).json({ success: false, message: 'No fields to update' });
  }
  
  updateValues.push(parseInt(chapterId));

  const updateQuery = `UPDATE chapter SET ${updateFields.join(', ')} WHERE id = ?`;

  db.query(updateQuery, updateValues, (err, result) => {
    if (err) {
      console.error('更新章节失败:', err);
      return res.status(500).json({ success: false, message: 'Failed to update chapter', error: err.message });
    }

    // 处理scheduledrelease表
    if (action === 'schedule' && release_date) {
      // 检查是否已存在定时发布记录
      const checkQuery = `SELECT id FROM scheduledrelease WHERE chapter_id = ? LIMIT 1`;
      db.query(checkQuery, [parseInt(chapterId)], (checkErr, checkResults) => {
        if (checkErr) {
          console.error('检查定时发布记录失败:', checkErr);
          return;
        }
        
        if (checkResults && checkResults.length > 0) {
          // 更新现有记录
          const updateQuery = `
            UPDATE scheduledrelease
            SET release_time = ?, is_released = 0, updated_at = CURRENT_TIMESTAMP
            WHERE chapter_id = ?
          `;
          db.query(updateQuery, [release_date, parseInt(chapterId)], (updateErr) => {
            if (updateErr) {
              console.error('更新定时发布记录失败:', updateErr);
            }
          });
        } else {
          // 插入新记录
          const insertQuery = `
            INSERT INTO scheduledrelease (novel_id, chapter_id, release_time, is_released)
            VALUES (?, ?, ?, 0)
          `;
          db.query(insertQuery, [parseInt(novelId) || 0, parseInt(chapterId), release_date], (insertErr) => {
            if (insertErr) {
              console.error('创建定时发布记录失败:', insertErr);
            }
          });
        }
      });
    } else if (action === 'publish') {
      // 立即发布时，检查章节是否是从定时发布状态转为立即发布
      // 如果是，需要更新scheduledrelease表的is_released=1
      // 如果是从草稿状态直接发布，scheduledrelease表中没有数据，不需要处理
      const checkScheduledQuery = `SELECT id FROM scheduledrelease WHERE chapter_id = ? LIMIT 1`;
      db.query(checkScheduledQuery, [parseInt(chapterId)], (checkErr, checkResults) => {
        if (checkErr) {
          console.error('检查定时发布记录失败:', checkErr);
          return;
        }
        
        // 如果存在定时发布记录，则更新为已发布
        if (checkResults && checkResults.length > 0) {
          const updateScheduledQuery = `
            UPDATE scheduledrelease
            SET is_released = 1, updated_at = CURRENT_TIMESTAMP
            WHERE chapter_id = ?
          `;
          
          db.query(updateScheduledQuery, [parseInt(chapterId)], (updateScheduledErr) => {
            if (updateScheduledErr) {
              console.error('更新定时发布记录失败:', updateScheduledErr);
            }
          });
        }
        // 如果不存在定时发布记录（从草稿直接发布），不需要处理scheduledrelease表
      });
    }

    // 更新完成后，再查一次最新章节状态（保证拿到数据库中的最终值）
    db.query(
      'SELECT novel_id, is_released, word_count, release_date FROM chapter WHERE id = ? LIMIT 1',
      [parseInt(chapterId)],
      async (queryErr, newRows) => {
        if (queryErr) {
          console.error('查询章节新状态失败:', queryErr);
          return res.json({ 
            success: true, 
            message: 'Chapter updated successfully'
          });
        }

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
            // 获取作者ID
            db.query('SELECT user_id FROM novel WHERE id = ? LIMIT 1', [newChapter.novel_id], async (authorErr, authorResults) => {
              if (!authorErr && authorResults && authorResults.length > 0) {
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
            });
          }
        }

        res.json({ 
          success: true, 
          message: 'Chapter updated successfully'
        });
      }
    );
  });
});

// 获取章节详情
router.get('/chapter/:chapterId', (req, res) => {
  const { chapterId } = req.params;

  const query = `
    SELECT 
      c.id,
      c.novel_id,
      c.volume_id,
      c.chapter_number,
      c.title,
      c.content,
      c.unlock_price,
      c.translator_note,
      c.review_status,
      c.word_count,
      c.is_released,
      c.release_date,
      c.created_at,
      n.title as novel_title,
      n.author,
      n.translator,
      v.title as volume_title,
      (SELECT id
       FROM chapter
       WHERE novel_id = c.novel_id
         AND review_status = 'approved'
         AND chapter_number < c.chapter_number
       ORDER BY chapter_number DESC
       LIMIT 1) AS prev_chapter_id,
      (SELECT id
       FROM chapter
       WHERE novel_id = c.novel_id
         AND review_status = 'approved'
         AND chapter_number > c.chapter_number
       ORDER BY chapter_number ASC
       LIMIT 1) AS next_chapter_id
    FROM chapter c
    JOIN novel n ON c.novel_id = n.id
    LEFT JOIN volume v ON c.volume_id = v.id AND v.novel_id = c.novel_id
    WHERE c.id = ?
  `;

  db.query(query, [parseInt(chapterId)], (err, results) => {
    if (err) {
      console.error('获取章节详情失败:', err);
      return res.status(500).json({ success: false, message: 'Failed to get chapter' });
    }

    if (results.length === 0) {
      return res.status(404).json({ success: false, message: 'Chapter not found' });
    }

    const chapter = results[0];
    
    console.log('📖 [novelCreation.js] ========== 章节数据查询结果 ==========');
    console.log('📖 [novelCreation.js] 章节ID:', chapter.id);
    console.log('📖 [novelCreation.js] 章节标题:', chapter.title);
    console.log('📖 [novelCreation.js] unlock_price (数据库原始值):', chapter.unlock_price);
    console.log('📖 [novelCreation.js] unlock_price (类型):', typeof chapter.unlock_price);
    console.log('📖 [novelCreation.js] unlock_price === null?:', chapter.unlock_price === null);
    console.log('📖 [novelCreation.js] unlock_price === undefined?:', chapter.unlock_price === undefined);
    console.log('📖 [novelCreation.js] unlock_price > 0?:', (chapter.unlock_price && chapter.unlock_price > 0));
    console.log('📖 [novelCreation.js] ======================================');
    
    // 处理 prev_chapter_id 和 next_chapter_id
    const prevId = (chapter.prev_chapter_id !== null && chapter.prev_chapter_id !== undefined) 
      ? chapter.prev_chapter_id 
      : null;
    const nextId = (chapter.next_chapter_id !== null && chapter.next_chapter_id !== undefined) 
      ? chapter.next_chapter_id 
      : null;
    
    // 构建返回对象，包含导航字段
    const responseData = {
      ...chapter,
      prev_chapter_id: prevId,
      next_chapter_id: nextId,
      has_prev: Boolean(prevId),
      has_next: Boolean(nextId)
    };

    console.log('📖 [novelCreation.js] ========== 返回给前端的数据 ==========');
    console.log('📖 [novelCreation.js] responseData.unlock_price:', responseData.unlock_price);
    console.log('📖 [novelCreation.js] responseData.unlock_price (类型):', typeof responseData.unlock_price);
    console.log('📖 [novelCreation.js] ======================================');

    res.json({ success: true, data: responseData });
  });
});

// 删除章节
router.delete('/chapter/:chapterId', (req, res) => {
  const { chapterId } = req.params;

  // 首先检查章节是否存在
  const checkQuery = `SELECT id, novel_id, chapter_number, title FROM chapter WHERE id = ?`;
  
  db.query(checkQuery, [parseInt(chapterId)], (err, results) => {
    if (err) {
      console.error('检查章节失败:', err);
      return res.status(500).json({ success: false, message: 'Failed to check chapter' });
    }

    if (results.length === 0) {
      return res.status(404).json({ success: false, message: 'Chapter not found' });
    }

    const chapter = results[0];

    // 删除章节
    const deleteQuery = `DELETE FROM chapter WHERE id = ?`;
    
    db.query(deleteQuery, [parseInt(chapterId)], (deleteErr) => {
      if (deleteErr) {
        console.error('删除章节失败:', deleteErr);
        return res.status(500).json({ success: false, message: 'Failed to delete chapter' });
      }

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
    });
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
  
  db.query(countQuery, [parseInt(novelId)], (countErr, countResults) => {
    if (countErr) {
      console.error('获取付费章节总数失败:', countErr);
      return res.status(500).json({ success: false, message: '获取章节总数失败' });
    }
    
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
    
    db.query(query, [parseInt(novelId), limit, offset], (err, results) => {
      if (err) {
        console.error('获取付费章节列表失败:', err);
        return res.status(500).json({ success: false, message: '获取付费章节列表失败' });
      }
      
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
    });
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
  
  db.query(getConfigQuery, [parseInt(novel_id), parseInt(user_id)], (configErr, configResults) => {
    if (configErr) {
      console.error('获取unlockprice配置失败:', configErr);
      return res.status(500).json({ success: false, message: '获取价格配置失败' });
    }
    
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
    
    db.query(getChaptersQuery, [parseInt(novel_id)], (err, chapters) => {
      if (err) {
        console.error('获取章节列表失败:', err);
        return res.status(500).json({ success: false, message: '获取章节列表失败' });
      }
      
      if (chapters.length === 0) {
        return res.json({ success: true, message: '没有需要更新的章节', updated: 0 });
      }
      
      // 批量更新
      let updatedCount = 0;
      let errorCount = 0;
      let completedCount = 0;
      
      chapters.forEach((chapter) => {
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
        
        db.query(updateQuery, [newPrice, chapter.word_count || 0, chapter.id], (updateErr) => {
          completedCount++;
          
          if (updateErr) {
            console.error(`更新章节 ${chapter.id} 失败:`, updateErr);
            errorCount++;
          } else {
            updatedCount++;
          }
          
          // 当所有更新完成时
          if (completedCount === chapters.length) {
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
          }
        });
      });
    });
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
  
  db.query(updateQuery, [parseInt(unlock_price), parseInt(chapter_id)], (err, result) => {
    if (err) {
      console.error('更新章节解锁价格失败:', err);
      return res.status(500).json({ success: false, message: '更新章节解锁价格失败' });
    }
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: '章节不存在' });
    }
    
    res.json({ success: true, message: '章节解锁价格更新成功' });
  });
});

module.exports = router;

