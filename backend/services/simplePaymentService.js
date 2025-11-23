const mysql = require('mysql2/promise');

class SimplePaymentService {
  constructor() {
    this.db = mysql.createPool({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'kongfuworld'
    });
  }

  // 模拟创建支付订单
  async createPayment(userId, amount, currency = 'USD', description = '') {
    try {
      // 生成模拟的支付ID
      const paymentId = `PAY_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // 记录支付到数据库
      await this.recordPayment(userId, amount, paymentId, 'pending');
      
      return {
        id: paymentId,
        status: 'CREATED',
        links: [
          {
            href: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/payment/success?paymentId=${paymentId}`,
            rel: 'approve',
            method: 'GET'
          },
          {
            href: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/payment/cancel?paymentId=${paymentId}`,
            rel: 'cancel',
            method: 'GET'
          }
        ]
      };
    } catch (error) {
      throw new Error(`Payment creation failed: ${error.message}`);
    }
  }

  // 模拟执行支付
  async executePayment(paymentId) {
    try {
      // 模拟支付处理
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      return {
        id: paymentId,
        status: 'COMPLETED',
        purchase_units: [{
          payments: {
            captures: [{
              amount: {
                value: '10.00',
                currency_code: 'USD'
              }
            }]
          }
        }],
        payer: {
          payer_id: 'test_payer_id'
        }
      };
    } catch (error) {
      throw new Error(`Payment execution failed: ${error.message}`);
    }
  }

  // 记录支付到数据库
  async recordPayment(userId, amount, paymentId, status = 'pending') {
    try {
      const [result] = await this.db.execute(
        'INSERT INTO payment_record (user_id, amount, payment_method, status, type, description) VALUES (?, ?, ?, ?, ?, ?)',
        [userId, amount, 'paypal', status, 'recharge', `Payment ID: ${paymentId}`]
      );
      return result.insertId;
    } catch (error) {
      throw new Error(`Database record failed: ${error.message}`);
    }
  }

  // 更新支付状态
  async updatePaymentStatus(paymentId, status) {
    try {
      await this.db.execute(
        'UPDATE payment_record SET status = ? WHERE description LIKE ?',
        [status, `%${paymentId}%`]
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

  // 创建Stripe支付意图
  async createPaymentIntent(amount, currency = 'usd', metadata = {}) {
    try {
      const paymentIntentId = `pi_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      return {
        id: paymentIntentId,
        client_secret: `${paymentIntentId}_secret_${Math.random().toString(36).substr(2, 9)}`,
        amount: Math.round(amount * 100),
        currency: currency,
        status: 'requires_payment_method'
      };
    } catch (error) {
      throw new Error(`Stripe payment intent creation failed: ${error.message}`);
    }
  }

  // 处理Stripe Webhook
  async handleWebhook(event) {
    try {
      console.log(`Processing webhook event: ${event.type}`);
      
      switch (event.type) {
        case 'payment_intent.succeeded':
          await this.handlePaymentSuccess(event.data.object);
          break;
        case 'payment_intent.payment_failed':
          await this.handlePaymentFailure(event.data.object);
          break;
        default:
          console.log(`Unhandled event type ${event.type}`);
      }
    } catch (error) {
      throw new Error(`Webhook handling failed: ${error.message}`);
    }
  }

  // 处理支付成功
  async handlePaymentSuccess(paymentIntent) {
    const { amount, metadata } = paymentIntent;
    const userId = metadata.user_id;
    const amountInDollars = amount / 100;

    // 更新支付状态
    await this.updatePaymentStatus(paymentIntent.id, 'completed');
    
    // 更新用户余额
    await this.updateUserBalance(userId, amountInDollars);
  }

  // 处理支付失败
  async handlePaymentFailure(paymentIntent) {
    await this.updatePaymentStatus(paymentIntent.id, 'failed');
  }
}

module.exports = SimplePaymentService;
