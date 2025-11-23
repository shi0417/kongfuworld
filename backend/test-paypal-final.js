// 最终PayPal测试
require('dotenv').config();
const https = require('https');

console.log('🔍 最终PayPal测试...');

async function testPayPalFinal() {
  try {
    // 获取访问令牌
    console.log('🔑 获取访问令牌...');
    const token = await getAccessToken();
    console.log('✅ 访问令牌获取成功');
    
    // 创建简单的支付订单
    console.log('🧪 创建支付订单...');
    const order = await createOrder(token);
    console.log('✅ 支付订单创建成功');
    console.log(`订单ID: ${order.id}`);
    console.log(`状态: ${order.status}`);
    console.log(`支付链接: ${order.links.find(link => link.rel === 'approve')?.href}`);
    
  } catch (error) {
    console.error('❌ PayPal测试失败:', error.message);
  }
}

function getAccessToken() {
  return new Promise((resolve, reject) => {
    const credentials = Buffer.from(
      `${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`
    ).toString('base64');
    
    const options = {
      hostname: 'api.sandbox.paypal.com',
      port: 443,
      path: '/v1/oauth2/token',
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json'
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
            reject(new Error('无法获取访问令牌: ' + JSON.stringify(response)));
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

function createOrder(token) {
  return new Promise((resolve, reject) => {
    const orderData = {
      intent: 'CAPTURE',
      purchase_units: [{
        amount: {
          currency_code: 'USD',
          value: '10.00'
        }
      }]
    };
    
    const options = {
      hostname: 'api.sandbox.paypal.com',
      port: 443,
      path: '/v1/orders',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'PayPal-Request-Id': 'test-' + Date.now(),
        'Prefer': 'return=representation'
      }
    };
    
    const req = https.request(options, (res) => {
      console.log('📡 响应状态:', res.statusCode);
      console.log('📡 响应头:', res.headers);
      
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        console.log('📡 响应数据:', data);
        try {
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
    req.write(JSON.stringify(orderData));
    req.end();
  });
}

testPayPalFinal();
