const express = require('express');
const router = express.Router();
const mysql = require('mysql2/promise');

// 数据库配置
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '123456',
  database: process.env.DB_NAME || 'kongfuworld',
  charset: 'utf8mb4'
};

// ==================== UnlockPrice 配置管理 ====================

// 获取unlockprice配置
router.get('/unlockprice/novel/:novelId/user/:userId', async (req, res) => {
  let db;
  try {
    const { novelId, userId } = req.params;
    db = await mysql.createConnection(dbConfig);
    
    const [results] = await db.execute(
      'SELECT * FROM unlockprice WHERE novel_id = ? AND user_id = ?',
      [parseInt(novelId), parseInt(userId)]
    );
    
    if (results.length === 0) {
      return res.json({ success: false, message: '未找到配置' });
    }
    
    res.json({ success: true, data: results[0] });
  } catch (error) {
    console.error('获取unlockprice配置失败:', error);
    res.status(500).json({ success: false, message: '获取配置失败', error: error.message });
  } finally {
    if (db) await db.end();
  }
});

// 更新或创建unlockprice配置（新版本：按字数计价）
router.post('/unlockprice/update', async (req, res) => {
  let db;
  try {
    const { 
      user_id, 
      novel_id, 
      karma_per_1000, 
      min_karma, 
      max_karma, 
      default_free_chapters, 
      pricing_style 
    } = req.body;
    
    if (!user_id || !novel_id) {
      return res.status(400).json({ success: false, message: '用户ID和小说ID是必需的' });
    }
    
    // 验证必填字段
    if (!karma_per_1000 || karma_per_1000 < 1) {
      return res.status(400).json({ success: false, message: '每1000字karma数必须大于0' });
    }
    if (min_karma === undefined || min_karma < 0) {
      return res.status(400).json({ success: false, message: '最低karma必须大于等于0' });
    }
    if (max_karma === undefined || max_karma < min_karma) {
      return res.status(400).json({ success: false, message: '最高karma不能小于最低karma' });
    }
    if (default_free_chapters === undefined || default_free_chapters < 0) {
      return res.status(400).json({ success: false, message: '免费章节数必须大于等于0' });
    }
    
    db = await mysql.createConnection(dbConfig);
    
    // 先检查是否存在
    const [existing] = await db.execute(
      'SELECT id FROM unlockprice WHERE user_id = ? AND novel_id = ?',
      [parseInt(user_id), parseInt(novel_id)]
    );
    
    if (existing.length > 0) {
      // 更新现有记录
      await db.execute(
        `UPDATE unlockprice 
         SET karma_per_1000 = ?, 
             min_karma = ?, 
             max_karma = ?, 
             default_free_chapters = ?, 
             pricing_style = ?,
             updated_at = NOW()
         WHERE user_id = ? AND novel_id = ?`,
        [
          parseInt(karma_per_1000),
          parseInt(min_karma),
          parseInt(max_karma),
          parseInt(default_free_chapters),
          pricing_style || 'per_word',
          parseInt(user_id),
          parseInt(novel_id)
        ]
      );
      
      res.json({ success: true, message: '费用设定更新成功', data: { id: existing[0].id } });
    } else {
      // 创建新记录（使用ON DUPLICATE KEY UPDATE防止重复插入）
      const [result] = await db.execute(
        `INSERT INTO unlockprice 
         (user_id, novel_id, karma_per_1000, min_karma, max_karma, default_free_chapters, pricing_style)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE 
           karma_per_1000 = VALUES(karma_per_1000),
           min_karma = VALUES(min_karma),
           max_karma = VALUES(max_karma),
           default_free_chapters = VALUES(default_free_chapters),
           pricing_style = VALUES(pricing_style),
           updated_at = NOW()`,
        [
          parseInt(user_id),
          parseInt(novel_id),
          parseInt(karma_per_1000),
          parseInt(min_karma),
          parseInt(max_karma),
          parseInt(default_free_chapters),
          pricing_style || 'per_word'
        ]
      );
      
      res.json({ success: true, message: '费用设定创建成功', data: { id: result.insertId } });
    }
  } catch (error) {
    console.error('更新unlockprice配置失败:', error);
    res.status(500).json({ success: false, message: '更新配置失败', error: error.message });
  } finally {
    if (db) await db.end();
  }
});

// ==================== 价格计算服务 ====================

// 计算章节基础价格
function calculateBasePrice(chapterNumber, wordCount, config) {
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

// 应用促销折扣
function applyPromotion(basePrice, promotion) {
  // 免费章节，促销不再改变价格
  if (basePrice === 0) return basePrice;
  
  if (!promotion) {
    return basePrice;
  }
  
  const discount = promotion.discount_value;
  
  // 限时免费
  if (discount === 0) {
    return 0;
  }
  
  // 折扣价：向上取整，至少为1
  let discounted = Math.ceil(basePrice * discount);
  if (discounted < 1) discounted = 1;
  
  return discounted;
}

// 获取章节最终价格（包含促销）
router.get('/chapters/:chapterId/price', async (req, res) => {
  let db;
  try {
    const { chapterId } = req.params;
    db = await mysql.createConnection(dbConfig);
    
    // 获取章节信息（如果word_count为0则自动计算）
    const [chapters] = await db.execute(
      `SELECT 
         id, 
         novel_id, 
         chapter_number, 
         CASE 
           WHEN word_count IS NULL OR word_count = 0 THEN LENGTH(REPLACE(COALESCE(content, ''), ' ', ''))
           ELSE word_count
         END as word_count,
         content
       FROM chapter 
       WHERE id = ?`,
      [parseInt(chapterId)]
    );
    
    if (chapters.length === 0) {
      return res.status(404).json({ success: false, message: '章节不存在' });
    }
    
    const chapter = chapters[0];
    
    // 如果word_count为0，自动更新数据库
    if ((chapter.word_count === 0 || chapter.word_count === null) && chapter.content) {
      const wordCount = chapter.content.replace(/\s/g, '').length;
      if (wordCount > 0) {
        await db.execute(
          'UPDATE chapter SET word_count = ? WHERE id = ?',
          [wordCount, chapter.id]
        );
        chapter.word_count = wordCount;
      }
    }
    
    // 获取unlockprice配置
    const [configs] = await db.execute(
      'SELECT * FROM unlockprice WHERE novel_id = ? LIMIT 1',
      [chapter.novel_id]
    );
    
    if (configs.length === 0) {
      return res.status(404).json({ success: false, message: '未找到价格配置' });
    }
    
    const config = configs[0];
    
    // 计算基础价格
    const basePrice = calculateBasePrice(
      chapter.chapter_number,
      chapter.word_count || 0,
      config
    );
    
    // 查找当前生效的促销活动
    const now = new Date();
    const [promotions] = await db.execute(
      `SELECT * FROM pricing_promotion 
       WHERE novel_id = ? 
         AND status IN ('scheduled', 'active')
         AND start_at <= ? 
         AND end_at >= ?
       ORDER BY discount_value ASC, start_at DESC
       LIMIT 1`,
      [chapter.novel_id, now, now]
    );
    
    const promotion = promotions.length > 0 ? promotions[0] : null;
    
    // 应用促销
    const finalPrice = applyPromotion(basePrice, promotion);
    
    res.json({
      success: true,
      data: {
        basePrice,
        finalPrice,
        promotion: promotion ? {
          id: promotion.id,
          discount_value: promotion.discount_value,
          start_at: promotion.start_at,
          end_at: promotion.end_at
        } : null
      }
    });
  } catch (error) {
    console.error('获取章节价格失败:', error);
    res.status(500).json({ success: false, message: '获取价格失败', error: error.message });
  } finally {
    if (db) await db.end();
  }
});

// ==================== 批量更新章节价格 ====================

// 批量更新章节的unlock_price（根据新的价格配置）
router.post('/chapters/batch-update-unlock-price', async (req, res) => {
  let db;
  try {
    const { novel_id, unlockprice_config } = req.body;
    
    if (!novel_id || !unlockprice_config) {
      return res.status(400).json({ success: false, message: '参数不完整' });
    }
    
    const { karma_per_1000, min_karma, max_karma, default_free_chapters } = unlockprice_config;
    
    db = await mysql.createConnection(dbConfig);
    
    // 获取需要更新的章节（第default_free_chapters+1章及以后）
    // 如果word_count为0，自动从content计算
    const [chapters] = await db.execute(
      `SELECT 
         id, 
         chapter_number, 
         CASE 
           WHEN word_count IS NULL OR word_count = 0 THEN LENGTH(REPLACE(COALESCE(content, ''), ' ', ''))
           ELSE word_count
         END as word_count,
         content
       FROM chapter 
       WHERE novel_id = ? AND chapter_number > ?`,
      [parseInt(novel_id), parseInt(default_free_chapters || 50)]
    );
    
    // 如果发现有 word_count 为 0 的章节，自动更新数据库
    for (const chapter of chapters) {
      if ((chapter.word_count === 0 || chapter.word_count === null) && chapter.content) {
        const wordCount = chapter.content.replace(/\s/g, '').length;
        if (wordCount > 0) {
          await db.execute(
            'UPDATE chapter SET word_count = ? WHERE id = ?',
            [wordCount, chapter.id]
          );
          chapter.word_count = wordCount;
        }
      }
    }
    
    if (chapters.length === 0) {
      return res.json({ success: true, message: '没有需要更新的章节', updated: 0 });
    }
    
    // 批量更新
    let updatedCount = 0;
    let errorCount = 0;
    
    for (const chapter of chapters) {
      try {
        const basePrice = calculateBasePrice(
          chapter.chapter_number,
          chapter.word_count || 0,
          { karma_per_1000, min_karma, max_karma, default_free_chapters }
        );
        
        await db.execute(
          'UPDATE chapter SET unlock_price = ? WHERE id = ?',
          [basePrice, chapter.id]
        );
        
        updatedCount++;
      } catch (error) {
        console.error(`更新章节 ${chapter.id} 失败:`, error);
        errorCount++;
      }
    }
    
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
      message: `成功更新 ${updatedCount} 个章节的价格`,
      updated: updatedCount
    });
  } catch (error) {
    console.error('批量更新章节价格失败:', error);
    res.status(500).json({ success: false, message: '批量更新失败', error: error.message });
  } finally {
    if (db) await db.end();
  }
});

// ==================== 促销活动管理 ====================

// 获取小说的促销活动列表
router.get('/pricing-promotion/novel/:novelId', async (req, res) => {
  let db;
  try {
    const { novelId } = req.params;
    db = await mysql.createConnection(dbConfig);
    
    const [promotions] = await db.execute(
      'SELECT * FROM pricing_promotion WHERE novel_id = ? ORDER BY created_at DESC',
      [parseInt(novelId)]
    );
    
    res.json({ success: true, data: promotions });
  } catch (error) {
    console.error('获取促销活动列表失败:', error);
    res.status(500).json({ success: false, message: '获取列表失败', error: error.message });
  } finally {
    if (db) await db.end();
  }
});

// 申请促销活动（作者端）
router.post('/pricing-promotion/apply', async (req, res) => {
  let db;
  try {
    const { novel_id, promotion_type, discount_value, start_at, end_at, created_by, created_role } = req.body;
    
    if (!novel_id || discount_value === undefined || !start_at || !end_at || !created_by) {
      return res.status(400).json({ success: false, message: '参数不完整' });
    }
    
    // 确定 promotion_type（如果没有提供，默认为 discount）
    const finalPromotionType = promotion_type || 'discount';
    
    // 验证 promotion_type
    if (finalPromotionType !== 'discount' && finalPromotionType !== 'free') {
      return res.status(400).json({ success: false, message: 'promotion_type 必须是 discount 或 free' });
    }
    
    // 验证折扣值（作者只能申请0.3-1.0，限时免费为0）
    if (created_role === 'author') {
      if (finalPromotionType === 'free') {
        // 作者不能申请限时免费
        return res.status(400).json({ success: false, message: '作者不能申请限时免费活动' });
      }
      if (discount_value < 0.3 || discount_value > 1.0) {
        return res.status(400).json({ success: false, message: '作者只能申请0.3-1.0之间的折扣' });
      }
    }
    
    // 验证时间
    const startTime = new Date(start_at);
    const endTime = new Date(end_at);
    const now = new Date();
    
    if (startTime <= now) {
      return res.status(400).json({ success: false, message: '开始时间必须大于当前时间' });
    }
    
    if (endTime <= startTime) {
      return res.status(400).json({ success: false, message: '结束时间必须大于开始时间' });
    }
    
    db = await mysql.createConnection(dbConfig);
    
    // 检查是否有时间冲突的活动（待审核或已通过的活动）
    const [conflicts] = await db.execute(
      `SELECT id FROM pricing_promotion 
       WHERE novel_id = ? 
         AND status IN ('pending', 'approved', 'scheduled', 'active')
         AND (
           (start_at <= ? AND end_at >= ?) OR
           (start_at <= ? AND end_at >= ?) OR
           (start_at >= ? AND end_at <= ?)
         )`,
      [parseInt(novel_id), startTime, startTime, endTime, endTime, startTime, endTime]
    );
    
    if (conflicts.length > 0) {
      return res.status(400).json({ success: false, message: '该时间段已有其他促销活动' });
    }
    
    // 插入新活动
    const [result] = await db.execute(
      `INSERT INTO pricing_promotion 
       (novel_id, promotion_type, discount_value, start_at, end_at, status, created_by, created_role)
       VALUES (?, ?, ?, ?, ?, 'pending', ?, ?)`,
      [
        parseInt(novel_id),
        finalPromotionType,
        finalPromotionType === 'free' ? 0 : parseFloat(discount_value),
        startTime,
        endTime,
        parseInt(created_by),
        created_role || 'author'
      ]
    );
    
    res.json({
      success: true,
      message: '促销活动申请成功，等待审核',
      data: { id: result.insertId }
    });
  } catch (error) {
    console.error('申请促销活动失败:', error);
    res.status(500).json({ success: false, message: '申请失败', error: error.message });
  } finally {
    if (db) await db.end();
  }
});

// ==================== 章节列表（支持动态起始章节） ====================

// 获取付费章节列表（支持startChapter参数）
router.get('/chapters/novel/:novelId/paid', async (req, res) => {
  let db;
  try {
    const { novelId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const startChapter = parseInt(req.query.startChapter) || 51; // 默认从第51章开始
    const offset = (page - 1) * limit;
    
    db = await mysql.createConnection(dbConfig);
    
    // 先获取总数
    const [countResults] = await db.execute(
      `SELECT COUNT(*) as total
       FROM chapter
       WHERE novel_id = ? AND chapter_number >= ?`,
      [parseInt(novelId), startChapter]
    );
    
    const total = countResults[0].total;
    
    // 获取分页数据（包含word_count）
    const [chapters] = await db.execute(
      `SELECT 
         id,
         chapter_number,
         title,
         unlock_price,
         review_status,
         created_at,
         COALESCE(word_count, LENGTH(content)) as word_count
       FROM chapter
       WHERE novel_id = ? AND chapter_number >= ?
       ORDER BY chapter_number ASC
       LIMIT ? OFFSET ?`,
      [parseInt(novelId), startChapter, limit, offset]
    );
    
    res.json({
      success: true,
      data: chapters,
      pagination: {
        total: total,
        page: page,
        limit: limit,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('获取付费章节列表失败:', error);
    res.status(500).json({ success: false, message: '获取列表失败', error: error.message });
  } finally {
    if (db) await db.end();
  }
});

module.exports = router;

