const mysql = require('mysql2/promise');
const StripeService = require('./stripeService');
const ChampionService = require('./championService');

class UnifiedPaymentService {
  constructor() {
    this.db = mysql.createPool({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '123456',
      database: process.env.DB_NAME || 'kongfuworld'
    });
    // 初始化 StripeService 实例，用于同步 billing_cycle_anchor
    this.stripeService = new StripeService();
    // 初始化 ChampionService 实例，用于获取 Stripe Price
    this.championService = new ChampionService();
  }

  // 工具函数：格式化日期时间为字符串 'YYYY-MM-DD HH:mm:ss'
  formatDateTime(date) {
    if (!date) return null;
    const d = date instanceof Date ? date : new Date(date);
    if (isNaN(d.getTime())) return null;
    
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const seconds = String(d.getSeconds()).padStart(2, '0');
    
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  }

  // 工具函数：构造会员快照 JSON
  buildMembershipSnapshot(membership) {
    if (!membership) return null; // 没有会员就是 null
    
    return JSON.stringify({
      tier_level: membership.tier_level || null,
      tier_name: membership.tier_name || null,
      start_date: membership.start_date ? this.formatDateTime(membership.start_date) : null,
      end_date: membership.end_date ? this.formatDateTime(membership.end_date) : null
    });
  }

  // 统一的支付成功处理逻辑
  async handlePaymentSuccess(userId, novelId, amount, paymentMethod, paymentRecordId, paymentData = null) {
    try {
      console.log(`[统一支付处理] 开始处理支付 - 用户: ${userId}, 小说: ${novelId}, 金额: $${amount}, 方式: ${paymentMethod}`);
      
      // 1. 首先尝试从 payment_record 的 description 中提取等级信息
      let tierLevel = 0;
      let tierName = 'Unknown';
      
      if (paymentRecordId) {
        const [paymentRecords] = await this.db.execute(
          'SELECT description FROM payment_record WHERE id = ?',
          [paymentRecordId]
        );
        
        if (paymentRecords.length > 0) {
          const description = paymentRecords[0].description || '';
          // 从描述中提取 Tier Level 和 Tier Name
          const tierLevelMatch = description.match(/Tier Level: (\d+)/);
          const tierNameMatch = description.match(/Tier Name: ([^|]+)/);
          
          if (tierLevelMatch && tierNameMatch) {
            tierLevel = parseInt(tierLevelMatch[1], 10);
            tierName = tierNameMatch[1].trim();
            console.log(`[统一支付处理] 从支付记录中提取等级: ${tierLevel} (${tierName})`);
          }
        }
      }
      
      // 2. 如果从支付记录中未找到，则尝试通过金额查找（兼容旧数据）
      // 注意：这里通过金额查找可能不准确（因为金额可能是折后价），但作为兼容方案保留
      if (tierLevel === 0 || tierName === 'Unknown') {
        const [tierInfo] = await this.db.execute(
          'SELECT tier_level, tier_name FROM novel_champion_tiers WHERE novel_id = ? AND monthly_price = ? AND is_active = 1',
          [novelId, amount]
        );

        if (tierInfo.length > 0) {
          tierLevel = tierInfo[0].tier_level;
          tierName = tierInfo[0].tier_name;
          console.log(`[统一支付处理] 通过金额找到等级: ${tierLevel} (${tierName})`);
        } else {
          console.warn(`[统一支付处理] 未找到等级信息 - 小说: ${novelId}, 金额: $${amount}`);
        }
      }

      // 3. 从 novel_champion_tiers 表查询 tier 的 base price（原价）
      // 策略 B：monthly_price 字段始终保存 base price，实际支付金额（含折扣）保存在 payment_amount 字段
      let basePrice = amount; // 默认使用支付金额（如果没有找到 tier 配置）
      if (tierLevel > 0) {
        const [tierPriceInfo] = await this.db.execute(
          'SELECT monthly_price FROM novel_champion_tiers WHERE novel_id = ? AND tier_level = ? AND is_active = 1',
          [novelId, tierLevel]
        );

        if (tierPriceInfo.length > 0) {
          basePrice = parseFloat(tierPriceInfo[0].monthly_price) || amount;
          console.log(`[统一支付处理] 查询到 tier base price - tier_level: ${tierLevel}, base_price: $${basePrice}, 实际支付金额: $${amount}`);
        } else {
          console.warn(`[统一支付处理] 未找到 tier 价格配置 - 小说: ${novelId}, 等级: ${tierLevel}，使用支付金额作为 base price`);
        }
      }

      // 2. 检查是否已存在订阅（获取完整会员信息用于快照和升级判断）
      const [existingSubscription] = await this.db.execute(
        'SELECT id, tier_level, tier_name, start_date, end_date, stripe_subscription_id, stripe_customer_id, auto_renew FROM user_champion_subscription WHERE user_id = ? AND novel_id = ? AND is_active = 1',
        [userId, novelId]
      );

      // 识别升级场景：购买等级 > 当前等级
      let isUpgrade = false;
      let previousTierLevel = null;
      let previousTierName = null;
      let previousEndDate = null;
      let stripeSubscriptionId = null;
      let autoRenew = 0;

      if (existingSubscription.length > 0) {
        const row = existingSubscription[0];
        previousTierLevel = row.tier_level;
        previousTierName = row.tier_name;
        previousEndDate = row.end_date;
        stripeSubscriptionId = row.stripe_subscription_id;
        autoRenew = Number(row.auto_renew) || 0;

        // 升级条件：购买等级 > 当前等级
        if (tierLevel > previousTierLevel) {
          isUpgrade = true;
          console.log(`[统一支付处理] 检测到升级场景 - 用户: ${userId}, 小说: ${novelId}, 从等级 ${previousTierLevel} 升级到 ${tierLevel}`);
        }
      }

      // 构造购买前会员快照（在计算新日期之前）
      const currentMembership = existingSubscription.length > 0 ? existingSubscription[0] : null;
      const beforeMembershipSnapshot = this.buildMembershipSnapshot(currentMembership);

      // 统一计算 newEndDate：每次购买（包括升级）都视为"再续 30 天"
      // 规则：如果已有 end_date 且在当前时间之后，就从 end_date 开始往后加 30 天；否则从现在开始算 30 天
      const now = new Date();
      let baseDate;
      
      // 调试日志：记录查询到的 end_date
      console.log(`[统一支付处理] 查询到的订阅信息 - 用户: ${userId}, 小说: ${novelId}, previousEndDate: ${previousEndDate ? new Date(previousEndDate).toISOString() : 'null'}, 当前时间: ${now.toISOString()}`);
      
      if (previousEndDate) {
        const previousEndDateObj = new Date(previousEndDate);
        console.log(`[统一支付处理] 解析后的 previousEndDate: ${previousEndDateObj.toISOString()}, 是否在未来: ${previousEndDateObj > now}`);
        
        if (previousEndDateObj > now) {
          baseDate = previousEndDateObj;
          console.log(`[统一支付处理] 使用现有 end_date 作为基准日期: ${baseDate.toISOString()}`);
        } else {
          baseDate = now;
          console.log(`[统一支付处理] 现有 end_date 已过期，使用当前时间作为基准日期: ${baseDate.toISOString()}`);
        }
      } else {
        baseDate = now;
        console.log(`[统一支付处理] 没有现有订阅，使用当前时间作为基准日期: ${baseDate.toISOString()}`);
      }
      
      const newEndDate = new Date(baseDate);
      newEndDate.setDate(newEndDate.getDate() + 30);
      console.log(`[统一支付处理] 计算新的到期日期 - 基准日期: ${baseDate.toISOString()}, 新到期日期: ${newEndDate.toISOString()}`);

      // 格式化日期为 'YYYY-MM-DD HH:mm:ss'
      const formattedNewEndDate = this.formatDateTime(newEndDate);
      const formattedBaseDate = this.formatDateTime(baseDate);

      let subscriptionType = 'new';
      let startDate = baseDate;
      let endDate = newEndDate;

      if (isUpgrade) {
        // === 升级逻辑 ===
        subscriptionType = 'upgrade';
        
        // 更新 user_champion_subscription：升级到新等级，延长 end_date
        // 获取 stripe_customer_id：优先使用现有的，其次从 paymentData 获取，最后从 Stripe Subscription 获取
        let finalStripeCustomerId = existingSubscription[0].stripe_customer_id;
        if (!finalStripeCustomerId && paymentData && paymentMethod === 'stripe' && paymentData.customer) {
          finalStripeCustomerId = paymentData.customer;
        }
        // 如果仍然没有，且有 subscription_id，从 Stripe API 获取
        if (!finalStripeCustomerId && stripeSubscriptionId) {
          try {
            const subscription = await this.stripeService.stripe.subscriptions.retrieve(stripeSubscriptionId);
            if (subscription.customer) {
              finalStripeCustomerId = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id;
              console.log(`[统一支付处理-升级] 从 Stripe Subscription 获取 customer_id: ${finalStripeCustomerId}`);
            }
          } catch (err) {
            console.warn(`[统一支付处理-升级] 从 Stripe API 获取 customer_id 失败: ${err.message}`);
          }
        }
        
        const updateFields = [
          'tier_level = ?',
          'tier_name = ?',
          'monthly_price = ?',
          'end_date = ?',
          'updated_at = NOW()'
        ];
        const updateValues = [tierLevel, tierName, basePrice, formattedNewEndDate]; // 使用 base price，不是折后价
        
        if (finalStripeCustomerId) {
          updateFields.push('stripe_customer_id = ?');
          updateValues.push(finalStripeCustomerId);
        }
        
        updateValues.push(existingSubscription[0].id);
        
        await this.db.execute(
          `UPDATE user_champion_subscription SET ${updateFields.join(', ')} WHERE id = ?`,
          updateValues
        );
        console.log(`[统一支付处理-升级] 升级订阅 - 用户: ${userId}, 小说: ${novelId}, 从等级 ${previousTierLevel} 升级到 ${tierLevel}, 新到期时间: ${formattedNewEndDate}, stripe_customer_id: ${finalStripeCustomerId || '未设置'}`);
        // === 升级逻辑结束 ===
        // 注意：Stripe Subscription 同步将在 handlePaymentSuccess 函数末尾统一处理（策略 B）
      } else if (existingSubscription.length > 0) {
        // === 普通续费逻辑（非升级） ===
        subscriptionType = 'extend';
        
        // 获取 stripe_customer_id：优先使用现有的，其次从 paymentData 获取，最后从 Stripe Subscription 获取
        let finalStripeCustomerId = existingSubscription[0].stripe_customer_id;
        if (!finalStripeCustomerId && paymentData && paymentMethod === 'stripe' && paymentData.customer) {
          finalStripeCustomerId = paymentData.customer;
        }
        // 如果仍然没有，且有 subscription_id，从 Stripe API 获取
        if (!finalStripeCustomerId && stripeSubscriptionId) {
          try {
            const subscription = await this.stripeService.stripe.subscriptions.retrieve(stripeSubscriptionId);
            if (subscription.customer) {
              finalStripeCustomerId = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id;
              console.log(`[统一支付处理] 从 Stripe Subscription 获取 customer_id: ${finalStripeCustomerId}`);
            }
          } catch (err) {
            console.warn(`[统一支付处理] 从 Stripe API 获取 customer_id 失败: ${err.message}`);
          }
        }
        
        const updateFields = [
          'tier_level = ?',
          'tier_name = ?',
          'monthly_price = ?',
          'end_date = ?',
          'updated_at = NOW()'
        ];
        const updateValues = [tierLevel, tierName, basePrice, formattedNewEndDate]; // 使用 base price，不是折后价
        
        if (finalStripeCustomerId) {
          updateFields.push('stripe_customer_id = ?');
          updateValues.push(finalStripeCustomerId);
        }
        
        updateValues.push(existingSubscription[0].id);
        
        await this.db.execute(
          `UPDATE user_champion_subscription SET ${updateFields.join(', ')} WHERE id = ?`,
          updateValues
        );
        console.log(`[统一支付处理] 延长订阅 - 用户: ${userId}, 小说: ${novelId}, 新到期时间: ${formattedNewEndDate}, stripe_customer_id: ${finalStripeCustomerId || '未设置'}`);
        // === 普通续费逻辑结束 ===
        // 注意：Stripe Subscription 同步将在 handlePaymentSuccess 函数末尾统一处理（策略 B）
      } else {
        // === 新订阅逻辑 ===
        subscriptionType = 'new';
        await this.db.execute(
          'INSERT INTO user_champion_subscription (user_id, novel_id, tier_level, tier_name, monthly_price, start_date, end_date, payment_method, is_active, created_at) VALUES (?, ?, ?, ?, ?, NOW(), DATE_ADD(NOW(), INTERVAL 30 DAY), ?, ?, NOW())',
          [userId, novelId, tierLevel, tierName, basePrice, paymentMethod, 1] // 使用 base price，不是折后价
        );
        console.log(`[统一支付处理] 创建新订阅 - 用户: ${userId}, 小说: ${novelId}, base_price: $${basePrice}`);
      }

      // 3. 创建详细支付记录
      if (paymentRecordId) {
        // 构造升级前后的会员快照（升级场景需要记录升级前的等级信息）
        let beforeSnapshot = beforeMembershipSnapshot;
        let afterSnapshot = JSON.stringify({
          tier_level: tierLevel,
          tier_name: tierName,
          start_date: this.formatDateTime(startDate),
          end_date: this.formatDateTime(endDate)
        });

        // 如果是升级场景，确保 beforeMembershipSnapshot 包含升级前的等级信息
        if (isUpgrade && previousTierLevel !== null) {
          beforeSnapshot = JSON.stringify({
            tier_level: previousTierLevel,
            tier_name: previousTierName,
            start_date: existingSubscription[0].start_date ? this.formatDateTime(existingSubscription[0].start_date) : null,
            end_date: previousEndDate ? this.formatDateTime(previousEndDate) : null
          });
        }

        console.log('[handlePaymentSuccess] 准备创建订阅记录', {
          userId,
          novelId,
          paymentRecordId,
          paymentMethod,
          amount,
          startDate: this.formatDateTime(startDate),
          endDate: this.formatDateTime(endDate),
          subscriptionType,
          isUpgrade
        });
        
        // 提取 Stripe 相关信息（用于升级场景）
        let stripeSubscriptionId = null;
        let stripePaymentIntentId = null;
        let stripeCustomerId = null;
        
        // 优先从 paymentData 中提取（最准确）
        if (paymentData && paymentMethod === 'stripe') {
          if (paymentData.id) {
            stripePaymentIntentId = paymentData.id;
          }
          if (paymentData.customer) {
            stripeCustomerId = paymentData.customer;
          }
          // 尝试从 paymentData 的 metadata 或 invoice 中获取 subscription_id
          if (paymentData.metadata && paymentData.metadata.subscriptionId) {
            stripeSubscriptionId = paymentData.metadata.subscriptionId;
          }
        }
        
        // 从 payment_record 中获取 Stripe 相关信息（如果 paymentData 中没有）
        if (paymentRecordId && paymentMethod === 'stripe') {
          try {
            const [paymentRecord] = await this.db.execute(
              'SELECT stripe_subscription_id, stripe_payment_intent_id, stripe_customer_id FROM payment_record WHERE id = ?',
              [paymentRecordId]
            );
            if (paymentRecord.length > 0) {
              if (!stripeSubscriptionId) stripeSubscriptionId = paymentRecord[0].stripe_subscription_id;
              if (!stripePaymentIntentId) stripePaymentIntentId = paymentRecord[0].stripe_payment_intent_id;
              if (!stripeCustomerId) stripeCustomerId = paymentRecord[0].stripe_customer_id;
            }
          } catch (err) {
            console.warn('[handlePaymentSuccess] 查询 payment_record 的 Stripe 字段失败', err.message);
          }
        }
        
        // 如果仍未获取到，尝试从 user_champion_subscription 中获取
        if (existingSubscription.length > 0) {
          if (!stripeSubscriptionId) stripeSubscriptionId = existingSubscription[0].stripe_subscription_id || null;
          if (!stripeCustomerId) stripeCustomerId = existingSubscription[0].stripe_customer_id || null;
        }
        
        // 如果仍然没有获取到 customer_id，但有 subscription_id，从 Stripe API 获取
        if (!stripeCustomerId && stripeSubscriptionId) {
          try {
            const subscription = await this.stripeService.stripe.subscriptions.retrieve(stripeSubscriptionId);
            if (subscription.customer) {
              stripeCustomerId = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id;
              console.log(`[handlePaymentSuccess] 从 Stripe Subscription 获取 customer_id: ${stripeCustomerId}`);
            }
          } catch (err) {
            console.warn(`[handlePaymentSuccess] 从 Stripe API 获取 customer_id 失败: ${err.message}`);
          }
        }
        
        console.log(`[handlePaymentSuccess] 提取的 Stripe 信息 - subscription_id: ${stripeSubscriptionId}, payment_intent_id: ${stripePaymentIntentId}, customer_id: ${stripeCustomerId}`);

        // 计算折扣金额
        const discountAmount = basePrice - amount;
        const discountCode = discountAmount > 0 ? 'promotion' : null; // 如果有折扣，可以后续从 promotion 表获取具体代码
        
        await this.createSubscriptionRecord({
          userId,
          novelId,
          paymentRecordId,
          tierLevel,
          tierName,
          monthlyPrice: basePrice, // 使用 base price（原价）
          paymentAmount: amount, // 实际支付金额（含折扣）
          paymentMethod,
          paymentStatus: 'completed',
          subscriptionType,
          subscriptionDurationDays: 30,
          beforeMembershipSnapshot: beforeSnapshot,
          afterMembershipSnapshot: afterSnapshot,
          startDate,
          endDate,
          paymentData,
          // 升级场景需要传递 auto_renew 信息
          autoRenew: existingSubscription.length > 0 ? autoRenew : 0,
          stripeSubscriptionId: stripeSubscriptionId, // Stripe Subscription ID (sub_xxx)
          stripePaymentIntentId: stripePaymentIntentId, // Stripe PaymentIntent ID (pi_xxx)
          stripeCustomerId: stripeCustomerId, // Stripe Customer ID (cus_xxx)
          discountAmount: discountAmount, // 折扣金额
          discountCode: discountCode // 折扣代码
        });
        
        console.log(`[统一支付处理] 订阅记录创建 - base_price: $${basePrice}, payment_amount: $${amount}, discount: $${discountAmount}`);
        
        console.log('[handlePaymentSuccess] 订阅记录创建成功');
      } else {
        console.warn('[handlePaymentSuccess] paymentRecordId 为空，跳过创建订阅记录');
      }

      // 4. 如果用户有 active Stripe Subscription 且开启自动续费，同步 Stripe Subscription 状态
      // 策略 B：手动支付成功后（无论 Stripe 还是 PayPal），都要同步 Stripe Subscription
      // - 将 Stripe Subscription 的 price 更新为当前 tier 的 base price
      // - 将 billing_cycle_anchor 对齐到本地 end_date
      // 注意：需要在数据库更新后重新查询，确保获取最新的订阅信息（包括更新后的 tier_level 和 end_date）
      const [updatedSubscription] = await this.db.execute(
        'SELECT id, tier_level, tier_name, monthly_price, end_date, stripe_subscription_id, stripe_customer_id, payment_method, auto_renew FROM user_champion_subscription WHERE user_id = ? AND novel_id = ? AND is_active = 1 LIMIT 1',
        [userId, novelId]
      );

      if (updatedSubscription.length > 0) {
        const currentSub = updatedSubscription[0];
        const hasStripeSubscription = currentSub.stripe_subscription_id && currentSub.stripe_subscription_id.trim() !== '';
        const isAutoRenew = Number(currentSub.auto_renew) === 1;

        if (hasStripeSubscription && isAutoRenew) {
          try {
            console.log(`[统一支付处理] 检测到 Stripe Subscription，开始同步 - 用户: ${userId}, 小说: ${novelId}, stripe_subscription_id: ${currentSub.stripe_subscription_id}`);
            await this.stripeService.syncChampionStripeSubscriptionWithLocalState(userId, novelId);
            console.log(`[统一支付处理] Stripe Subscription 同步完成 - 用户: ${userId}, 小说: ${novelId}`);
          } catch (err) {
            // 同步失败不影响支付成功，只记录日志
            console.error(`[统一支付处理] Stripe Subscription 同步失败（不影响支付成功）`, {
              userId,
              novelId,
              error: err.message
            });
          }
        } else {
          console.log(`[统一支付处理] 无需同步 Stripe Subscription - 用户: ${userId}, 小说: ${novelId}, hasStripeSubscription: ${hasStripeSubscription}, isAutoRenew: ${isAutoRenew}`);
        }
      }

      console.log(`[统一支付处理] 支付处理完成 - 用户: ${userId}, 小说: ${novelId}, 等级: ${tierLevel} (${tierName})`);
      
      return {
        success: true,
        tierLevel,
        tierName,
        subscriptionType
      };
    } catch (error) {
      console.error('[统一支付处理] 处理失败:', error);
      throw new Error(`Payment processing failed: ${error.message}`);
    }
  }

  // 创建订阅记录详情
  // 参数说明：
  // - userId, novelId, paymentRecordId: 必填
  // - tierLevel, tierName: 订阅等级信息
  // - monthlyPrice, paymentAmount: 价格信息
  // - paymentMethod: 'stripe' 或 'paypal'
  // - paymentStatus: 支付状态，默认 'completed'
  // - subscriptionType: 'new' 或 'extend'
  // - subscriptionDurationDays: 订阅时长（天），默认 30
  // - beforeMembershipSnapshot, afterMembershipSnapshot: 会员快照 JSON 字符串
  // - startDate, endDate: 订阅开始和结束时间
  // - paymentData: 支付平台返回的原始数据（用于提取交易ID等信息）
  // - discountAmount: 折扣金额（可选）
  // - discountCode: 折扣代码（可选）
  async createSubscriptionRecord(payload) {
    const {
      userId,
      novelId,
      paymentRecordId,
      tierLevel,
      tierName,
      monthlyPrice,
      paymentAmount,
      paymentMethod,
      paymentStatus = 'completed',
      subscriptionType,
      subscriptionDurationDays = 30,
      beforeMembershipSnapshot,
      afterMembershipSnapshot,
      startDate,
      endDate,
      paymentData = null,
      discountAmount = 0.00,
      discountCode = null,
      autoRenew = 0, // 新增：支持传入 auto_renew 值（升级场景需要）
      stripeSubscriptionId = null, // 新增：Stripe Subscription ID (sub_xxx)
      stripePaymentIntentId = null, // 新增：Stripe PaymentIntent ID (pi_xxx)
      stripeCustomerId = null // 新增：Stripe Customer ID (cus_xxx)
    } = payload;

    try {
      console.log('[createSubscriptionRecord] 开始创建订阅记录', {
        userId,
        novelId,
        paymentRecordId,
        paymentMethod,
        paymentAmount,
        subscriptionType
      });

      // 提取支付平台相关信息
      // 注意：stripeSubscriptionId、stripePaymentIntentId、stripeCustomerId 优先使用传入的参数
      let finalStripeSubscriptionId = stripeSubscriptionId;
      let finalStripePaymentIntentId = stripePaymentIntentId;
      let finalStripeCustomerId = stripeCustomerId;
      let paypalOrderId = null;
      let paypalPayerId = null;
      let cardBrand = null;
      let cardLast4 = null;
      let cardExpMonth = null;
      let cardExpYear = null;

      if (paymentData) {
        if (paymentMethod === 'stripe') {
          // 如果传入参数为空，尝试从 paymentData 中提取
          if (!finalStripePaymentIntentId && paymentData.id) {
            // paymentData.id 可能是 PaymentIntent ID
            finalStripePaymentIntentId = paymentData.id;
          }
          if (!finalStripeCustomerId && paymentData.customer) {
            finalStripeCustomerId = paymentData.customer;
          }
          // 注意：paymentData 中通常不会有 subscription.id，需要从外部传入
          
          // Stripe 卡片信息
          if (paymentData.payment_method && typeof paymentData.payment_method === 'object') {
            const pm = paymentData.payment_method;
            if (pm.card) {
              cardBrand = pm.card.brand || null;
              cardLast4 = pm.card.last4 || null;
              cardExpMonth = pm.card.exp_month || null;
              cardExpYear = pm.card.exp_year || null;
            }
          }
        } else if (paymentMethod === 'paypal') {
          // PayPal 订单ID可能在多个位置
          if (paymentData.id) {
            paypalOrderId = paymentData.id;
          } else if (paymentData.purchase_units && paymentData.purchase_units[0] && paymentData.purchase_units[0].payments && paymentData.purchase_units[0].payments.captures && paymentData.purchase_units[0].payments.captures[0]) {
            // PayPal 响应结构：purchase_units[0].payments.captures[0].id
            const capture = paymentData.purchase_units[0].payments.captures[0];
            paypalOrderId = capture.id || null;
          }
          
          // PayPal 支付者信息
          if (paymentData.payer && paymentData.payer.payer_id) {
            paypalPayerId = paymentData.payer.payer_id;
          }
        }
      }

      // 根据表结构，按顺序列出所有需要插入的字段（不包括 id, created_at, updated_at）
      // 表结构字段顺序：user_id, novel_id, payment_record_id, tier_level, tier_name, monthly_price, payment_amount,
      // payment_method, payment_status, subscription_type, subscription_duration_days, before_membership_snapshot,
      // after_membership_snapshot, start_date, end_date, is_active, auto_renew, stripe_subscription_id, stripe_payment_intent_id,
      // paypal_order_id, stripe_customer_id, paypal_payer_id, card_brand, card_last4, card_exp_month, card_exp_year,
      // currency, exchange_rate, local_amount, local_currency, discount_amount, discount_code, tax_amount, fee_amount,
      // refund_amount, refund_reason, refund_date, notes, ip_address, user_agent
      // 注意：transaction_id 已改名为 stripe_subscription_id，只存储 Stripe Subscription ID (sub_xxx)
      const sql = `
        INSERT INTO user_champion_subscription_record (
          user_id,
          novel_id,
          payment_record_id,
          tier_level,
          tier_name,
          monthly_price,
          payment_amount,
          payment_method,
          payment_status,
          subscription_type,
          subscription_duration_days,
          before_membership_snapshot,
          after_membership_snapshot,
          start_date,
          end_date,
          is_active,
          auto_renew,
          stripe_subscription_id,
          stripe_payment_intent_id,
          paypal_order_id,
          stripe_customer_id,
          paypal_payer_id,
          card_brand,
          card_last4,
          card_exp_month,
          card_exp_year,
          currency,
          exchange_rate,
          local_amount,
          local_currency,
          discount_amount,
          discount_code,
          tax_amount,
          fee_amount,
          refund_amount,
          refund_reason,
          refund_date,
          notes,
          ip_address,
          user_agent
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      const params = [
        userId,                                    // user_id
        novelId,                                   // novel_id
        paymentRecordId,                           // payment_record_id
        tierLevel,                                 // tier_level
        tierName,                                  // tier_name
        monthlyPrice,                              // monthly_price
        paymentAmount,                             // payment_amount
        paymentMethod,                             // payment_method
        paymentStatus,                             // payment_status
        subscriptionType,                          // subscription_type
        subscriptionDurationDays,                  // subscription_duration_days
        beforeMembershipSnapshot,                  // before_membership_snapshot
        afterMembershipSnapshot,                   // after_membership_snapshot
        startDate,                                 // start_date
        endDate,                                   // end_date
        1,                                         // is_active
        autoRenew || 0,                            // auto_renew（使用传入的值，升级场景需要）
        finalStripeSubscriptionId,                 // stripe_subscription_id (sub_xxx，只存储 Stripe Subscription ID)
        finalStripePaymentIntentId,                // stripe_payment_intent_id (pi_xxx)
        paypalOrderId,                             // paypal_order_id
        finalStripeCustomerId,                     // stripe_customer_id (cus_xxx)
        paypalPayerId,                             // paypal_payer_id
        cardBrand,                                 // card_brand
        cardLast4,                                 // card_last4
        cardExpMonth,                              // card_exp_month
        cardExpYear,                               // card_exp_year
        'USD',                                     // currency
        null,                                      // exchange_rate
        null,                                      // local_amount
        null,                                      // local_currency
        discountAmount || 0.00,                    // discount_amount
        discountCode || null,                      // discount_code
        0.00,                                      // tax_amount
        0.00,                                      // fee_amount
        0.00,                                      // refund_amount
        null,                                      // refund_reason
        null,                                      // refund_date
        null,                                      // notes
        null,                                      // ip_address
        null                                       // user_agent
      ];

      // 调试：验证参数数量
      console.log(`[createSubscriptionRecord] SQL 执行前验证 - 列数: 40, 占位符数: ${(sql.match(/\?/g) || []).length}, 参数数: ${params.length}`);
      
      if ((sql.match(/\?/g) || []).length !== params.length) {
        throw new Error(`参数数量不匹配: 占位符数=${(sql.match(/\?/g) || []).length}, 参数数=${params.length}`);
      }

      await this.db.execute(sql, params);

      console.log(`[createSubscriptionRecord] 订阅记录创建成功 - 用户: ${userId}, 小说: ${novelId}, 支付记录: ${paymentRecordId}`);
    } catch (error) {
      console.error('[createSubscriptionRecord] 创建订阅记录失败', {
        errorMessage: error.message,
        errorCode: error.code,
        errorStack: error.stack,
        userId,
        novelId,
        paymentRecordId,
        paymentMethod,
        paymentAmount,
        subscriptionType
      });
      // ⚠️ 抛出错误，让调用方知道有问题，避免静默失败
      throw error;
    }
  }

  // 处理 Stripe Champion 订阅创建
  // 在 Stripe Subscription 创建成功后调用此函数，写入 user_champion_subscription 和 user_champion_subscription_record
  // 使用 Stripe 提供的周期时间（current_period_start / current_period_end）而不是简单的 +30 天
  // promotionInfo: { promotionId, discountValue, discountAmount, effectivePrice, basePrice, percentOff, amountOff }
  async handleStripeChampionSubscriptionCreated({ userId, novelId, tierLevel, tierName, monthlyPrice, currency, subscription, customerId, paymentRecordId = null, promotionInfo = null }) {
    try {
      console.log(`[统一支付处理-Stripe订阅] 开始处理 - 用户: ${userId}, 小说: ${novelId}, 等级: ${tierLevel} (${tierName}), Subscription ID: ${subscription.id}`);

      // 1. 从 Stripe subscription 获取周期起止时间（Unix 时间戳）
      const periodStart = new Date(subscription.current_period_start * 1000);
      const periodEnd = new Date(subscription.current_period_end * 1000);
      
      // 计算订阅时长（天）
      const subscriptionDurationDays = Math.round((periodEnd - periodStart) / (1000 * 60 * 60 * 24));

      console.log(`[统一支付处理-Stripe订阅] 订阅周期 - 开始: ${periodStart.toISOString()}, 结束: ${periodEnd.toISOString()}, 时长: ${subscriptionDurationDays} 天`);

      // 2. 查询是否已存在订阅
      const [existingSubscription] = await this.db.execute(
        'SELECT id, tier_level, tier_name, start_date, end_date FROM user_champion_subscription WHERE user_id = ? AND novel_id = ? AND is_active = 1',
        [userId, novelId]
      );

      // 构造购买前会员快照
      const currentMembership = existingSubscription.length > 0 ? existingSubscription[0] : null;
      const beforeMembershipSnapshot = this.buildMembershipSnapshot(currentMembership);

      let startDate = periodStart;
      let endDate = periodEnd;

      if (existingSubscription.length > 0) {
        // 如果存在订阅，需要在现有到期时间基础上延长，而不是直接使用 Stripe 的周期时间
        // 重要：用户创建新的 Stripe 订阅时，应该延长现有订阅，而不是替换
        const existingEndDate = new Date(existingSubscription[0].end_date);
        
        // 计算订阅时长（天）
        const subscriptionDurationDays = Math.round((periodEnd - periodStart) / (1000 * 60 * 60 * 24));
        
        // 如果现有订阅的到期时间比 Stripe 订阅的周期结束时间更晚，在现有时间基础上延长
        // 这样可以避免缩短用户已经购买的订阅期限，同时正确延长订阅
        if (existingEndDate > periodEnd) {
          // 在现有到期时间基础上延长订阅时长
          endDate = new Date(existingEndDate.getTime() + subscriptionDurationDays * 24 * 60 * 60 * 1000);
          console.log(`[统一支付处理-Stripe订阅] 在现有到期时间基础上延长 - 现有: ${existingEndDate.toISOString().split('T')[0]}, 延长 ${subscriptionDurationDays} 天, 新到期: ${endDate.toISOString().split('T')[0]}`);
        } else {
          // 如果 Stripe 订阅的周期结束时间更晚，在现有时间基础上延长（而不是直接使用 Stripe 时间）
          // 这样可以确保订阅是延长的，而不是替换
          endDate = new Date(existingEndDate.getTime() + subscriptionDurationDays * 24 * 60 * 60 * 1000);
          console.log(`[统一支付处理-Stripe订阅] 在现有到期时间基础上延长 - 现有: ${existingEndDate.toISOString().split('T')[0]}, 延长 ${subscriptionDurationDays} 天, 新到期: ${endDate.toISOString().split('T')[0]}`);
        }
        
        // monthly_price 始终保存原价（basePrice）
        // 同时写入 stripe_subscription_id 和 stripe_customer_id
        await this.db.execute(
          `UPDATE user_champion_subscription 
           SET tier_level = ?, tier_name = ?, monthly_price = ?, 
               start_date = COALESCE(start_date, ?), end_date = ?, 
               is_active = 1, payment_method = 'stripe', 
               auto_renew = 1, stripe_subscription_id = ?, 
               stripe_customer_id = ?,
               cancel_at_period_end = 0, cancelled_at = NULL,
               updated_at = NOW() 
           WHERE id = ?`,
          [tierLevel, tierName, monthlyPrice, periodStart, endDate, subscription.id, customerId, existingSubscription[0].id]
        );
        console.log(`[统一支付处理-Stripe订阅] 更新订阅 - 用户: ${userId}, 小说: ${novelId}, 最终到期时间: ${endDate.toISOString().split('T')[0]}`);

        // === 注意：不能在订阅创建后立即更新 billing_cycle_anchor ===
        // Stripe 不允许在订阅创建后立即更新 billing_cycle_anchor（错误：must be either unset, 'now', or 'unchanged'）
        // 如果需要同步 billing_cycle_anchor，应该在订阅创建时通过 billing_cycle_anchor 参数设置
        // 或者等待订阅激活后再更新（但可能已经产生第一个 invoice）
        // 当前实现：先创建订阅，billing_cycle_anchor 的同步在手动购买时处理
      } else {
        // 创建新订阅记录（使用 Stripe 提供的周期时间）
        // monthly_price 始终保存原价（basePrice）
        // 同时写入 stripe_subscription_id 和 stripe_customer_id
        await this.db.execute(
          `INSERT INTO user_champion_subscription 
           (user_id, novel_id, tier_level, tier_name, monthly_price, 
            start_date, end_date, is_active, payment_method, 
            auto_renew, stripe_subscription_id, stripe_customer_id, cancel_at_period_end, created_at) 
           VALUES (?, ?, ?, ?, ?, ?, ?, 1, 'stripe', 1, ?, ?, 0, NOW())`,
          [userId, novelId, tierLevel, tierName, monthlyPrice, periodStart, periodEnd, subscription.id, customerId]
        );
        console.log(`[统一支付处理-Stripe订阅] 创建新订阅 - 用户: ${userId}, 小说: ${novelId}`);
      }

      // 3. 获取支付金额（从 subscription.latest_invoice 或 promotionInfo 计算）
      // 注意：如果订阅是 incomplete 状态，amount_paid 可能是 0，需要从 promotionInfo 计算实际支付金额
      let amountPaid = subscription.latest_invoice?.amount_paid || 0;
      let paymentAmount = amountPaid / 100; // 转换为美元

      // 4. 计算折扣信息
      // monthlyPrice 是原价（basePrice），paymentAmount 是实际支付金额
      const basePrice = monthlyPrice; // 原价
      let actualPaymentAmount = paymentAmount; // 实际支付金额
      let discountAmount = 0;
      let discountCode = null;

      // 如果有促销信息，使用促销信息计算实际支付金额
      if (promotionInfo) {
        actualPaymentAmount = promotionInfo.effectivePrice || (basePrice - promotionInfo.discountAmount);
        discountAmount = promotionInfo.discountAmount || (basePrice - actualPaymentAmount);
        discountCode = `promo_${promotionInfo.promotionId}`;
        
        // 如果 amountPaid 为 0，使用计算出的实际支付金额
        if (paymentAmount === 0) {
          paymentAmount = actualPaymentAmount;
          console.log(`[统一支付处理-Stripe订阅] 订阅未完成支付，使用促销信息计算实际支付金额: $${actualPaymentAmount}`);
        }
      } else {
        // 如果没有促销信息，使用 invoice 的金额
        discountAmount = basePrice - actualPaymentAmount;
      }

      console.log(`[统一支付处理-Stripe订阅] 价格信息 - 原价: $${basePrice}, 实际支付: $${actualPaymentAmount}, 折扣: $${discountAmount}, 折扣代码: ${discountCode || '无'}`);

      // 5. 创建详细支付记录
      // 注意：afterMembershipSnapshot 中的 end_date 应该使用实际的到期时间（可能是保留的现有到期时间）
      const afterMembershipSnapshot = JSON.stringify({
        tier_level: tierLevel,
        tier_name: tierName,
        start_date: this.formatDateTime(periodStart),
        end_date: this.formatDateTime(endDate) // 使用实际的 endDate（可能是保留的现有到期时间）
      });

      // 提取 PaymentIntent ID（如果有）
      let paymentIntentId = null;
      if (subscription.latest_invoice?.payment_intent) {
        const paymentIntent = subscription.latest_invoice.payment_intent;
        paymentIntentId = typeof paymentIntent === 'object' ? paymentIntent.id : paymentIntent;
      }

      await this.createSubscriptionRecord({
        userId,
        novelId,
        paymentRecordId,
        tierLevel,
        tierName,
        monthlyPrice: basePrice, // 保存原价
        paymentAmount: actualPaymentAmount, // 保存实际支付金额（如果订阅未完成支付，这里可能是 0，会在 webhook 中更新）
        paymentMethod: 'stripe',
        paymentStatus: subscription.status === 'active' ? 'completed' : 'pending', // 如果订阅未完成，状态为 pending
        subscriptionType: existingSubscription.length > 0 ? 'extend' : 'new',
        subscriptionDurationDays,
        beforeMembershipSnapshot,
        afterMembershipSnapshot,
        startDate: periodStart,
        endDate: endDate, // 使用实际的 endDate（可能是保留的现有到期时间）
        paymentData: {
          id: subscription.id,
          customer: customerId,
          latest_invoice: subscription.latest_invoice
        },
        discountAmount: discountAmount, // 折扣金额
        discountCode: discountCode, // 折扣代码
        autoRenew: 1, // Stripe 订阅默认开启自动续费
        stripeSubscriptionId: subscription.id, // Stripe Subscription ID (sub_xxx)
        stripePaymentIntentId: paymentIntentId, // Stripe PaymentIntent ID (pi_xxx)
        stripeCustomerId: customerId // Stripe Customer ID (cus_xxx)
      });

      console.log(`[统一支付处理-Stripe订阅] 处理完成 - 用户: ${userId}, 小说: ${novelId}, 等级: ${tierLevel} (${tierName})`);

      return {
        success: true,
        tierLevel,
        tierName,
        subscriptionId: subscription.id,
        currentPeriodStart: periodStart,
        currentPeriodEnd: periodEnd
      };
    } catch (error) {
      console.error('[统一支付处理-Stripe订阅] 处理失败:', error);
      throw new Error(`Stripe订阅处理失败: ${error.message}`);
    }
  }
}

module.exports = UnifiedPaymentService;
