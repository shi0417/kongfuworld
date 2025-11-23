const mysql = require('mysql2/promise');

class UnifiedPaymentService {
  constructor() {
    this.db = mysql.createPool({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '123456',
      database: process.env.DB_NAME || 'kongfuworld'
    });
  }

  // 统一的支付成功处理逻辑
  async handlePaymentSuccess(userId, novelId, amount, paymentMethod, paymentRecordId, paymentData = null) {
    try {
      console.log(`[统一支付处理] 开始处理支付 - 用户: ${userId}, 小说: ${novelId}, 金额: $${amount}, 方式: ${paymentMethod}`);
      
      // 1. 根据金额和小说ID从数据库获取等级信息
      const [tierInfo] = await this.db.execute(
        'SELECT tier_level, tier_name FROM novel_champion_tiers WHERE novel_id = ? AND monthly_price = ? AND is_active = 1',
        [novelId, amount]
      );

      let tierLevel = 0;
      let tierName = 'Unknown';

      if (tierInfo.length > 0) {
        tierLevel = tierInfo[0].tier_level;
        tierName = tierInfo[0].tier_name;
        console.log(`[统一支付处理] 找到等级: ${tierLevel} (${tierName})`);
      } else {
        console.warn(`[统一支付处理] 未找到等级信息 - 小说: ${novelId}, 金额: $${amount}`);
      }

      // 2. 检查是否已存在订阅
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
        console.log(`[统一支付处理] 延长订阅 - 用户: ${userId}, 小说: ${novelId}, 新到期时间: ${endDate.toISOString().split('T')[0]}`);
      } else {
        // 创建新的Champion订阅
        await this.db.execute(
          'INSERT INTO user_champion_subscription (user_id, novel_id, tier_level, tier_name, monthly_price, start_date, end_date, payment_method, is_active, created_at) VALUES (?, ?, ?, ?, ?, NOW(), DATE_ADD(NOW(), INTERVAL 1 MONTH), ?, ?, NOW())',
          [userId, novelId, tierLevel, tierName, amount, paymentMethod, 1]
        );
        console.log(`[统一支付处理] 创建新订阅 - 用户: ${userId}, 小说: ${novelId}`);
      }

      // 3. 创建详细支付记录
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
          paymentMethod,
          paymentData
        );
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
  async createSubscriptionRecord(userId, novelId, paymentRecordId, tierLevel, tierName, amount, subscriptionType, startDate, endDate, paymentMethod, paymentData = null) {
    try {
      const recordData = {
        user_id: userId,
        novel_id: novelId,
        payment_record_id: paymentRecordId,
        tier_level: tierLevel,
        tier_name: tierName,
        monthly_price: amount,
        payment_amount: amount,
        payment_method: paymentMethod,
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
        paypal_order_id: null,
        paypal_payer_id: null,
        card_brand: null,
        card_last4: null,
        card_exp_month: null,
        card_exp_year: null
      };

      // 根据支付方式设置相应的字段
      if (paymentData) {
        if (paymentMethod === 'stripe' && paymentData.id) {
          recordData.transaction_id = paymentData.id;
          recordData.stripe_payment_intent_id = paymentData.id;
          recordData.stripe_customer_id = paymentData.customer;
          
          // Stripe卡片信息
          if (paymentData.payment_method && typeof paymentData.payment_method === 'object') {
            const pm = paymentData.payment_method;
            if (pm.card) {
              recordData.card_brand = pm.card.brand;
              recordData.card_last4 = pm.card.last4;
              recordData.card_exp_month = pm.card.exp_month;
              recordData.card_exp_year = pm.card.exp_year;
            }
          }
        } else if (paymentMethod === 'paypal' && paymentData.id) {
          recordData.transaction_id = paymentData.id;
          recordData.paypal_order_id = paymentData.id;
          
          // PayPal支付者信息
          if (paymentData.payer && paymentData.payer.payer_id) {
            recordData.paypal_payer_id = paymentData.payer.payer_id;
          }
        }
      }

      await this.db.execute(
        `INSERT INTO user_champion_subscription_record (
          user_id, novel_id, payment_record_id, tier_level, tier_name, 
          monthly_price, payment_amount, payment_method, payment_status, 
          subscription_type, subscription_duration_months, start_date, end_date, 
          is_active, auto_renew, currency, transaction_id, stripe_payment_intent_id, 
          stripe_customer_id, paypal_order_id, paypal_payer_id, card_brand, 
          card_last4, card_exp_month, card_exp_year
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          recordData.user_id, recordData.novel_id, recordData.payment_record_id,
          recordData.tier_level, recordData.tier_name, recordData.monthly_price,
          recordData.payment_amount, recordData.payment_method, recordData.payment_status,
          recordData.subscription_type, recordData.subscription_duration_months,
          recordData.start_date, recordData.end_date, recordData.is_active,
          recordData.auto_renew, recordData.currency, recordData.transaction_id,
          recordData.stripe_payment_intent_id, recordData.stripe_customer_id,
          recordData.paypal_order_id, recordData.paypal_payer_id, recordData.card_brand,
          recordData.card_last4, recordData.card_exp_month, recordData.card_exp_year
        ]
      );

      console.log(`[统一支付处理] 创建详细记录 - 用户: ${userId}, 小说: ${novelId}, 支付记录: ${paymentRecordId}`);
    } catch (error) {
      console.error('[统一支付处理] 创建详细记录失败:', error);
      // 不抛出错误，避免影响主流程
    }
  }
}

module.exports = UnifiedPaymentService;
