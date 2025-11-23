const mysql = require('mysql2/promise');

class ChampionService {
  constructor() {
    this.db = mysql.createPool({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'kongfuworld'
    });
  }

  // 获取小说的Champion配置（只返回tiers配置）
  async getNovelChampionConfig(novelId) {
    try {
      // 获取等级配置
      const [tierRows] = await this.db.execute(
        'SELECT * FROM novel_champion_tiers WHERE novel_id = ? AND is_active = 1 ORDER BY sort_order',
        [novelId]
      );

      // 如果没有配置，创建默认配置
      if (tierRows.length === 0) {
        await this.copyDefaultTiersToNovel(novelId);
        // 重新获取
        const [newTierRows] = await this.db.execute(
          'SELECT * FROM novel_champion_tiers WHERE novel_id = ? AND is_active = 1 ORDER BY sort_order',
          [novelId]
        );
        return {
          tiers: newTierRows
        };
      }

      return {
        tiers: tierRows
      };
    } catch (error) {
      throw new Error(`获取Champion配置失败: ${error.message}`);
    }
  }

  // 为小说创建默认Champion配置（已废弃，使用copyDefaultTiersToNovel代替）
  async createDefaultChampionConfig(novelId) {
    // 直接复制默认等级配置
    await this.copyDefaultTiersToNovel(novelId);
    return {};
  }

  // 复制默认等级配置到指定小说
  async copyDefaultTiersToNovel(novelId) {
    try {
      // 获取默认等级配置
      const [defaultTiers] = await this.db.execute(
        'SELECT * FROM default_champion_tiers WHERE is_active = 1 ORDER BY sort_order'
      );

      // 插入到小说等级配置表
      for (const tier of defaultTiers) {
        await this.db.execute(
          `INSERT INTO novel_champion_tiers 
           (novel_id, tier_level, tier_name, monthly_price, advance_chapters, description, sort_order) 
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [novelId, tier.tier_level, tier.tier_name, tier.monthly_price, 
           tier.advance_chapters, tier.description, tier.sort_order]
        );
      }
    } catch (error) {
      throw new Error(`复制默认等级配置失败: ${error.message}`);
    }
  }

  // 更新小说Champion配置（已废弃，此方法不再使用）
  async updateNovelChampionConfig(novelId, configData) {
    // 不再更新config表，所有配置都在tiers表中
    return true;
  }

  // 更新Champion等级配置
  async updateChampionTiers(novelId, tiers) {
    try {
      // 开始事务
      await this.db.query('START TRANSACTION');

      try {
        // 删除现有等级配置
        await this.db.execute(
          'DELETE FROM novel_champion_tiers WHERE novel_id = ?',
          [novelId]
        );

        // 插入新等级配置
        for (const tier of tiers) {
          await this.db.execute(
            `INSERT INTO novel_champion_tiers 
             (novel_id, tier_level, tier_name, monthly_price, advance_chapters, description, sort_order) 
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [novelId, tier.level, tier.name, tier.price, tier.chapters, tier.description, tier.sort]
          );
        }

        // 不再需要标记config表

        await this.db.query('COMMIT');
        return true;
      } catch (error) {
        await this.db.query('ROLLBACK');
        throw error;
      }
    } catch (error) {
      throw new Error(`更新Champion等级配置失败: ${error.message}`);
    }
  }

  // 获取用户可访问的章节数
  async getUserAccessibleChapters(userId, novelId) {
    try {
      // 获取小说的总章节数（从chapter表统计）
      const [chapterCount] = await this.db.execute(
        `SELECT COUNT(*) as total FROM chapter 
         WHERE novel_id = ? AND review_status = 'approved'`,
        [novelId]
      );
      const totalChapters = chapterCount[0]?.total || 0;

      const { tiers } = await this.getNovelChampionConfig(novelId);
      
      // 检查用户Champion订阅
      const [subscriptionRows] = await this.db.execute(
        `SELECT tier_level, end_date FROM user_champion_subscription 
         WHERE user_id = ? AND novel_id = ? AND is_active = 1 AND end_date > NOW()`,
        [userId, novelId]
      );

      if (subscriptionRows.length === 0) {
        // 免费用户：返回总章节数（所有已审核通过的章节）
        return totalChapters;
      }

      // Champion用户：总章节数 + 预读章节数
      const subscription = subscriptionRows[0];
      const tier = tiers.find(t => t.tier_level === subscription.tier_level);
      
      if (!tier) {
        return totalChapters;
      }

      // 计算可访问章节：总章节数 + 预读章节数
      const accessibleChapters = totalChapters + tier.advance_chapters;

      return accessibleChapters;
    } catch (error) {
      throw new Error(`获取用户可访问章节失败: ${error.message}`);
    }
  }

  // 创建用户Champion订阅
  async createChampionSubscription(userId, novelId, tierLevel, paymentMethod = 'paypal') {
    try {
      const { tiers } = await this.getNovelChampionConfig(novelId);
      const tier = tiers.find(t => t.tier_level === tierLevel);
      
      if (!tier) {
        throw new Error('无效的Champion等级');
      }

      const startDate = new Date();
      const endDate = new Date();
      endDate.setMonth(endDate.getMonth() + 1); // 一个月后过期

      // 检查是否已有订阅
      const [existingRows] = await this.db.execute(
        'SELECT id FROM user_champion_subscription WHERE user_id = ? AND novel_id = ?',
        [userId, novelId]
      );

      if (existingRows.length > 0) {
        // 更新现有订阅
        await this.db.execute(
          `UPDATE user_champion_subscription 
           SET tier_level = ?, tier_name = ?, monthly_price = ?, 
               start_date = ?, end_date = ?, payment_method = ?, is_active = 1
           WHERE user_id = ? AND novel_id = ?`,
          [tierLevel, tier.tier_name, tier.monthly_price, startDate, endDate, paymentMethod, userId, novelId]
        );
      } else {
        // 创建新订阅
        await this.db.execute(
          `INSERT INTO user_champion_subscription 
           (user_id, novel_id, tier_level, tier_name, monthly_price, start_date, end_date, payment_method) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [userId, novelId, tierLevel, tier.tier_name, tier.monthly_price, startDate, endDate, paymentMethod]
        );
      }

      return true;
    } catch (error) {
      throw new Error(`创建Champion订阅失败: ${error.message}`);
    }
  }

  // 检查用户Champion状态
  async getUserChampionStatus(userId, novelId) {
    try {
      const [subscriptionRows] = await this.db.execute(
        `SELECT tier_level, tier_name, monthly_price, end_date, is_active 
         FROM user_champion_subscription 
         WHERE user_id = ? AND novel_id = ?`,
        [userId, novelId]
      );

      if (subscriptionRows.length === 0) {
        return { isChampion: false, tier: null };
      }

      const subscription = subscriptionRows[0];
      const isActive = subscription.is_active && new Date(subscription.end_date) > new Date();

      return {
        isChampion: isActive,
        tier: isActive ? {
          level: subscription.tier_level,
          name: subscription.tier_name,
          price: subscription.monthly_price,
          endDate: subscription.end_date
        } : null
      };
    } catch (error) {
      throw new Error(`检查Champion状态失败: ${error.message}`);
    }
  }

  // 获取所有默认等级配置
  async getDefaultChampionTiers() {
    try {
      const [rows] = await this.db.execute(
        'SELECT * FROM default_champion_tiers WHERE is_active = 1 ORDER BY sort_order'
      );
      return rows;
    } catch (error) {
      throw new Error(`获取默认等级配置失败: ${error.message}`);
    }
  }
}

module.exports = ChampionService;
