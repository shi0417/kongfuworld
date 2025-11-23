// 只测试PayPal访问令牌获取
require('dotenv').config();
const https = require('https');

console.log('🔍 测试PayPal访问令牌...');

async function testPayPalToken() {
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
    console.log(`令牌长度: ${token.length} 字符`);
    console.log(`令牌前20字符: ${token.substring(0, 20)}...`);
    
    // 测试API连接
    console.log('🧪 测试PayPal API连接...');
    await testPayPalConnection(token);
    
  } catch (error) {
    console.error('❌ PayPal测试失败:', error.message);
  }
}

function getPayPalToken() {
  return new Promise((resolve, reject) => {
    const credentials = Buffer.from(
      `${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`
    ).toString('base64');
    
    console.log('🔑 使用凭据:', {
      clientId: process.env.PAYPAL_CLIENT_ID.substring(0, 10) + '...',
      credentials: credentials.substring(0, 20) + '...'
    });
    
    const options = {
      hostname: process.env.PAYPAL_MODE === 'live' ? 'api.paypal.com' : 'api.sandbox.paypal.com',
      port: 443,
      path: '/v1/oauth2/token',
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json'
      }
    };
    
    console.log('🌐 请求URL:', `https://${options.hostname}${options.path}`);
    
    const req = https.request(options, (res) => {
      console.log('📡 响应状态:', res.statusCode);
      console.log('📡 响应头:', res.headers);
      
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        console.log('📡 响应数据:', data);
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
    
    req.on('error', (err) => {
      console.error('❌ 请求错误:', err);
      reject(err);
    });
    
    req.write('grant_type=client_credentials');
    req.end();
  });
}

function testPayPalConnection(token) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: process.env.PAYPAL_MODE === 'live' ? 'api.paypal.com' : 'api.sandbox.paypal.com',
      port: 443,
      path: '/v1/identity/oauth2/userinfo',
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json'
      }
    };
    
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) {
          console.log('✅ PayPal API连接成功');
          resolve();
        } else {
          console.log('❌ PayPal API连接失败:', res.statusCode, data);
          reject(new Error(`API连接失败: ${res.statusCode}`));
        }
      });
    });
    
    req.on('error', reject);
    req.end();
  });
}

testPayPalToken();


























