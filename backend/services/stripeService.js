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
      // 检查是否已存在订阅
      const [existingSubscription] = await this.db.execute(
        'SELECT id, end_date FROM user_champion_subscription WHERE user_id = ? AND novel_id = ? AND is_active = 1',
        [userId, novelId]
      );

      let subscriptionType = 'new';
      let startDate = new Date();
      let endDate = new Date();
      endDate.setMonth(endDate.getMonth() + 1);

      if (existingSubscription.length > 0) {
        // 如果存在订阅，延长到期时间
        subscriptionType = 'extend';
        const currentEndDate = new Date(existingSubscription[0].end_date);
        startDate = currentEndDate;
        endDate = new Date(currentEndDate.setMonth(currentEndDate.getMonth() + 1));
        
        await this.db.execute(
          'UPDATE user_champion_subscription SET tier_level = ?, tier_name = ?, monthly_price = ?, end_date = ?, updated_at = NOW() WHERE id = ?',
          [tierLevel, tierName, amount, endDate, existingSubscription[0].id]
        );
        console.log(`Extended subscription for user ${userId}, novel ${novelId}. New end date: ${endDate.toISOString().split('T')[0]}`);
      } else {
        // 创建新的Champion订阅
        await this.db.execute(
          'INSERT INTO user_champion_subscription (user_id, novel_id, tier_level, tier_name, monthly_price, start_date, end_date, payment_method, is_active, created_at) VALUES (?, ?, ?, ?, ?, NOW(), DATE_ADD(NOW(), INTERVAL 1 MONTH), ?, ?, NOW())',
          [userId, novelId, tierLevel, tierName, amount, 'stripe', 1]
        );
        console.log(`Created new subscription for user ${userId}, novel ${novelId}.`);
      }

      // 记录详细的支付信息到 user_champion_subscription_record 表
      if (paymentRecordId) {
        await this.createSubscriptionRecord(
          userId, 
          novelId, 
          paymentRecordId, 
          tierLevel, 
          tierName, 
          amount, 
          subscriptionType,
          startDate,
          endDate,
          paymentIntent
        );
      }
    } catch (error) {
      throw new Error(`Champion subscription creation failed: ${error.message}`);
    }
  }

  // 创建订阅记录详情
  async createSubscriptionRecord(userId, novelId, paymentRecordId, tierLevel, tierName, amount, subscriptionType, startDate, endDate, paymentIntent = null) {
    try {
      const recordData = {
        user_id: userId,
        novel_id: novelId,
        payment_record_id: paymentRecordId,
        tier_level: tierLevel,
        tier_name: tierName,
        monthly_price: amount,
        payment_amount: amount,
        payment_method: 'stripe',
        payment_status: 'completed',
        subscription_type: subscriptionType,
        subscription_duration_months: 1,
        start_date: startDate,
        end_date: endDate,
        is_active: 1,
        auto_renew: 0,
        currency: 'USD',
        // 默认值，避免 undefined
        transaction_id: null,
        stripe_payment_intent_id: null,
        stripe_customer_id: null,
        card_brand: null,
        card_last4: null,
        card_exp_month: null,
        card_exp_year: null
      };

      // 如果有PaymentIntent信息，添加更多详情
      if (paymentIntent) {
        recordData.transaction_id = paymentIntent.id || null;
        recordData.stripe_payment_intent_id = paymentIntent.id || null;
        recordData.stripe_customer_id = paymentIntent.customer || null;
        
        // 如果有支付方式信息
        if (paymentIntent.payment_method && typeof paymentIntent.payment_method === 'object') {
          const pm = paymentIntent.payment_method;
          if (pm.card) {
            recordData.card_brand = pm.card.brand || null;
            recordData.card_last4 = pm.card.last4 || null;
            recordData.card_exp_month = pm.card.exp_month || null;
            recordData.card_exp_year = pm.card.exp_year || null;
          }
        }
      }

      await this.db.execute(
        `INSERT INTO user_champion_subscription_record (
          user_id, novel_id, payment_record_id, tier_level, tier_name, 
          monthly_price, payment_amount, payment_method, payment_status, 
          subscription_type, subscription_duration_months, start_date, end_date, 
          is_active, auto_renew, currency, transaction_id, stripe_payment_intent_id, 
          stripe_customer_id, card_brand, card_last4, card_exp_month, card_exp_year
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          recordData.user_id, recordData.novel_id, recordData.payment_record_id,
          recordData.tier_level, recordData.tier_name, recordData.monthly_price,
          recordData.payment_amount, recordData.payment_method, recordData.payment_status,
          recordData.subscription_type, recordData.subscription_duration_months,
          recordData.start_date, recordData.end_date, recordData.is_active,
          recordData.auto_renew, recordData.currency, recordData.transaction_id,
          recordData.stripe_payment_intent_id, recordData.stripe_customer_id,
          recordData.card_brand, recordData.card_last4, recordData.card_exp_month,
          recordData.card_exp_year
        ]
      );

      console.log(`Created subscription record for user ${userId}, novel ${novelId}, payment record ${paymentRecordId}`);
    } catch (error) {
      console.error('Failed to create subscription record:', error);
      // 不抛出错误，避免影响主流程
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