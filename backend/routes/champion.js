const express = require('express');
const router = express.Router();
const mysql = require('mysql2/promise');

// 数据库连接配置
const dbConfig = {
  host: 'localhost',
  user: 'root',
  password: '123456',
  database: 'kongfuworld',
  charset: 'utf8mb4'
};

// 获取小说的Champion配置
router.get('/config/:novelId', async (req, res) => {
  let db;
  try {
    const { novelId } = req.params;
    db = await mysql.createConnection(dbConfig);

    // 获取等级配置（只从novel_champion_tiers表读取，不自动创建）
    const [tiers] = await db.execute(`
      SELECT * FROM novel_champion_tiers 
      WHERE novel_id = ? AND is_active = 1 
      ORDER BY tier_level ASC
    `, [novelId]);

    // 直接返回实际数据，即使为空也不自动创建
    // 前端会根据是否有数据来决定是否显示默认配置供用户编辑
    res.json({
      success: true,
      data: {
        tiers: tiers || []
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '获取Champion配置失败',
      error: error.message
    });
  } finally {
    if (db) await db.end();
  }
});

// 获取用户Champion状态
router.get('/status/:novelId', async (req, res) => {
  let db;
  try {
    const { novelId } = req.params;
    // 从请求头获取用户ID，如果没有则使用默认值
    const userId = req.headers['user-id'] || req.query.userId || 1;
    db = await mysql.createConnection(dbConfig);
    
    // 获取用户订阅状态
    const [subscriptions] = await db.execute(`
      SELECT ucs.*, nct.advance_chapters
      FROM user_champion_subscription ucs
      JOIN novel_champion_tiers nct ON ucs.novel_id = nct.novel_id AND ucs.tier_level = nct.tier_level
      WHERE ucs.user_id = ? AND ucs.novel_id = ? 
      AND ucs.is_active = 1 AND ucs.end_date > NOW()
      ORDER BY ucs.tier_level DESC
      LIMIT 1
    `, [userId, novelId]);

    if (subscriptions.length === 0) {
      return res.json({
        success: true,
        data: {
          isChampion: false,
          tier: null
        }
      });
    }

    const subscription = subscriptions[0];
    res.json({
      success: true,
      data: {
        isChampion: true,
        tier: {
          level: subscription.tier_level,
          name: subscription.tier_name,
          price: subscription.monthly_price,
          advanceChapters: subscription.advance_chapters,
          endDate: subscription.end_date
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '获取用户Champion状态失败',
      error: error.message
    });
  } finally {
    if (db) await db.end();
  }
});

// 获取用户所有Champion订阅记录
router.get('/user-subscriptions', async (req, res) => {
  let db;
  try {
    // 从请求头获取用户ID，如果没有则使用默认值
    const userId = req.headers['user-id'] || req.query.userId || 1;
    db = await mysql.createConnection(dbConfig);
    
    // 获取用户所有活跃的Champion订阅
    const [subscriptions] = await db.execute(`
      SELECT 
        ucs.id,
        ucs.novel_id,
        n.title as novel_title,
        ucs.tier_level,
        ucs.tier_name,
        ucs.monthly_price,
        ucs.start_date,
        ucs.end_date,
        ucs.payment_method,
        ucs.auto_renew,
        nct.advance_chapters,
        CASE 
          WHEN ucs.end_date > NOW() THEN 'active'
          WHEN ucs.end_date <= NOW() THEN 'expired'
          ELSE 'inactive'
        END as status
      FROM user_champion_subscription ucs
      JOIN novel n ON ucs.novel_id = n.id
      LEFT JOIN novel_champion_tiers nct ON ucs.novel_id = nct.novel_id AND ucs.tier_level = nct.tier_level
      WHERE ucs.user_id = ? AND ucs.is_active = 1
      ORDER BY ucs.end_date DESC, ucs.created_at DESC
    `, [userId]);

    res.json({
      success: true,
      data: {
        subscriptions: subscriptions,
        totalCount: subscriptions.length
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '获取用户Champion订阅记录失败',
      error: error.message
    });
  } finally {
    if (db) await db.end();
  }
});

// 创建Champion订阅
router.post('/subscribe', async (req, res) => {
  let db;
  try {
    const { novelId, tierLevel, paymentMethod } = req.body;
    const userId = req.user?.id || 1; // 临时使用用户ID 1
    db = await mysql.createConnection(dbConfig);
    
    // 获取等级信息
    const [tiers] = await db.execute(`
      SELECT * FROM novel_champion_tiers 
      WHERE novel_id = ? AND tier_level = ? AND is_active = 1
    `, [novelId, tierLevel]);

    if (tiers.length === 0) {
      return res.status(400).json({
        success: false,
        message: '无效的Champion等级'
      });
    }

    const tier = tiers[0];
    
    // 计算订阅时间
    const startDate = new Date();
    const endDate = new Date();
    endDate.setMonth(endDate.getMonth() + 1);

    // 开始事务
    await db.query('START TRANSACTION');

    try {
      // 删除现有订阅（如果存在）
      await db.execute(
        'DELETE FROM user_champion_subscription WHERE user_id = ? AND novel_id = ?',
        [userId, novelId]
      );

      // 创建新订阅
      await db.execute(`
        INSERT INTO user_champion_subscription 
        (user_id, novel_id, tier_level, tier_name, monthly_price, start_date, end_date, payment_method)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        userId, novelId, tierLevel, tier.tier_name, 
        tier.monthly_price, startDate, endDate, paymentMethod
      ]);

      await db.query('COMMIT');
      
      res.json({
        success: true,
        message: 'Champion订阅成功',
        data: {
          tier: {
            level: tierLevel,
            name: tier.tier_name,
            price: tier.monthly_price,
            advanceChapters: tier.advance_chapters,
            endDate: endDate
          }
        }
      });
    } catch (error) {
      await db.query('ROLLBACK');
      throw error;
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '创建Champion订阅失败',
      error: error.message
    });
  } finally {
    if (db) await db.end();
  }
});

// 创建默认Champion配置（只创建tiers配置）
async function createDefaultChampionConfig(novelId, db) {
  try {
    // 复制默认等级配置
    const [defaultTiers] = await db.execute(`
      SELECT * FROM default_champion_tiers WHERE is_active = 1 ORDER BY tier_level ASC
    `);

    for (const tier of defaultTiers) {
      await db.execute(`
        INSERT INTO novel_champion_tiers 
        (novel_id, tier_level, tier_name, monthly_price, advance_chapters, description, sort_order)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [
        novelId, tier.tier_level, tier.tier_name, tier.monthly_price,
        tier.advance_chapters, tier.description, tier.sort_order
      ]);
    }

    return true;
  } catch (error) {
    throw new Error(`创建默认Champion配置失败: ${error.message}`);
  }
}

// 获取默认Champion等级配置
router.get('/default-tiers', async (req, res) => {
  let db;
  try {
    db = await mysql.createConnection(dbConfig);
    
    const [tiers] = await db.execute(`
      SELECT * FROM default_champion_tiers 
      WHERE is_active = 1 
      ORDER BY tier_level ASC
    `);
    
    res.json({
      success: true,
      data: tiers
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '获取默认等级配置失败',
      error: error.message
    });
  } finally {
    if (db) await db.end();
  }
});

// 更新小说的Champion等级配置
router.put('/tiers/:novelId', async (req, res) => {
  let db;
  try {
    const { novelId } = req.params;
    const { tiers } = req.body;
    
    if (!Array.isArray(tiers)) {
      return res.status(400).json({
        success: false,
        message: 'tiers必须是一个数组'
      });
    }
    
    db = await mysql.createConnection(dbConfig);
    
    // 开始事务
    await db.query('START TRANSACTION');
    
    try {
      // 删除现有等级配置
      await db.execute(
        'DELETE FROM novel_champion_tiers WHERE novel_id = ?',
        [novelId]
      );
      
      // 插入新等级配置
      for (const tier of tiers) {
        await db.execute(
          `INSERT INTO novel_champion_tiers 
           (novel_id, tier_level, tier_name, monthly_price, advance_chapters, description, sort_order, is_active) 
           VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
          [
            novelId, 
            tier.tier_level, 
            tier.tier_name, 
            tier.monthly_price,
            tier.advance_chapters, 
            tier.description, 
            tier.tier_level // 使用tier_level作为sort_order
          ]
        );
      }
      
      await db.query('COMMIT');
      
      res.json({
        success: true,
        message: '会员等级配置更新成功'
      });
    } catch (error) {
      await db.query('ROLLBACK');
      throw error;
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '更新会员等级配置失败',
      error: error.message
    });
  } finally {
    if (db) await db.end();
  }
});

// 获取小说的Champion激活状态
router.get('/activation-status/:novelId', async (req, res) => {
  let db;
  try {
    const { novelId } = req.params;
    db = await mysql.createConnection(dbConfig);
    
    // 获取小说信息，包括champion_status
    const [novels] = await db.execute(`
      SELECT champion_status FROM novel WHERE id = ?
    `, [novelId]);
    
    if (novels.length === 0) {
      return res.status(404).json({
        success: false,
        message: '小说不存在'
      });
    }
    
    const championStatus = novels[0].champion_status || 'invalid';
    
    // 获取审核通过的章节数
    const [chapterCountResult] = await db.execute(`
      SELECT COUNT(*) as approved_count
      FROM chapter
      WHERE novel_id = ? AND review_status = 'approved'
    `, [novelId]);
    
    const approvedChapters = chapterCountResult[0].approved_count || 0;
    
    // 获取最高tier的advance_chapters（只从novel_champion_tiers表查询）
    const [novelTiers] = await db.execute(`
      SELECT MAX(advance_chapters) as max_advance
      FROM novel_champion_tiers
      WHERE novel_id = ? AND is_active = 1
    `, [novelId]);
    
    const maxAdvanceChapters = novelTiers[0]?.max_advance || 0;
    
    // 计算需要的章节数：50 + 最高tier的advance_chapters
    const requiredChapters = 50 + maxAdvanceChapters;
    
    // 检查条件1：大于100章节
    const meetsCondition1 = approvedChapters > 100;
    
    // 检查条件2：大于50+最高tier的advance_chapters
    const meetsCondition2 = approvedChapters > requiredChapters;
    
    // 是否可以申请（只有invalid状态且满足条件时才能申请）
    const canApply = championStatus === 'invalid' && meetsCondition1 && meetsCondition2;
    
    res.json({
      success: true,
      data: {
        approvedChapters,
        maxAdvanceChapters,
        requiredChapters,
        meetsCondition1,
        meetsCondition2,
        canApply,
        championStatus
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '获取激活状态失败',
      error: error.message
    });
  } finally {
    if (db) await db.end();
  }
});

// 提交Champion会员申请
router.post('/apply/:novelId', async (req, res) => {
  let db;
  try {
    const { novelId } = req.params;
    db = await mysql.createConnection(dbConfig);
    
    // 检查小说是否存在
    const [novels] = await db.execute(`
      SELECT champion_status FROM novel WHERE id = ?
    `, [novelId]);
    
    if (novels.length === 0) {
      return res.status(404).json({
        success: false,
        message: '小说不存在'
      });
    }
    
    const currentStatus = novels[0].champion_status || 'invalid';
    
    // 只有invalid状态才能申请
    if (currentStatus !== 'invalid') {
      return res.status(400).json({
        success: false,
        message: `当前状态为${currentStatus}，无法提交申请`
      });
    }
    
    // 再次验证条件
    const [chapterCountResult] = await db.execute(`
      SELECT COUNT(*) as approved_count
      FROM chapter
      WHERE novel_id = ? AND review_status = 'approved'
    `, [novelId]);
    
    const approvedChapters = chapterCountResult[0].approved_count || 0;
    
    // 获取最高tier的advance_chapters（只从novel_champion_tiers表查询）
    const [novelTiers] = await db.execute(`
      SELECT MAX(advance_chapters) as max_advance
      FROM novel_champion_tiers
      WHERE novel_id = ? AND is_active = 1
    `, [novelId]);
    
    const maxAdvanceChapters = novelTiers[0]?.max_advance || 0;
    
    const requiredChapters = 50 + maxAdvanceChapters;
    const meetsCondition1 = approvedChapters > 100;
    const meetsCondition2 = approvedChapters > requiredChapters;
    
    if (!meetsCondition1 || !meetsCondition2) {
      return res.status(400).json({
        success: false,
        message: '不满足激活条件，无法提交申请'
      });
    }
    
    // 更新champion_status为submitted
    await db.execute(`
      UPDATE novel
      SET champion_status = 'submitted'
      WHERE id = ?
    `, [novelId]);
    
    res.json({
      success: true,
      message: '申请已提交，等待审核'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '提交申请失败',
      error: error.message
    });
  } finally {
    if (db) await db.end();
  }
});

module.exports = router;
