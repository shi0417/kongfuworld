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
    
    // 获取基础配置
    const [configs] = await db.execute(`
      SELECT * FROM novel_champion_config WHERE novel_id = ?
    `, [novelId]);

    // 获取等级配置
    const [tiers] = await db.execute(`
      SELECT * FROM novel_champion_tiers 
      WHERE novel_id = ? AND is_active = 1 
      ORDER BY tier_level ASC
    `, [novelId]);

    // 如果没有配置，创建默认配置
    if (configs.length === 0) {
      await createDefaultChampionConfig(novelId);
      
      // 重新获取配置
      const [newConfigs] = await db.execute(`
        SELECT * FROM novel_champion_config WHERE novel_id = ?
      `, [novelId]);
      
      const [newTiers] = await db.execute(`
        SELECT * FROM novel_champion_tiers 
        WHERE novel_id = ? AND is_active = 1 
        ORDER BY tier_level ASC
      `, [novelId]);

      return res.json({
        success: true,
        data: {
          config: newConfigs[0],
          tiers: newTiers
        }
      });
    }

    res.json({
      success: true,
      data: {
        config: configs[0],
        tiers: tiers
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '获取Champion配置失败',
      error: error.message
    });
  }
});

// 获取用户Champion状态
router.get('/status/:novelId', async (req, res) => {
  try {
    const { novelId } = req.params;
    const userId = req.user?.id || 1; // 临时使用用户ID 1，实际应该从认证中获取
    
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
  }
});

// 创建Champion订阅
router.post('/subscribe', async (req, res) => {
  try {
    const { novelId, tierLevel, paymentMethod } = req.body;
    const userId = req.user?.id || 1; // 临时使用用户ID 1
    
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
  }
});

// 创建默认Champion配置
async function createDefaultChampionConfig(novelId) {
  try {
    // 创建基础配置
    await db.execute(`
      INSERT INTO novel_champion_config 
      (novel_id, max_advance_chapters, total_chapters, published_chapters, 
       free_chapters_per_day, unlock_interval_hours, champion_theme, is_active)
      VALUES (?, 65, 0, 0, 2, 23, 'martial', 1)
    `, [novelId]);

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

module.exports = router;