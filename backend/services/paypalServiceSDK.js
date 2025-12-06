const mysql = require('mysql2/promise');
const paypal = require('@paypal/checkout-server-sdk');

// 加载环境变量
try {
  require('dotenv').config({ path: '../kongfuworld.env' });
} catch (error) {
  console.log('dotenv not available, using default values');
}

// PayPal配置
const PAYPAL_CONFIG = {
  environment: process.env.PAYPAL_MODE || 'sandbox',
  clientId: process.env.PAYPAL_CLIENT_ID,
  clientSecret: process.env.PAYPAL_CLIENT_SECRET,
  baseUrl: process.env.PAYPAL_MODE === 'live' ? 'api.paypal.com' : 'api.sandbox.paypal.com'
};

console.log('PayPal配置初始化:', {
  environment: PAYPAL_CONFIG.environment,
  clientId: PAYPAL_CONFIG.clientId ? '已设置' : '未设置',
  clientSecret: PAYPAL_CONFIG.clientSecret ? '已设置' : '未设置',
  baseUrl: PAYPAL_CONFIG.baseUrl
});

class PayPalServiceSDK {
  constructor() {
    this.db = mysql.createPool({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'kongfuworld'
    });
    
    // 初始化PayPal客户端
    this.client = this.createPayPalClient();
  }

  createPayPalClient() {
    const environment = PAYPAL_CONFIG.environment === 'live' 
      ? new paypal.core.LiveEnvironment(PAYPAL_CONFIG.clientId, PAYPAL_CONFIG.clientSecret)
      : new paypal.core.SandboxEnvironment(PAYPAL_CONFIG.clientId, PAYPAL_CONFIG.clientSecret);
    
    return new paypal.core.PayPalHttpClient(environment);
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

  // 创建支付订单
  async createPayment(userId, amount, currency = 'USD', description = '', paymentType = 'champion', packageId = null) {
    try {
      console.log(`[PayPal SDK支付创建] 参数 - userId: ${userId}, amount: ${amount}, paymentType: ${paymentType}`);
      
      const request = new paypal.orders.OrdersCreateRequest();
      request.prefer("return=representation");
      
      // 根据PayPal官方文档，正确设置请求体
      const requestBody = {
        intent: 'CAPTURE',
        purchase_units: [{
          amount: {
            currency_code: currency,
            value: amount.toString()
          },
          description: description,
          custom_id: `${userId}|${packageId || ''}`
        }],
        application_context: {
          return_url: paymentType === 'karma' 
            ? `${process.env.BACKEND_URL || 'http://localhost:5000'}/api/karma/payment/paypal/success`
            : `${process.env.BACKEND_URL || 'http://localhost:5000'}/api/payment/paypal/execute`,
          cancel_url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/payment/error?message=Payment%20cancelled`,
          brand_name: 'KongFuWorld',
          landing_page: 'LOGIN',
          user_action: 'PAY_NOW'
        }
      };
      
      request.requestBody(requestBody);

      // 调试回调URL设置
      const returnUrl = paymentType === 'karma' 
        ? `${process.env.BACKEND_URL || 'http://localhost:5000'}/api/karma/payment/paypal/success`
        : `${process.env.BACKEND_URL || 'http://localhost:5000'}/api/payment/paypal/execute`;
      console.log(`[PayPal SDK支付创建] 回调URL设置 - paymentType: ${paymentType}, returnUrl: ${returnUrl}`);

      console.log('PayPal创建订单请求:', JSON.stringify(requestBody, null, 2));
      
      const response = await this.client.execute(request);
      
      console.log('PayPal API响应状态:', response.statusCode);
      console.log('PayPal API响应:', JSON.stringify(response.result, null, 2));
      
      if (response.result && response.result.id) {
        return response.result;
      } else {
        throw new Error('创建订单失败: ' + JSON.stringify(response.result));
      }
    } catch (error) {
      console.error('PayPal payment creation failed:', error);
      if (error.statusCode) {
        console.error('HTTP状态码:', error.statusCode);
        console.error('错误详情:', error.details);
      }
      throw new Error(`PayPal payment creation failed: ${error.message}`);
    }
  }

  // 执行支付（捕获订单）
  async executePayment(orderId) {
    try {
      const request = new paypal.orders.OrdersCaptureRequest(orderId);
      request.requestBody({});

      const response = await this.client.execute(request);
      
      console.log('PayPal捕获订单响应:', JSON.stringify(response.result, null, 2));
      
      if (response.result && response.result.id) {
        return response.result;
      } else {
        throw new Error('捕获支付失败: ' + JSON.stringify(response.result));
      }
    } catch (error) {
      console.error('PayPal捕获订单失败:', error);
      throw new Error(`PayPal payment execution failed: ${error.message}`);
    }
  }

  // 记录支付到数据库
  async recordPayment(userId, amount, paymentId, status = 'pending', novelId = null, tierLevel = null, tierName = null) {
    try {
      let description = novelId ? 
        `PayPal Payment ID: ${paymentId} | Novel ID: ${novelId}` : 
        `PayPal Payment ID: ${paymentId}`;
      
      // 如果有等级信息，添加到描述中
      if (tierLevel !== null && tierName) {
        description += ` | Tier Level: ${tierLevel} | Tier Name: ${tierName}`;
      }
      
      const [result] = await this.db.execute(
        'INSERT INTO payment_record (user_id, novel_id, amount, payment_method, status, type, description) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [userId, novelId, amount, 'paypal', status, 'recharge', description]
      );
      return result.insertId;
    } catch (error) {
      throw new Error(`Database record failed: ${error.message}`);
    }
  }

  // 更新支付状态
  async updatePaymentStatus(paymentId, status, transactionId = null) {
    try {
      const description = transactionId ? 
        `PayPal Transaction ID: ${transactionId}` : 
        `PayPal Payment ID: ${paymentId}`;
      
      await this.db.execute(
        'UPDATE payment_record SET status = ?, description = ? WHERE description LIKE ?',
        [status, description, `%${paymentId}%`]
      );
    } catch (error) {
      throw new Error(`Payment status update failed: ${error.message}`);
    }
  }

  // 更新用户余额
  async updateUserBalance(userId, amount) {
    try {
      await this.db.execute(
        'UPDATE user SET balance = balance + ? WHERE id = ?',
        [amount, userId]
      );
    } catch (error) {
      throw new Error(`Balance update failed: ${error.message}`);
    }
  }

  // 创建Champion订阅
  async createChampionSubscription(userId, novelId, amount, tierLevel, tierName, paymentRecordId = null, paypalOrder = null) {
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
          [userId, novelId, tierLevel, tierName, amount, 'paypal', 1]
        );
        console.log(`Created new subscription for user ${userId}, novel ${novelId}.`);
      }

      // 记录详细的支付信息到 user_champion_subscription_record 表
      if (paymentRecordId) {
        console.log('[createChampionSubscription] 准备创建订阅记录', {
          userId,
          novelId,
          paymentRecordId,
          paymentMethod: 'paypal',
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
          paymentMethod: 'paypal',
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
          paymentData: paypalOrder
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
      paymentMethod = 'paypal',
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

module.exports = PayPalServiceSDK;
