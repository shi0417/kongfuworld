const mysql = require('mysql2/promise');
const https = require('https');

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

class PayPalService {
  constructor() {
    this.db = mysql.createPool({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'kongfuworld'
    });
  }

  // 获取PayPal访问令牌
  async getAccessToken() {
    console.log('[PayPal Token] 开始获取访问令牌');
    console.log('[PayPal Token] PayPal配置:', {
      baseUrl: PAYPAL_CONFIG.baseUrl,
      clientId: PAYPAL_CONFIG.clientId ? '已设置' : '未设置',
      clientSecret: PAYPAL_CONFIG.clientSecret ? '已设置' : '未设置'
    });
    
    if (!PAYPAL_CONFIG.clientId || !PAYPAL_CONFIG.clientSecret) {
      throw new Error('PayPal Client ID 或 Secret 未配置，请检查环境变量');
    }
    
    return new Promise((resolve, reject) => {
      const credentials = Buffer.from(
        `${PAYPAL_CONFIG.clientId}:${PAYPAL_CONFIG.clientSecret}`
      ).toString('base64');
      
      const options = {
        hostname: PAYPAL_CONFIG.baseUrl,
        port: 443,
        path: '/v1/oauth2/token',
        method: 'POST',
        headers: {
          'Authorization': `Basic ${credentials}`,
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json',
          'Accept-Language': 'en_US',
          'User-Agent': 'KongFuWorld/1.0'
        }
      };
      
      console.log('[PayPal Token] 请求URL:', `https://${PAYPAL_CONFIG.baseUrl}/v1/oauth2/token`);
      
      const req = https.request(options, (res) => {
        console.log('[PayPal Token] 响应状态码:', res.statusCode);
        let data = '';
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => {
          console.log('[PayPal Token] 响应数据:', data);
          try {
            const response = JSON.parse(data);
            if (response.access_token) {
              console.log('[PayPal Token] 成功获取访问令牌');
              resolve(response.access_token);
            } else {
              console.error('[PayPal Token] 获取令牌失败:', JSON.stringify(response));
              reject(new Error('无法获取访问令牌: ' + JSON.stringify(response)));
            }
          } catch (err) {
            console.error('[PayPal Token] 解析响应失败:', err.message);
            reject(new Error('解析令牌响应失败: ' + data));
          }
        });
      });
      
      req.on('error', (error) => {
        console.error('[PayPal Token] 请求错误:', error);
        reject(error);
      });
      
      req.write('grant_type=client_credentials');
      req.end();
    });
  }

  // 创建支付订单
  async createPayment(userId, amount, currency = 'USD', description = '', paymentType = 'champion') {
    try {
      console.log(`[PayPal支付创建] 参数 - userId: ${userId}, amount: ${amount}, paymentType: ${paymentType}`);
      
      // 获取访问令牌
      const token = await this.getAccessToken();
      
      const paymentRequest = {
        intent: 'CAPTURE',
        purchase_units: [{
          amount: {
            currency_code: currency,
            value: amount.toString()
          },
          description: description,
          custom_id: userId.toString()
        }],
        application_context: {
          return_url: paymentType === 'karma' 
            ? `${process.env.BACKEND_URL || 'http://localhost:5000'}/api/payment/paypal/success`
            : `${process.env.FRONTEND_URL || 'http://localhost:3000'}/payment/success`,
          cancel_url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/payment/error?message=Payment%20cancelled`,
          brand_name: 'KongFuWorld',
          landing_page: 'LOGIN',
          user_action: 'PAY_NOW',
          payment_method_preference: 'IMMEDIATE_PAYMENT_REQUIRED'
        }
      };

      // 调试回调URL设置
      const returnUrl = paymentType === 'karma' 
        ? `${process.env.BACKEND_URL || 'http://localhost:5000'}/api/payment/paypal/success`
        : `${process.env.FRONTEND_URL || 'http://localhost:3000'}/payment/success`;
      console.log(`[PayPal支付创建] 回调URL设置 - paymentType: ${paymentType}, returnUrl: ${returnUrl}`);

      // 使用HTTP请求创建订单
      console.log('PayPal创建订单请求:', JSON.stringify(paymentRequest, null, 2));
      console.log('PayPal API URL:', `https://${PAYPAL_CONFIG.baseUrl}/v1/orders`);
      
      return new Promise((resolve, reject) => {
        const options = {
          hostname: PAYPAL_CONFIG.baseUrl,
          port: 443,
          path: '/v1/orders',
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Accept-Language': 'en_US',
            'PayPal-Request-Id': 'order-' + Date.now(),
            'User-Agent': 'KongFuWorld/1.0',
            'Prefer': 'return=representation'
          }
        };
        
        const req = https.request(options, (res) => {
          console.log('PayPal API响应状态:', res.statusCode);
          console.log('PayPal API响应头:', res.headers);
          
          let data = '';
          res.on('data', (chunk) => data += chunk);
          res.on('end', () => {
            console.log('PayPal API响应数据:', data);
            try {
              if (res.statusCode !== 201) {
                reject(new Error(`PayPal API错误: ${res.statusCode} - ${data}`));
                return;
              }
              const response = JSON.parse(data);
              if (response.id) {
                resolve(response);
              } else {
                reject(new Error('创建订单失败: ' + JSON.stringify(response)));
              }
            } catch (err) {
              reject(new Error('解析订单响应失败: ' + data));
            }
          });
        });
        
        req.on('error', reject);
        req.write(JSON.stringify(paymentRequest));
        req.end();
      });
    } catch (error) {
      throw new Error(`PayPal payment creation failed: ${error.message}`);
    }
  }

  // 执行支付
  async executePayment(orderId) {
    try {
      // 获取访问令牌
      const token = await this.getAccessToken();
      
      const captureRequest = {
        payment_source: {
          paypal: {
            experience_context: {
              payment_method_preference: 'IMMEDIATE_PAYMENT_REQUIRED',
              brand_name: 'kongfuworld',
              locale: 'en-US',
              landing_page: 'LOGIN',
              user_action: 'PAY_NOW'
            }
          }
        }
      };

      // 使用HTTP请求捕获支付
      return new Promise((resolve, reject) => {
        const options = {
          hostname: PAYPAL_CONFIG.baseUrl,
          port: 443,
          path: `/v1/orders/${orderId}/capture`,
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'PayPal-Request-Id': 'capture-' + Date.now()
          }
        };
        
        const req = https.request(options, (res) => {
          let data = '';
          res.on('data', (chunk) => data += chunk);
          res.on('end', () => {
            try {
              const response = JSON.parse(data);
              if (response.id) {
                resolve(response);
              } else {
                reject(new Error('捕获支付失败: ' + JSON.stringify(response)));
              }
            } catch (err) {
              reject(new Error('解析捕获响应失败: ' + data));
            }
          });
        });
        
        req.on('error', reject);
        req.write(JSON.stringify(captureRequest));
        req.end();
      });
    } catch (error) {
      throw new Error(`PayPal payment execution failed: ${error.message}`);
    }
  }

  // 记录支付到数据库
  async recordPayment(userId, amount, paymentId, status = 'pending') {
    try {
      const [result] = await this.db.execute(
        'INSERT INTO payment_record (user_id, amount, payment_method, status, type, description) VALUES (?, ?, ?, ?, ?, ?)',
        [userId, amount, 'paypal', status, 'recharge', `PayPal Payment ID: ${paymentId}`]
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

  // 创建PayPal Payout（向用户付款）
  async createPayout(email, amount, currency = 'USD', note = '', senderBatchId = null) {
    try {
      console.log(`[PayPal Payout创建] 参数 - email: ${email}, amount: ${amount}, currency: ${currency}, senderBatchId: ${senderBatchId || '自动生成'}`);
      
      // 获取访问令牌
      const token = await this.getAccessToken();
      
      // 如果没有提供 sender_batch_id，则自动生成（用于幂等性）
      const batchId = senderBatchId || `PAYOUT_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      
      // PayPal Payouts API请求体
      const payoutRequest = {
        sender_batch_header: {
          sender_batch_id: batchId,
          email_subject: 'You have a payout!',
          email_message: note || `You have received a payout of ${amount} ${currency}`
        },
        items: [{
          recipient_type: 'EMAIL',
          amount: {
            value: amount.toString(),
            currency: currency
          },
          receiver: email,
          note: note || `Payout from KongFuWorld`,
          sender_item_id: `PAYOUT_ITEM_${Date.now()}`
        }]
      };

      console.log('PayPal Payout请求:', JSON.stringify(payoutRequest, null, 2));
      console.log('PayPal Payout API URL:', `https://${PAYPAL_CONFIG.baseUrl}/v1/payments/payouts`);
      
      return new Promise((resolve, reject) => {
        const options = {
          hostname: PAYPAL_CONFIG.baseUrl,
          port: 443,
          path: '/v1/payments/payouts',
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'PayPal-Request-Id': `payout-${Date.now()}`,
            'User-Agent': 'KongFuWorld/1.0'
          }
        };
        
        const req = https.request(options, (res) => {
          console.log('PayPal Payout API响应状态:', res.statusCode);
          console.log('PayPal Payout API响应头:', res.headers);
          
          let data = '';
          res.on('data', (chunk) => data += chunk);
          res.on('end', () => {
            console.log('PayPal Payout API响应数据:', data);
            try {
              const response = JSON.parse(data);
              
              if (res.statusCode === 201 || res.statusCode === 200) {
                // 成功创建payout
                if (response.batch_header && response.batch_header.payout_batch_id) {
                  const payoutBatchId = response.batch_header.payout_batch_id;
                  const payoutItemId = response.items && response.items[0] ? response.items[0].payout_item_id : null;
                  
                  resolve({
                    success: true,
                    batch_id: payoutBatchId,
                    payout_item_id: payoutItemId,
                    status: response.batch_header.batch_status || 'PENDING',
                    response: response
                  });
                } else {
                  reject(new Error('创建Payout失败: 响应中缺少batch_id'));
                }
              } else {
                // 处理错误响应
                const errorMessage = response.message || response.name || '未知错误';
                const errorDetails = response.details ? JSON.stringify(response.details) : '';
                reject(new Error(`PayPal Payout API错误: ${res.statusCode} - ${errorMessage} ${errorDetails}`));
              }
            } catch (err) {
              reject(new Error('解析Payout响应失败: ' + data));
            }
          });
        });
        
        req.on('error', reject);
        req.write(JSON.stringify(payoutRequest));
        req.end();
      });
    } catch (error) {
      console.error('PayPal Payout创建失败:', error);
      throw new Error(`PayPal payout creation failed: ${error.message}`);
    }
  }

  // 查询Payout状态
  async getPayoutStatus(batchId) {
    try {
      console.log(`[PayPal状态查询] 查询批次ID: ${batchId}`);
      const token = await this.getAccessToken();
      
      return new Promise((resolve, reject) => {
        const options = {
          hostname: PAYPAL_CONFIG.baseUrl,
          port: 443,
          path: `/v1/payments/payouts/${batchId}`,
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          }
        };
        
        console.log(`[PayPal状态查询] 请求URL: https://${PAYPAL_CONFIG.baseUrl}/v1/payments/payouts/${batchId}`);
        
        const req = https.request(options, (res) => {
          console.log(`[PayPal状态查询] 响应状态码: ${res.statusCode}`);
          let data = '';
          res.on('data', (chunk) => data += chunk);
          res.on('end', () => {
            console.log(`[PayPal状态查询] 响应数据: ${data}`);
            try {
              const response = JSON.parse(data);
              if (res.statusCode === 200) {
                const batchStatus = response.batch_header?.batch_status || 'UNKNOWN';
                console.log(`[PayPal状态查询] 批次状态: ${batchStatus}`);
                resolve(response);
              } else {
                console.error(`[PayPal状态查询] 查询失败: ${res.statusCode} - ${data}`);
                reject(new Error(`查询Payout状态失败: ${res.statusCode} - ${data}`));
              }
            } catch (err) {
              console.error(`[PayPal状态查询] 解析响应失败: ${err.message}`);
              reject(new Error('解析Payout状态响应失败: ' + data));
            }
          });
        });
        
        req.on('error', (error) => {
          console.error(`[PayPal状态查询] 请求错误: ${error.message}`);
          reject(error);
        });
        
        req.end();
      });
    } catch (error) {
      console.error(`[PayPal状态查询] 异常: ${error.message}`);
      throw new Error(`PayPal payout status check failed: ${error.message}`);
    }
  }
}

module.exports = PayPalService;
