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
  async recordPayment(userId, amount, paymentId, status = 'pending', novelId = null) {
    try {
      const description = novelId ? 
        `PayPal Payment ID: ${paymentId} | Novel ID: ${novelId}` : 
        `PayPal Payment ID: ${paymentId}`;
      
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
          [userId, novelId, tierLevel, tierName, amount, 'paypal', 1]
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
          paypalOrder
        );
      }
    } catch (error) {
      throw new Error(`Champion subscription creation failed: ${error.message}`);
    }
  }

  // 创建订阅记录详情
  async createSubscriptionRecord(userId, novelId, paymentRecordId, tierLevel, tierName, amount, subscriptionType, startDate, endDate, paypalOrder = null) {
    try {
      const recordData = {
        user_id: userId,
        novel_id: novelId,
        payment_record_id: paymentRecordId,
        tier_level: tierLevel,
        tier_name: tierName,
        monthly_price: amount,
        payment_amount: amount,
        payment_method: 'paypal',
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
        paypal_order_id: null,
        paypal_payer_id: null,
        card_brand: null,
        card_last4: null,
        card_exp_month: null,
        card_exp_year: null
      };

      // 如果有PayPal订单信息，添加更多详情
      if (paypalOrder) {
        recordData.transaction_id = paypalOrder.id || null;
        recordData.paypal_order_id = paypalOrder.id || null;
        
        // 如果有支付者信息
        if (paypalOrder.payer && paypalOrder.payer.payer_id) {
          recordData.paypal_payer_id = paypalOrder.payer.payer_id;
        }
      }

      await this.db.execute(
        `INSERT INTO user_champion_subscription_record (
          user_id, novel_id, payment_record_id, tier_level, tier_name, 
          monthly_price, payment_amount, payment_method, payment_status, 
          subscription_type, subscription_duration_months, start_date, end_date, 
          is_active, auto_renew, currency, transaction_id, paypal_order_id, 
          paypal_payer_id, card_brand, card_last4, card_exp_month, card_exp_year
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          recordData.user_id, recordData.novel_id, recordData.payment_record_id,
          recordData.tier_level, recordData.tier_name, recordData.monthly_price,
          recordData.payment_amount, recordData.payment_method, recordData.payment_status,
          recordData.subscription_type, recordData.subscription_duration_months,
          recordData.start_date, recordData.end_date, recordData.is_active,
          recordData.auto_renew, recordData.currency, recordData.transaction_id,
          recordData.paypal_order_id, recordData.paypal_payer_id,
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
}

module.exports = PayPalServiceSDK;
