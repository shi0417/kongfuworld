const mysql = require('mysql2/promise');
const stripe = require('stripe');

// 加载环境变量
try {
  require('dotenv').config({ path: './kongfuworld.env' });
} catch (error) {
  console.log('dotenv not available, using default values');
}

// Stripe配置
const STRIPE_CONFIG = {
  secretKey: process.env.STRIPE_SECRET_KEY,
  publishableKey: process.env.STRIPE_PUBLISHABLE_KEY,
  webhookSecret: process.env.STRIPE_WEBHOOK_SECRET
};

console.log('Stripe配置初始化:', {
  secretKey: STRIPE_CONFIG.secretKey ? '已设置' : '未设置',
  publishableKey: STRIPE_CONFIG.publishableKey ? '已设置' : '未设置',
  webhookSecret: STRIPE_CONFIG.webhookSecret ? '已设置' : '未设置'
});

class StripeService {
  constructor() {
    this.db = mysql.createPool({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'kongfuworld'
    });
    
    // 初始化Stripe客户端
    this.stripe = stripe(STRIPE_CONFIG.secretKey);
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

  // 创建支付意图
  async createPaymentIntent(userId, amount, currency = 'usd', novelId = null, paymentMethodId = null) {
    try {
      const paymentIntentData = {
        amount: Math.round(amount * 100), // 转换为分
        currency: currency,
        metadata: {
          userId: userId.toString(),
          novelId: novelId ? novelId.toString() : '7',
          type: 'champion_subscription'
        },
        automatic_payment_methods: {
          enabled: true,
        },
      };

      // 如果提供了支付方式ID，使用它
      if (paymentMethodId) {
        paymentIntentData.payment_method = paymentMethodId;
        paymentIntentData.confirmation_method = 'manual';
        paymentIntentData.confirm = true;
      }

      const paymentIntent = await this.stripe.paymentIntents.create(paymentIntentData);

      console.log('Stripe PaymentIntent创建成功:', paymentIntent.id);
      return paymentIntent;
    } catch (error) {
      console.error('Stripe PaymentIntent创建失败:', error);
      throw new Error(`Stripe payment creation failed: ${error.message}`);
    }
  }

  // 确认支付意图
  async confirmPaymentIntent(paymentIntentId) {
    try {
      const paymentIntent = await this.stripe.paymentIntents.retrieve(paymentIntentId);
      return paymentIntent;
    } catch (error) {
      console.error('Stripe PaymentIntent确认失败:', error);
      throw new Error(`Stripe payment confirmation failed: ${error.message}`);
    }
  }

  // 创建Karma支付意图 - 独立处理，不依赖Champion逻辑
  async createKarmaPaymentIntent(userId, amount, currency = 'usd', packageId) {
    try {
      const paymentIntentData = {
        amount: Math.round(amount), // 已经是分，不需要再转换
        currency: currency,
        metadata: {
          userId: userId.toString(),
          packageId: packageId.toString(),
          type: 'karma_purchase'
        },
        automatic_payment_methods: {
          enabled: true,
        },
      };

      const paymentIntent = await this.stripe.paymentIntents.create(paymentIntentData);

      console.log('Stripe Karma PaymentIntent创建成功:', paymentIntent.id);
      return paymentIntent;
    } catch (error) {
      console.error('Stripe Karma PaymentIntent创建失败:', error);
      throw new Error(`Stripe karma payment creation failed: ${error.message}`);
    }
  }

  // 记录支付到数据库
  async recordPayment(userId, amount, paymentId, status = 'pending', novelId = null) {
    try {
      const description = novelId ? 
        `Stripe Payment ID: ${paymentId} | Novel ID: ${novelId}` : 
        `Stripe Payment ID: ${paymentId}`;
      
      const [result] = await this.db.execute(
        'INSERT INTO payment_record (user_id, novel_id, amount, payment_method, status, type, description) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [userId, novelId, amount, 'stripe', status, 'recharge', description]
      );
      return result.insertId;
    } catch (error) {
      throw new Error(`Database record failed: ${error.message}`);
    }
  }

  // 更新支付状态
  async updatePaymentStatus(paymentId, status, transactionId = null) {
    try {
      // 查找包含PaymentIntent ID的记录
      const [rows] = await this.db.execute(
        'SELECT id, description FROM payment_record WHERE description LIKE ?',
        [`%${paymentId}%`]
      );
      
      if (rows.length === 0) {
        console.warn(`未找到包含PaymentIntent ID ${paymentId}的支付记录`);
        return;
      }
      
      // 更新状态，保留原始description
      await this.db.execute(
        'UPDATE payment_record SET status = ?, updated_at = NOW() WHERE description LIKE ?',
        [status, `%${paymentId}%`]
      );
      
      console.log(`支付记录状态已更新: ${paymentId} -> ${status}`);
    } catch (error) {
      throw new Error(`Payment status update failed: ${error.message}`);
    }
  }

  // 创建Champion订阅
  async createChampionSubscription(userId, novelId, amount, tierLevel, tierName, paymentRecordId = null, paymentIntent = null) {
    try {
      // 检查是否已存在订阅（获取完整会员信息用于快照）
      const [existingSubscription] = await this.db.execute(
        'SELECT id, tier_level, tier_name, start_date, end_date FROM user_champion_subscription WHERE user_id = ? AND novel_id = ? AND is_active = 1',
        [userId, novelId]
      );

      // 构造购买前会员快照（在计算新日期之前）
      const currentMembership = existingSubscription.length > 0 ? existingSubscription[0] : null;
      const beforeMembershipSnapshot = this.buildMembershipSnapshot(currentMembership);

      // Champion 订阅采用「每笔订单 = 30 天服务期」的固定周期
      let subscriptionType = 'new';
      let startDate = new Date();
      // 新订阅：从当前时间开始，固定30天
      let endDate = new Date(startDate.getTime() + 30 * 24 * 60 * 60 * 1000);

      if (existingSubscription.length > 0) {
        // 如果存在订阅，延长到期时间
        // 续费：仍然以「现有订阅的 end_date 为下一段 start」的排队模型，但改成 30 天
        subscriptionType = 'extend';
        const currentEndDate = new Date(existingSubscription[0].end_date);
        startDate = currentEndDate;
        endDate = new Date(currentEndDate.getTime() + 30 * 24 * 60 * 60 * 1000);
        
        await this.db.execute(
          'UPDATE user_champion_subscription SET tier_level = ?, tier_name = ?, monthly_price = ?, end_date = ?, updated_at = NOW() WHERE id = ?',
          [tierLevel, tierName, amount, endDate, existingSubscription[0].id]
        );
        console.log(`Extended subscription for user ${userId}, novel ${novelId}. New end date: ${endDate.toISOString().split('T')[0]}`);
      } else {
        // 创建新的Champion订阅
        await this.db.execute(
          'INSERT INTO user_champion_subscription (user_id, novel_id, tier_level, tier_name, monthly_price, start_date, end_date, payment_method, is_active, created_at) VALUES (?, ?, ?, ?, ?, NOW(), DATE_ADD(NOW(), INTERVAL 30 DAY), ?, ?, NOW())',
          [userId, novelId, tierLevel, tierName, amount, 'stripe', 1]
        );
        console.log(`Created new subscription for user ${userId}, novel ${novelId}.`);
      }

      // 记录详细的支付信息到 user_champion_subscription_record 表
      if (paymentRecordId) {
        console.log('[createChampionSubscription] 准备创建订阅记录', {
          userId,
          novelId,
          paymentRecordId,
          paymentMethod: 'stripe',
          amount,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          subscriptionType
        });
        
        await this.createSubscriptionRecord({
          userId,
          novelId,
          paymentRecordId,
          tierLevel,
          tierName,
          monthlyPrice: amount,
          paymentAmount: amount,
          paymentMethod: 'stripe',
          paymentStatus: 'completed',
          subscriptionType,
          subscriptionDurationDays: 30,
          beforeMembershipSnapshot,
          afterMembershipSnapshot: JSON.stringify({
            tier_level: tierLevel,
            tier_name: tierName,
            start_date: this.formatDateTime(startDate),
            end_date: this.formatDateTime(endDate)
          }),
          startDate,
          endDate,
          paymentData: paymentIntent
        });
        
        console.log('[createChampionSubscription] 订阅记录创建成功');
      } else {
        console.warn('[createChampionSubscription] paymentRecordId 为空，跳过创建订阅记录');
      }
    } catch (error) {
      throw new Error(`Champion subscription creation failed: ${error.message}`);
    }
  }

  // 创建订阅记录详情
  // 参数说明：与 unifiedPaymentService.createSubscriptionRecord 保持一致
  async createSubscriptionRecord(payload) {
    const {
      userId,
      novelId,
      paymentRecordId,
      tierLevel,
      tierName,
      monthlyPrice,
      paymentAmount,
      paymentMethod = 'stripe',
      paymentStatus = 'completed',
      subscriptionType,
      subscriptionDurationDays = 30,
      beforeMembershipSnapshot,
      afterMembershipSnapshot,
      startDate,
      endDate,
      paymentData = null
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
      let transactionId = null;
      let stripePaymentIntentId = null;
      let paypalOrderId = null;
      let stripeCustomerId = null;
      let paypalPayerId = null;
      let cardBrand = null;
      let cardLast4 = null;
      let cardExpMonth = null;
      let cardExpYear = null;

      if (paymentData) {
        if (paymentMethod === 'stripe' && paymentData.id) {
          transactionId = paymentData.id;
          stripePaymentIntentId = paymentData.id;
          stripeCustomerId = paymentData.customer || null;
          
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
            transactionId = paymentData.id;
            paypalOrderId = paymentData.id;
          } else if (paymentData.purchase_units && paymentData.purchase_units[0] && paymentData.purchase_units[0].payments && paymentData.purchase_units[0].payments.captures && paymentData.purchase_units[0].payments.captures[0]) {
            const capture = paymentData.purchase_units[0].payments.captures[0];
            transactionId = capture.id || null;
            paypalOrderId = capture.id || null;
          }
          
          if (paymentData.payer && paymentData.payer.payer_id) {
            paypalPayerId = paymentData.payer.payer_id;
          }
        }
      }

      // 使用与 unifiedPaymentService 完全相同的 INSERT 语句结构
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
          transaction_id,
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
        0,                                         // auto_renew
        transactionId,                             // transaction_id
        stripePaymentIntentId,                     // stripe_payment_intent_id
        paypalOrderId,                             // paypal_order_id
        stripeCustomerId,                           // stripe_customer_id
        paypalPayerId,                             // paypal_payer_id
        cardBrand,                                 // card_brand
        cardLast4,                                 // card_last4
        cardExpMonth,                              // card_exp_month
        cardExpYear,                               // card_exp_year
        'USD',                                     // currency
        null,                                      // exchange_rate
        null,                                      // local_amount
        null,                                      // local_currency
        0.00,                                      // discount_amount
        null,                                      // discount_code
        0.00,                                      // tax_amount
        0.00,                                      // fee_amount
        0.00,                                      // refund_amount
        null,                                      // refund_reason
        null,                                      // refund_date
        null,                                      // notes
        null,                                      // ip_address
        null                                       // user_agent
      ];

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

  // 处理Webhook事件
  async handleWebhook(payload, signature) {
    try {
      const event = this.stripe.webhooks.constructEvent(
        payload,
        signature,
        STRIPE_CONFIG.webhookSecret
      );

      console.log('Stripe Webhook事件:', event.type);

      switch (event.type) {
        case 'payment_intent.succeeded':
          await this.handlePaymentSuccess(event.data.object);
          break;
        case 'payment_intent.payment_failed':
          await this.handlePaymentFailure(event.data.object);
          break;
        default:
          console.log(`未处理的Stripe事件类型: ${event.type}`);
      }

      return { received: true };
    } catch (error) {
      console.error('Stripe Webhook处理失败:', error);
      throw new Error(`Webhook handling failed: ${error.message}`);
    }
  }

  // 处理支付成功
  async handlePaymentSuccess(paymentIntent) {
    try {
      const { userId, novelId } = paymentIntent.metadata;
      const amount = paymentIntent.amount / 100; // 转换回元

      // 更新支付状态
      await this.updatePaymentStatus(paymentIntent.id, 'completed', paymentIntent.id);

      // 根据金额和小说ID从数据库获取等级信息
      const [tierInfo] = await this.db.execute(
        'SELECT tier_level, tier_name FROM novel_champion_tiers WHERE novel_id = ? AND monthly_price = ? AND is_active = 1',
        [novelId, amount]
      );

      let tierLevel = 0;
      let tierName = 'Unknown';

      if (tierInfo.length > 0) {
        tierLevel = tierInfo[0].tier_level;
        tierName = tierInfo[0].tier_name;
      } else {
        console.warn(`No tier found for novel ${novelId} with amount ${amount}`);
      }

      // 创建Champion订阅
      await this.createChampionSubscription(
        parseInt(userId),
        parseInt(novelId),
        amount,
        tierLevel,
        tierName
      );

      console.log(`Stripe支付成功处理完成: ${paymentIntent.id}`);
    } catch (error) {
      console.error('处理Stripe支付成功失败:', error);
    }
  }

  // 处理支付失败
  async handlePaymentFailure(paymentIntent) {
    try {
      await this.updatePaymentStatus(paymentIntent.id, 'failed');
      console.log(`Stripe支付失败处理完成: ${paymentIntent.id}`);
    } catch (error) {
      console.error('处理Stripe支付失败失败:', error);
    }
  }

  // 获取用户的支付方式
  async getUserPaymentMethods(userId) {
    try {
      const [rows] = await this.db.execute(
        'SELECT * FROM user_payment_methods WHERE user_id = ? AND is_active = 1 ORDER BY is_default DESC, created_at DESC',
        [userId]
      );
      return rows;
    } catch (error) {
      throw new Error(`获取用户支付方式失败: ${error.message}`);
    }
  }

  // 保存支付方式
  async savePaymentMethod(userId, paymentMethodId, cardInfo) {
    try {
      const [result] = await this.db.execute(
        'INSERT INTO user_payment_methods (user_id, payment_method_id, card_brand, card_last4, card_exp_month, card_exp_year, is_default) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [
          userId,
          paymentMethodId,
          cardInfo.brand,
          cardInfo.last4,
          cardInfo.exp_month,
          cardInfo.exp_year,
          0 // 新添加的支付方式默认不是默认方式
        ]
      );
      return result.insertId;
    } catch (error) {
      throw new Error(`保存支付方式失败: ${error.message}`);
    }
  }

  // 设置默认支付方式
  async setDefaultPaymentMethod(userId, paymentMethodId) {
    try {
      // 先清除所有默认标记
      await this.db.execute(
        'UPDATE user_payment_methods SET is_default = 0 WHERE user_id = ?',
        [userId]
      );
      
      // 设置新的默认支付方式
      await this.db.execute(
        'UPDATE user_payment_methods SET is_default = 1 WHERE user_id = ? AND payment_method_id = ?',
        [userId, paymentMethodId]
      );
    } catch (error) {
      throw new Error(`设置默认支付方式失败: ${error.message}`);
    }
  }

  // 删除支付方式
  async deletePaymentMethod(userId, paymentMethodId) {
    try {
      await this.db.execute(
        'UPDATE user_payment_methods SET is_active = 0 WHERE user_id = ? AND payment_method_id = ?',
        [userId, paymentMethodId]
      );
    } catch (error) {
      throw new Error(`删除支付方式失败: ${error.message}`);
    }
  }
}

module.exports = StripeService;