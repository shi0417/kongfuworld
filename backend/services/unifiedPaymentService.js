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

      // 2. 检查是否已存在订阅（获取完整会员信息用于快照）
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
        console.log(`[统一支付处理] 延长订阅 - 用户: ${userId}, 小说: ${novelId}, 新到期时间: ${endDate.toISOString().split('T')[0]}`);
      } else {
        // 创建新的Champion订阅
        await this.db.execute(
          'INSERT INTO user_champion_subscription (user_id, novel_id, tier_level, tier_name, monthly_price, start_date, end_date, payment_method, is_active, created_at) VALUES (?, ?, ?, ?, ?, NOW(), DATE_ADD(NOW(), INTERVAL 30 DAY), ?, ?, NOW())',
          [userId, novelId, tierLevel, tierName, amount, paymentMethod, 1]
        );
        console.log(`[统一支付处理] 创建新订阅 - 用户: ${userId}, 小说: ${novelId}`);
      }

      // 3. 创建详细支付记录
      if (paymentRecordId) {
        console.log('[handlePaymentSuccess] 准备创建订阅记录', {
          userId,
          novelId,
          paymentRecordId,
          paymentMethod,
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
          paymentMethod,
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
          paymentData
        });
        
        console.log('[handlePaymentSuccess] 订阅记录创建成功');
      } else {
        console.warn('[handlePaymentSuccess] paymentRecordId 为空，跳过创建订阅记录');
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
            // PayPal 响应结构：purchase_units[0].payments.captures[0].id
            const capture = paymentData.purchase_units[0].payments.captures[0];
            transactionId = capture.id || null;
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
      // after_membership_snapshot, start_date, end_date, is_active, auto_renew, transaction_id, stripe_payment_intent_id,
      // paypal_order_id, stripe_customer_id, paypal_payer_id, card_brand, card_last4, card_exp_month, card_exp_year,
      // currency, exchange_rate, local_amount, local_currency, discount_amount, discount_code, tax_amount, fee_amount,
      // refund_amount, refund_reason, refund_date, notes, ip_address, user_agent
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
        stripeCustomerId,                          // stripe_customer_id
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
}

module.exports = UnifiedPaymentService;
