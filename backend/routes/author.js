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

// 中间件：验证作者身份
const authenticateAuthor = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ success: false, message: '请先登录' });
    }

    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, 'your-secret-key');
    const userId = decoded.userId || decoded.id;

    if (!userId) {
      return res.status(401).json({ success: false, message: '请先登录' });
    }

    // 检查用户是否是作者
    const db = await mysql.createConnection(dbConfig);
    const [users] = await db.execute(
      'SELECT is_author FROM user WHERE id = ?',
      [userId]
    );
    await db.end();

    if (users.length === 0 || !users[0].is_author) {
      return res.status(403).json({ success: false, message: '您不是作者，无权访问' });
    }

    req.authorId = userId;
    req.userId = userId;
    next();
  } catch (error) {
    console.error('验证作者身份失败:', error);
    res.status(500).json({ success: false, message: '验证失败' });
  }
};

// ==================== 卷轴管理API ====================

// 创建新卷轴
router.post('/novels/:novelId/volumes', authenticateAuthor, async (req, res) => {
  let db;
  try {
    const { novelId } = req.params;
    const { volume_id, title } = req.body;
    const userId = req.userId;

    if (!title || !title.trim()) {
      return res.status(400).json({ success: false, message: '卷名不能为空' });
    }

    if (!volume_id || volume_id < 1) {
      return res.status(400).json({ success: false, message: '卷序号必须大于0' });
    }

    db = await mysql.createConnection(dbConfig);

    // 验证小说是否属于当前作者
    const [novels] = await db.execute(
      'SELECT id FROM novel WHERE id = ? AND user_id = ?',
      [novelId, userId]
    );

    if (novels.length === 0) {
      return res.status(403).json({ success: false, message: '无权操作该小说' });
    }

    // 检查卷序号是否已存在
    const [existing] = await db.execute(
      'SELECT id FROM volume WHERE novel_id = ? AND volume_id = ?',
      [novelId, volume_id]
    );

    if (existing.length > 0) {
      return res.status(400).json({ success: false, message: `第${volume_id}卷已存在` });
    }

    // 创建新卷
    const [result] = await db.execute(
      'INSERT INTO volume (novel_id, volume_id, title) VALUES (?, ?, ?)',
      [novelId, volume_id, title.trim()]
    );

    // 获取新创建的卷
    const [newVolume] = await db.execute(
      'SELECT id, novel_id, volume_id, title FROM volume WHERE id = ?',
      [result.insertId]
    );

    res.json({
      success: true,
      data: newVolume[0],
      message: '卷轴创建成功'
    });
  } catch (error) {
    console.error('创建卷轴失败:', error);
    res.status(500).json({
      success: false,
      message: '创建卷轴失败',
      error: error.message
    });
  } finally {
    if (db) await db.end();
  }
});

// 编辑卷轴
router.put('/novels/:novelId/volumes/:volumeId', authenticateAuthor, async (req, res) => {
  let db;
  try {
    const { novelId, volumeId } = req.params;
    const { volume_id, title } = req.body;
    const userId = req.userId;

    if (!title || !title.trim()) {
      return res.status(400).json({ success: false, message: '卷名不能为空' });
    }

    if (!volume_id || volume_id < 1) {
      return res.status(400).json({ success: false, message: '卷序号必须大于0' });
    }

    db = await mysql.createConnection(dbConfig);

    // 验证小说是否属于当前作者
    const [novels] = await db.execute(
      'SELECT id FROM novel WHERE id = ? AND user_id = ?',
      [novelId, userId]
    );

    if (novels.length === 0) {
      return res.status(403).json({ success: false, message: '无权操作该小说' });
    }

    // 验证卷是否存在且属于该小说
    const [volumes] = await db.execute(
      'SELECT id FROM volume WHERE id = ? AND novel_id = ?',
      [volumeId, novelId]
    );

    if (volumes.length === 0) {
      return res.status(404).json({ success: false, message: '卷轴不存在' });
    }

    // 如果修改了卷序号，检查新序号是否已存在
    if (volume_id !== undefined) {
      const [existing] = await db.execute(
        'SELECT id FROM volume WHERE novel_id = ? AND volume_id = ? AND id != ?',
        [novelId, volume_id, volumeId]
      );

      if (existing.length > 0) {
        return res.status(400).json({ success: false, message: `第${volume_id}卷已存在` });
      }
    }

    // 更新卷信息
    await db.execute(
      'UPDATE volume SET volume_id = ?, title = ? WHERE id = ?',
      [volume_id, title.trim(), volumeId]
    );

    // 获取更新后的卷
    const [updatedVolume] = await db.execute(
      'SELECT id, novel_id, volume_id, title FROM volume WHERE id = ?',
      [volumeId]
    );

    res.json({
      success: true,
      data: updatedVolume[0],
      message: '卷轴更新成功'
    });
  } catch (error) {
    console.error('更新卷轴失败:', error);
    res.status(500).json({
      success: false,
      message: '更新卷轴失败',
      error: error.message
    });
  } finally {
    if (db) await db.end();
  }
});

// 批量更新章节卷轴（按勾选）
router.post('/chapters/batch/update-volume', authenticateAuthor, async (req, res) => {
  let db;
  try {
    const { chapter_ids, volume_id } = req.body;
    const userId = req.userId;

    if (!chapter_ids || !Array.isArray(chapter_ids) || chapter_ids.length === 0) {
      return res.status(400).json({ success: false, message: '请选择要更新的章节' });
    }

    db = await mysql.createConnection(dbConfig);

    // 验证所有章节是否属于当前作者的小说
    const placeholders = chapter_ids.map(() => '?').join(',');
    const [chapters] = await db.execute(
      `SELECT c.id, c.novel_id, n.user_id 
       FROM chapter c 
       JOIN novel n ON c.novel_id = n.id 
       WHERE c.id IN (${placeholders})`,
      chapter_ids
    );

    if (chapters.length !== chapter_ids.length) {
      return res.status(400).json({ success: false, message: '部分章节不存在' });
    }

    // 检查是否所有章节都属于当前作者
    const unauthorizedChapters = chapters.filter(ch => ch.user_id !== userId);
    if (unauthorizedChapters.length > 0) {
      return res.status(403).json({ success: false, message: '无权操作部分章节' });
    }

    // 如果指定了volume_id，验证卷是否存在
    if (volume_id !== null && volume_id !== undefined) {
      const novelIds = [...new Set(chapters.map(ch => ch.novel_id))];
      for (const novelId of novelIds) {
        const [volumes] = await db.execute(
          'SELECT id FROM volume WHERE id = ? AND novel_id = ?',
          [volume_id, novelId]
        );
        if (volumes.length === 0) {
          return res.status(400).json({ success: false, message: '指定的卷轴不存在' });
        }
      }
    }

    // 批量更新章节的volume_id
    const updatePlaceholders = chapter_ids.map(() => '?').join(',');
    await db.execute(
      `UPDATE chapter SET volume_id = ? WHERE id IN (${updatePlaceholders})`,
      [volume_id, ...chapter_ids]
    );

    res.json({
      success: true,
      message: '批量更新成功',
      data: { updated_count: chapter_ids.length }
    });
  } catch (error) {
    console.error('批量更新章节卷轴失败:', error);
    res.status(500).json({
      success: false,
      message: '批量更新失败',
      error: error.message
    });
  } finally {
    if (db) await db.end();
  }
});

// 批量更新章节卷轴（按章节号范围）
router.post('/chapters/batch/update-volume-by-range', authenticateAuthor, async (req, res) => {
  let db;
  try {
    const { novel_id, start_chapter, end_chapter, volume_id } = req.body;
    const userId = req.userId;

    if (!novel_id || !start_chapter || !end_chapter) {
      return res.status(400).json({ success: false, message: '参数不完整' });
    }

    if (start_chapter > end_chapter) {
      return res.status(400).json({ success: false, message: '起始章节号不能大于结束章节号' });
    }

    db = await mysql.createConnection(dbConfig);

    // 验证小说是否属于当前作者
    const [novels] = await db.execute(
      'SELECT id FROM novel WHERE id = ? AND user_id = ?',
      [novel_id, userId]
    );

    if (novels.length === 0) {
      return res.status(403).json({ success: false, message: '无权操作该小说' });
    }

    // 如果指定了volume_id，验证卷是否存在
    if (volume_id !== null && volume_id !== undefined) {
      const [volumes] = await db.execute(
        'SELECT id FROM volume WHERE id = ? AND novel_id = ?',
        [volume_id, novel_id]
      );
      if (volumes.length === 0) {
        return res.status(400).json({ success: false, message: '指定的卷轴不存在' });
      }
    }

    // 批量更新章节的volume_id
    const [result] = await db.execute(
      'UPDATE chapter SET volume_id = ? WHERE novel_id = ? AND chapter_number >= ? AND chapter_number <= ?',
      [volume_id, novel_id, start_chapter, end_chapter]
    );

    res.json({
      success: true,
      message: '批量更新成功',
      data: { updated_count: result.affectedRows }
    });
  } catch (error) {
    console.error('批量更新章节卷轴失败:', error);
    res.status(500).json({
      success: false,
      message: '批量更新失败',
      error: error.message
    });
  } finally {
    if (db) await db.end();
  }
});

// ==================== 作者端定价管理接口 ====================

// 获取小说的定价信息和价格预览
router.get('/novels/:novelId/pricing', authenticateAuthor, async (req, res) => {
  let db;
  try {
    const { novelId } = req.params;
    const authorId = req.authorId;
    
    db = await mysql.createConnection(dbConfig);
    
    // 验证小说所有权
    const [novels] = await db.execute(
      'SELECT id FROM novel WHERE id = ? AND user_id = ?',
      [novelId, authorId]
    );
    
    if (novels.length === 0) {
      return res.status(403).json({ success: false, message: '无权访问该小说' });
    }
    
    // 获取unlockprice配置
    const [configs] = await db.execute(
      'SELECT karma_per_1000, min_karma, max_karma, default_free_chapters FROM unlockprice WHERE novel_id = ? LIMIT 1',
      [novelId]
    );
    
    if (configs.length === 0) {
      return res.status(404).json({ success: false, message: '未找到价格配置' });
    }
    
    const unlockConfig = configs[0];
    
    // 获取当前生效的促销活动
    const now = new Date();
    const [activePromotions] = await db.execute(
      `SELECT id, promotion_type, discount_value, start_at, end_at, status 
       FROM pricing_promotion 
       WHERE novel_id = ? 
         AND status IN ('scheduled', 'active')
         AND start_at <= ? 
         AND end_at >= ?
       ORDER BY discount_value ASC, start_at DESC
       LIMIT 1`,
      [novelId, now, now]
    );
    
    const activePromotion = activePromotions.length > 0 ? activePromotions[0] : null;
    
    // 获取即将开始的活动
    const [nextPromotions] = await db.execute(
      `SELECT id, promotion_type, discount_value, start_at, end_at, status 
       FROM pricing_promotion 
       WHERE novel_id = ? 
         AND status = 'scheduled'
         AND start_at > ?
       ORDER BY start_at ASC
       LIMIT 1`,
      [novelId, now]
    );
    
    const nextPromotion = nextPromotions.length > 0 ? nextPromotions[0] : null;
    
    // 获取该小说的所有促销活动列表（按创建时间倒序）
    const [allPromotions] = await db.execute(
      `SELECT id, promotion_type, discount_value, start_at, end_at, status, 
              created_at, approved_at, remark, approved_by
       FROM pricing_promotion 
       WHERE novel_id = ?
       ORDER BY created_at DESC`,
      [novelId]
    );
    
    // 获取示例章节（第1章、第default_free+1章、第80章、第100章、第150章）
    const sampleChapterNumbers = [
      1,
      unlockConfig.default_free_chapters + 1,
      80,
      100,
      150
    ];
    
    const [sampleChapters] = await db.execute(
      `SELECT id, chapter_number, title, 
              CASE 
                WHEN word_count IS NULL OR word_count = 0 THEN LENGTH(REPLACE(COALESCE(content, ''), ' ', ''))
                ELSE word_count
              END as word_count
       FROM chapter 
       WHERE novel_id = ? AND chapter_number IN (?)
       ORDER BY chapter_number ASC`,
      [novelId, sampleChapterNumbers]
    );
    
    // 计算示例章节的价格
    const sampleChaptersWithPrices = sampleChapters.map(chapter => {
      // 计算基础价格
      let basePrice = 0;
      let reason = '';
      
      if (chapter.chapter_number <= unlockConfig.default_free_chapters) {
        basePrice = 0;
        reason = `前${unlockConfig.default_free_chapters}章免费`;
      } else {
        const words = chapter.word_count || 0;
        if (words <= 0) {
          basePrice = unlockConfig.min_karma;
          reason = '字数不足，使用最低价格';
        } else {
          basePrice = Math.ceil((words / 1000) * unlockConfig.karma_per_1000);
          basePrice = Math.max(basePrice, unlockConfig.min_karma);
          basePrice = Math.min(basePrice, unlockConfig.max_karma);
          reason = '按字数计算';
        }
      }
      
      // 应用促销
      let finalPrice = basePrice;
      if (basePrice > 0 && activePromotion) {
        const discount = activePromotion.discount_value;
        if (discount === 0) {
          finalPrice = 0;
          reason = '限时免费活动';
        } else {
          finalPrice = Math.ceil(basePrice * discount);
          if (finalPrice < 1) finalPrice = 1;
          reason = `活动${Math.round(discount * 100)}%折扣生效`;
        }
      }
      
      return {
        chapter_number: chapter.chapter_number,
        title: chapter.title,
        word_count: chapter.word_count || 0,
        base_price: basePrice,
        final_price: finalPrice,
        reason: reason
      };
    });
    
    res.json({
      success: true,
      data: {
        unlock_config: unlockConfig,
        active_promotion: activePromotion,
        next_promotion: nextPromotion,
        promotions: allPromotions || [],
        sample_chapters: sampleChaptersWithPrices,
        server_time: now.toISOString()
      }
    });
  } catch (error) {
    console.error('获取定价信息失败:', error);
    res.status(500).json({ success: false, message: '获取失败', error: error.message });
  } finally {
    if (db) await db.end();
  }
});

// 作者提交促销活动申请
router.post('/novels/:novelId/pricing-promotion-requests', authenticateAuthor, async (req, res) => {
  let db;
  try {
    const { novelId } = req.params;
    const authorId = req.authorId;
    const { promotion_type, discount_value, start_at, end_at, note } = req.body;
    
    // 验证参数
    if (!promotion_type || !start_at || !end_at) {
      return res.status(400).json({ success: false, message: '参数不完整' });
    }
    
    // 验证折扣值（作者只能申请0.3-1.0）
    if (promotion_type === 'discount') {
      if (discount_value < 0.3 || discount_value > 1.0) {
        return res.status(400).json({ success: false, message: '折扣值必须在0.3-1.0之间' });
      }
    } else if (promotion_type === 'free') {
      // 限时免费需要平台审核，作者只能申请
      // discount_value应该为0
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
    
    // 验证小说所有权
    const [novels] = await db.execute(
      'SELECT id FROM novel WHERE id = ? AND user_id = ?',
      [novelId, authorId]
    );
    
    if (novels.length === 0) {
      return res.status(403).json({ success: false, message: '无权访问该小说' });
    }
    
    // 检查时间冲突（排除已拒绝和已过期的活动）
    const [conflicts] = await db.execute(
      `SELECT id FROM pricing_promotion 
       WHERE novel_id = ? 
         AND status IN ('pending', 'approved', 'scheduled', 'active')
         AND (
           (start_at <= ? AND end_at >= ?) OR
           (start_at <= ? AND end_at >= ?) OR
           (start_at >= ? AND end_at <= ?)
         )`,
      [novelId, startTime, startTime, endTime, endTime, startTime, endTime]
    );
    
    if (conflicts.length > 0) {
      return res.status(400).json({ success: false, message: '该时间段已有其他促销活动，时间不能重复' });
    }
    
    // 插入促销申请
    const [result] = await db.execute(
      `INSERT INTO pricing_promotion 
       (novel_id, promotion_type, discount_value, start_at, end_at, status, created_by, created_role, remark)
       VALUES (?, ?, ?, ?, ?, 'pending', ?, 'author', ?)`,
      [
        novelId,
        promotion_type,
        promotion_type === 'free' ? 0 : discount_value,
        start_at,
        end_at,
        authorId,
        note || null
      ]
    );
    
    res.json({
      success: true,
      data: {
        request_id: result.insertId,
        status: 'pending'
      }
    });
  } catch (error) {
    console.error('提交促销申请失败:', error);
    res.status(500).json({ success: false, message: '提交失败', error: error.message });
  } finally {
    if (db) await db.end();
  }
});

// 作者删除促销活动申请（只能删除待审核状态的）
router.delete('/novels/:novelId/pricing-promotion-requests/:promotionId', authenticateAuthor, async (req, res) => {
  let db;
  try {
    const { novelId, promotionId } = req.params;
    const authorId = req.authorId;
    
    db = await mysql.createConnection(dbConfig);
    
    // 验证小说所有权
    const [novels] = await db.execute(
      'SELECT id FROM novel WHERE id = ? AND user_id = ?',
      [novelId, authorId]
    );
    
    if (novels.length === 0) {
      return res.status(403).json({ success: false, message: '无权访问该小说' });
    }
    
    // 检查促销活动是否存在且属于该作者
    const [promotions] = await db.execute(
      'SELECT id, status, created_by FROM pricing_promotion WHERE id = ? AND novel_id = ?',
      [promotionId, novelId]
    );
    
    if (promotions.length === 0) {
      return res.status(404).json({ success: false, message: '促销活动不存在' });
    }
    
    const promotion = promotions[0];
    
    // 只能删除自己创建的且状态为待审核的活动
    if (promotion.created_by !== authorId) {
      return res.status(403).json({ success: false, message: '无权删除该促销活动' });
    }
    
    // 只能删除待审核和已拒绝状态的活动
    if (promotion.status !== 'pending' && promotion.status !== 'rejected') {
      return res.status(400).json({ success: false, message: '只能删除待审核或已拒绝状态的促销活动' });
    }
    
    // 删除促销活动
    await db.execute(
      'DELETE FROM pricing_promotion WHERE id = ?',
      [promotionId]
    );
    
    res.json({
      success: true,
      message: '删除成功'
    });
  } catch (error) {
    console.error('删除促销活动失败:', error);
    res.status(500).json({ success: false, message: '删除失败', error: error.message });
  } finally {
    if (db) await db.end();
  }
});

// 作者修改促销活动申请（只能修改待审核状态的）
router.put('/novels/:novelId/pricing-promotion-requests/:promotionId', authenticateAuthor, async (req, res) => {
  let db;
  try {
    const { novelId, promotionId } = req.params;
    const authorId = req.authorId;
    const { promotion_type, discount_value, start_at, end_at, note } = req.body;
    
    // 验证参数
    if (!promotion_type || !start_at || !end_at) {
      return res.status(400).json({ success: false, message: '参数不完整' });
    }
    
    // 验证折扣值（作者只能申请0.3-1.0）
    if (promotion_type === 'discount') {
      if (discount_value < 0.3 || discount_value > 1.0) {
        return res.status(400).json({ success: false, message: '折扣值必须在0.3-1.0之间' });
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
    
    // 验证小说所有权
    const [novels] = await db.execute(
      'SELECT id FROM novel WHERE id = ? AND user_id = ?',
      [novelId, authorId]
    );
    
    if (novels.length === 0) {
      return res.status(403).json({ success: false, message: '无权访问该小说' });
    }
    
    // 检查促销活动是否存在且属于该作者
    const [promotions] = await db.execute(
      'SELECT id, status, created_by FROM pricing_promotion WHERE id = ? AND novel_id = ?',
      [promotionId, novelId]
    );
    
    if (promotions.length === 0) {
      return res.status(404).json({ success: false, message: '促销活动不存在' });
    }
    
    const promotion = promotions[0];
    
    // 只能修改自己创建的且状态为待审核的活动
    if (promotion.created_by !== authorId) {
      return res.status(403).json({ success: false, message: '无权修改该促销活动' });
    }
    
    if (promotion.status !== 'pending') {
      return res.status(400).json({ success: false, message: '只能修改待审核状态的促销活动' });
    }
    
    // 检查时间冲突（排除当前活动本身）
    const [conflicts] = await db.execute(
      `SELECT id FROM pricing_promotion 
       WHERE novel_id = ? 
         AND id != ?
         AND status IN ('pending', 'approved', 'scheduled', 'active')
         AND (
           (start_at <= ? AND end_at >= ?) OR
           (start_at <= ? AND end_at >= ?) OR
           (start_at >= ? AND end_at <= ?)
         )`,
      [novelId, promotionId, startTime, startTime, endTime, endTime, startTime, endTime]
    );
    
    if (conflicts.length > 0) {
      return res.status(400).json({ success: false, message: '该时间段已有其他促销活动，时间不能重复' });
    }
    
    // 更新促销活动
    await db.execute(
      `UPDATE pricing_promotion 
       SET promotion_type = ?, discount_value = ?, start_at = ?, end_at = ?, remark = ?, updated_at = NOW()
       WHERE id = ?`,
      [
        promotion_type,
        promotion_type === 'free' ? 0 : discount_value,
        start_at,
        end_at,
        note || null,
        promotionId
      ]
    );
    
    res.json({
      success: true,
      message: '修改成功'
    });
  } catch (error) {
    console.error('修改促销活动失败:', error);
    res.status(500).json({ success: false, message: '修改失败', error: error.message });
  } finally {
    if (db) await db.end();
  }
});

module.exports = router;

