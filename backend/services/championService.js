const mysql = require('mysql2/promise');
const stripe = require('stripe');

// 加载环境变量
try {
  require('dotenv').config({ path: './kongfuworld.env' });
} catch (error) {
  console.log('dotenv not available, using default values');
}

class ChampionService {
  constructor() {
    this.db = mysql.createPool({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'kongfuworld'
    });
    
    // 初始化 Stripe 客户端（用于创建 Coupon）
    this.stripe = stripe(process.env.STRIPE_SECRET_KEY);
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

  // 获取用户可访问的章节数（保留向后兼容）
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

  /**
   * 计算某个用户在某本小说下的章节可见范围
   * @param {Pool} db - 数据库连接池或连接对象
   * @param {number} novelId - 小说ID
   * @param {number|null} userId - 用户ID，未登录传 null
   * @returns {Promise<{
   *   championEnabled: boolean,        // novel.champion_status === 'approved'
   *   isChampion: boolean,             // 用户是否有有效订阅
   *   visibleMaxChapterNumber: number, // 用户可见的最大 chapter_number（Champion 用户用）
   *   baseMaxChapterNumber: number,    // B：基础章节最大编号
   *   userAdvanceChapters: number      // A_user：该用户可预读章节数；普通用户为 0
   * }>}
   */
  async getUserChapterVisibility(db, novelId, userId) {
    try {
      // 1. 查询 novel.champion_status
      const [novelRows] = await db.execute(
        'SELECT champion_status FROM novel WHERE id = ?',
        [novelId]
      );

      if (novelRows.length === 0) {
        throw new Error(`小说 ${novelId} 不存在`);
      }

      const championStatus = novelRows[0]?.champion_status || 'invalid';
      const championEnabled = championStatus === 'approved';

      // 2. 计算基础章节最大编号 B（is_advance=0 AND is_released=1 AND review_status='approved'）
      const [baseMaxRows] = await db.execute(
        `SELECT COALESCE(MAX(chapter_number), 0) AS baseMax 
         FROM chapter 
         WHERE novel_id = ? AND is_released = 1 AND is_advance = 0 AND review_status = 'approved'`,
        [novelId]
      );
      const baseMaxChapterNumber = baseMaxRows[0]?.baseMax || 0;

      // 3. 计算所有已发布章节最大编号 M（is_released=1 AND review_status='approved'）
      const [releasedMaxRows] = await db.execute(
        `SELECT COALESCE(MAX(chapter_number), 0) AS releasedMax 
         FROM chapter 
         WHERE novel_id = ? AND is_released = 1 AND review_status = 'approved'`,
        [novelId]
      );
      const releasedMaxChapterNumber = releasedMaxRows[0]?.releasedMax || 0;

      // 4. 如果未启用 Champion 或用户未登录，直接返回
      if (!championEnabled || !userId) {
        return {
          championEnabled: false,
          isChampion: false,
          visibleMaxChapterNumber: baseMaxChapterNumber,
          baseMaxChapterNumber,
          userAdvanceChapters: 0
        };
      }

      // 5. 查询用户当前有效订阅 + 对应 tier 的 advance_chapters
      const [subscriptionRows] = await db.execute(
        `SELECT t.advance_chapters
         FROM user_champion_subscription s
         JOIN novel_champion_tiers t
           ON t.novel_id = s.novel_id
          AND t.tier_level = s.tier_level
          AND t.is_active = 1
         WHERE s.user_id = ?
           AND s.novel_id = ?
           AND s.is_active = 1
           AND s.end_date > NOW()
         ORDER BY s.end_date DESC
         LIMIT 1`,
        [userId, novelId]
      );

      // 6. 如果查不到记录，用户不是 Champion
      if (subscriptionRows.length === 0) {
        return {
          championEnabled: true,
          isChampion: false,
          visibleMaxChapterNumber: baseMaxChapterNumber,
          baseMaxChapterNumber,
          userAdvanceChapters: 0
        };
      }

      // 7. 用户是 Champion，获取预读章节数
      const userAdvanceChapters = subscriptionRows[0]?.advance_chapters || 0;

      // 8. 计算 visibleMaxChapterNumber = min(B + A_user, M)
      const visibleMaxChapterNumber = Math.min(
        baseMaxChapterNumber + userAdvanceChapters,
        releasedMaxChapterNumber
      );

      return {
        championEnabled: true,
        isChampion: true,
        visibleMaxChapterNumber,
        baseMaxChapterNumber,
        userAdvanceChapters
      };
    } catch (error) {
      throw new Error(`获取用户章节可见性失败: ${error.message}`);
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

  // 获取或创建 Stripe Price（为 Champion Tier 动态创建 Stripe Price）
  // 如果 stripe_price_id 已存在，直接返回；否则创建新的 Stripe Price 并写回数据库
  async getOrCreateStripePriceForChampionTier({ novelId, tierLevel, stripeService }) {
    try {
      console.log(`[Champion Price] 获取或创建 Stripe Price - 小说: ${novelId}, 等级: ${tierLevel}`);

      // 1. 从 novel_champion_tiers 查询对应记录
      const [tierRows] = await this.db.execute(
        'SELECT id, novel_id, tier_level, tier_name, monthly_price, currency, stripe_price_id FROM novel_champion_tiers WHERE novel_id = ? AND tier_level = ? AND is_active = 1',
        [novelId, tierLevel]
      );

      if (tierRows.length === 0) {
        throw new Error(`未找到小说 ${novelId} 的等级 ${tierLevel} 配置`);
      }

      const tierRow = tierRows[0];
      const monthlyPrice = parseFloat(tierRow.monthly_price) || 0;
      const currency = (tierRow.currency || 'USD').toLowerCase(); // Stripe 需要小写
      const tierName = tierRow.tier_name;

      // 2. 如果 stripe_price_id 已有，验证并返回
      if (tierRow.stripe_price_id) {
        console.log(`[Champion Price] 找到已有 Stripe Price ID: ${tierRow.stripe_price_id}`);
        
        // 验证 Price 是否仍然存在于 Stripe（可选，如果不存在会抛出错误）
        let priceExists = true;
        try {
          await stripeService.stripe.prices.retrieve(tierRow.stripe_price_id);
          console.log(`[Champion Price] Stripe Price 验证成功`);
        } catch (error) {
          console.warn(`[Champion Price] Stripe Price ${tierRow.stripe_price_id} 不存在，将创建新的`);
          priceExists = false;
          // 如果 Price 不存在，继续创建新的
        }

        if (priceExists) {
          return {
            priceId: tierRow.stripe_price_id,
            monthlyPrice,
            currency,
            tierName,
            tierRow
          };
        }
      }

      // 3. 如果 stripe_price_id 为空，创建新的 Stripe Price
      console.log(`[Champion Price] 创建新的 Stripe Price - 价格: $${monthlyPrice}, 币种: ${currency}`);

      // TODO: 需要在环境变量中配置 STRIPE_CHAMPION_PRODUCT_ID（全站共用一个 Product）
      // 如果没有配置，可以创建一个默认 Product 或使用 null（Stripe 会自动创建）
      const productId = process.env.STRIPE_CHAMPION_PRODUCT_ID || null;

      const priceData = {
        unit_amount: Math.round(monthlyPrice * 100), // 转换为分（整数）
        currency: currency,
        recurring: {
          interval: 'month'
        },
        metadata: {
          novel_id: novelId.toString(),
          tier_level: tierLevel.toString(),
          tier_name: tierName
        }
      };

      // 如果配置了 Product ID，使用它；否则让 Stripe 自动创建 Product
      if (productId) {
        priceData.product = productId;
      } else {
        // 如果没有 Product ID，创建一个默认的 Product
        console.log('[Champion Price] 未配置 STRIPE_CHAMPION_PRODUCT_ID，将创建默认 Product');
        const product = await stripeService.stripe.products.create({
          name: 'KongFuWorld Champion Subscription',
          description: 'Champion subscription for novels',
          metadata: {
            type: 'champion_subscription'
          }
        });
        priceData.product = product.id;
        console.log(`[Champion Price] 创建默认 Product: ${product.id}`);
      }

      const price = await stripeService.stripe.prices.create(priceData);

      console.log(`[Champion Price] Stripe Price 创建成功 - Price ID: ${price.id}`);

      // 4. 将 price.id 写回 novel_champion_tiers.stripe_price_id
      await this.db.execute(
        'UPDATE novel_champion_tiers SET stripe_price_id = ?, currency = ? WHERE id = ?',
        [price.id, currency.toUpperCase(), tierRow.id]
      );

      console.log(`[Champion Price] 已更新数据库 - Tier ID: ${tierRow.id}, Price ID: ${price.id}`);

      return {
        priceId: price.id,
        monthlyPrice,
        currency,
        tierName,
        tierRow: { ...tierRow, stripe_price_id: price.id, currency: currency.toUpperCase() }
      };
    } catch (error) {
      console.error('[Champion Price] 获取或创建 Stripe Price 失败:', error);
      throw new Error(`获取或创建 Stripe Price 失败: ${error.message}`);
    }
  }

  // 获取或创建 Stripe Coupon（用于促销折扣）
  // 参数：
  // - novelId: 小说ID
  // - basePrice: 原价（用于计算固定金额折扣）
  // - currency: 币种（默认 USD）
  // 返回：
  // - couponId: Stripe Coupon ID（如果有促销），null（如果没有促销）
  // - promotionInfo: 促销信息（discount_value, discount_amount, effectivePrice 等）
  async getOrCreateStripeCouponForPromotion({ novelId, basePrice, currency = 'USD' }) {
    try {
      console.log(`[Champion Coupon] 查询促销活动 - 小说: ${novelId}, 原价: $${basePrice}`);

      // 1. 查询当前生效的促销活动
      const now = new Date();
      const [promotions] = await this.db.execute(
        `SELECT id, promotion_type, discount_value, stripe_coupon_id, start_at, end_at, status
         FROM pricing_promotion 
         WHERE novel_id = ? 
           AND status IN ('scheduled', 'active')
           AND start_at <= ? 
           AND end_at >= ?
         ORDER BY discount_value ASC, start_at DESC
         LIMIT 1`,
        [novelId, now, now]
      );

      // 如果没有促销活动，返回 null
      if (promotions.length === 0) {
        console.log(`[Champion Coupon] 未找到促销活动`);
        return {
          couponId: null,
          promotionInfo: null
        };
      }

      const promotion = promotions[0];
      const discountValue = parseFloat(promotion.discount_value) || 1.0;

      // 如果折扣值为 1.0（原价），不需要 Coupon
      if (discountValue >= 1.0) {
        console.log(`[Champion Coupon] 折扣值为 ${discountValue}，无需创建 Coupon`);
        return {
          couponId: null,
          promotionInfo: null
        };
      }

      // 2. 计算折扣金额和实际价格
      let effectivePrice = basePrice;
      let discountAmount = 0;
      let percentOff = null;
      let amountOff = null;

      if (discountValue === 0) {
        // 限时免费
        effectivePrice = 0;
        discountAmount = basePrice;
        amountOff = Math.round(basePrice * 100); // 转换为分
      } else if (discountValue < 1.0) {
        // 百分比折扣
        effectivePrice = Math.ceil(basePrice * discountValue * 100) / 100;
        if (effectivePrice < 0.01) effectivePrice = 0.01;
        discountAmount = basePrice - effectivePrice;
        percentOff = Math.round((1 - discountValue) * 100); // 例如：0.8 -> 20% off
      }

      console.log(`[Champion Coupon] 促销信息 - 原价: $${basePrice}, 折扣后: $${effectivePrice}, 折扣金额: $${discountAmount}`);

      // 3. 如果 stripe_coupon_id 已存在，验证并返回
      if (promotion.stripe_coupon_id) {
        console.log(`[Champion Coupon] 找到已有 Stripe Coupon ID: ${promotion.stripe_coupon_id}`);
        
        // 验证 Coupon 是否仍然存在于 Stripe
        let couponExists = true;
        try {
          await this.stripe.coupons.retrieve(promotion.stripe_coupon_id);
          console.log(`[Champion Coupon] Stripe Coupon 验证成功`);
        } catch (error) {
          console.warn(`[Champion Coupon] Stripe Coupon ${promotion.stripe_coupon_id} 不存在，将创建新的`);
          couponExists = false;
        }

        if (couponExists) {
          return {
            couponId: promotion.stripe_coupon_id,
            promotionInfo: {
              promotionId: promotion.id,
              discountValue,
              discountAmount,
              effectivePrice,
              basePrice,
              percentOff,
              amountOff
            }
          };
        }
      }

      // 4. 创建新的 Stripe Coupon
      console.log(`[Champion Coupon] 创建新的 Stripe Coupon...`);

      const couponData = {
        duration: 'once', // 只在首期生效，如未来需要"前 N 期打折"可改为 'repeating' + duration_in_months
        metadata: {
          promotion_id: promotion.id.toString(),
          novel_id: novelId.toString(),
          discount_value: discountValue.toString()
        }
      };

      if (amountOff !== null) {
        // 固定金额折扣
        couponData.amount_off = amountOff;
        couponData.currency = currency.toLowerCase();
        console.log(`[Champion Coupon] 创建固定金额折扣 Coupon - 金额: ${amountOff} ${currency}`);
      } else if (percentOff !== null) {
        // 百分比折扣
        couponData.percent_off = percentOff;
        console.log(`[Champion Coupon] 创建百分比折扣 Coupon - 折扣: ${percentOff}%`);
      } else {
        throw new Error('无法确定折扣类型');
      }

      const coupon = await this.stripe.coupons.create(couponData);
      console.log(`[Champion Coupon] Stripe Coupon 创建成功 - Coupon ID: ${coupon.id}`);

      // 5. 将 coupon.id 写回 pricing_promotion.stripe_coupon_id
      await this.db.execute(
        'UPDATE pricing_promotion SET stripe_coupon_id = ? WHERE id = ?',
        [coupon.id, promotion.id]
      );

      console.log(`[Champion Coupon] 已更新数据库 - Promotion ID: ${promotion.id}, Coupon ID: ${coupon.id}`);

      return {
        couponId: coupon.id,
        promotionInfo: {
          promotionId: promotion.id,
          discountValue,
          discountAmount,
          effectivePrice,
          basePrice,
          percentOff,
          amountOff
        }
      };
    } catch (error) {
      console.error('[Champion Coupon] 获取或创建 Stripe Coupon 失败:', error);
      throw new Error(`获取或创建 Stripe Coupon 失败: ${error.message}`);
    }
  }
}

module.exports = ChampionService;
