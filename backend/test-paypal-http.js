// 使用HTTP请求直接测试PayPal API
require('dotenv').config();
const https = require('https');

console.log('🔍 测试PayPal API (HTTP方式)...');

async function testPayPalAPI() {
  try {
    // 检查环境变量
    console.log('📋 环境变量:');
    console.log(`PAYPAL_CLIENT_ID: ${process.env.PAYPAL_CLIENT_ID ? '已设置' : '未设置'}`);
    console.log(`PAYPAL_CLIENT_SECRET: ${process.env.PAYPAL_CLIENT_SECRET ? '已设置' : '未设置'}`);
    console.log(`PAYPAL_MODE: ${process.env.PAYPAL_MODE}`);
    
    if (!process.env.PAYPAL_CLIENT_ID || !process.env.PAYPAL_CLIENT_SECRET) {
      console.log('❌ PayPal凭据未配置');
      return;
    }
    
    // 获取访问令牌
    console.log('🔑 获取PayPal访问令牌...');
    const token = await getPayPalToken();
    console.log('✅ 访问令牌获取成功');
    
    // 创建支付订单
    console.log('🧪 创建支付订单...');
    const order = await createPayPalOrder(token);
    console.log('✅ 支付订单创建成功');
    console.log(`订单ID: ${order.id}`);
    console.log(`支付链接: ${order.links.find(link => link.rel === 'approve')?.href}`);
    
  } catch (error) {
    console.error('❌ PayPal测试失败:', error.message);
  }
}

function getPayPalToken() {
  return new Promise((resolve, reject) => {
    const credentials = Buffer.from(
      `${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`
    ).toString('base64');
    
    const options = {
      hostname: process.env.PAYPAL_MODE === 'live' ? 'api.paypal.com' : 'api.sandbox.paypal.com',
      port: 443,
      path: '/v1/oauth2/token',
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    };
    
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          if (response.access_token) {
            resolve(response.access_token);
          } else {
            reject(new Error('无法获取访问令牌: ' + data));
          }
        } catch (err) {
          reject(new Error('解析令牌响应失败: ' + data));
        }
      });
    });
    
    req.on('error', reject);
    req.write('grant_type=client_credentials');
    req.end();
  });
}

function createPayPalOrder(token) {
  return new Promise((resolve, reject) => {
    const orderData = {
      intent: 'CAPTURE',
      purchase_units: [{
        amount: {
          currency_code: 'USD',
          value: '10.00'
        },
        description: 'kongfuworld Test Payment'
      }],
      application_context: {
        return_url: 'http://localhost:3000/payment/success',
        cancel_url: 'http://localhost:3000/payment/cancel',
        brand_name: 'kongfuworld',
        landing_page: 'LOGIN',
        user_action: 'PAY_NOW'
      }
    };
    
    const options = {
      hostname: process.env.PAYPAL_MODE === 'live' ? 'api.paypal.com' : 'api.sandbox.paypal.com',
      port: 443,
      path: '/v1/orders',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'PayPal-Request-Id': 'test-' + Date.now()
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
            reject(new Error('创建订单失败: ' + data));
          }
        } catch (err) {
          reject(new Error('解析订单响应失败: ' + data));
        }
      });
    });
    
    req.on('error', reject);
    req.write(JSON.stringify(orderData));
    req.end();
  });
}

testPayPalAPI();
