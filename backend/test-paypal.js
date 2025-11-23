// PayPal配置测试脚本
require('dotenv').config();

const PayPalService = require('./services/paypalService');

async function testPayPalConfig() {
  console.log('🔍 测试PayPal配置...');
  
  // 检查环境变量
  console.log('📋 环境变量检查:');
  console.log(`PAYPAL_CLIENT_ID: ${process.env.PAYPAL_CLIENT_ID ? '✅ 已设置' : '❌ 未设置'}`);
  console.log(`PAYPAL_CLIENT_SECRET: ${process.env.PAYPAL_CLIENT_SECRET ? '✅ 已设置' : '❌ 未设置'}`);
  console.log(`PAYPAL_MODE: ${process.env.PAYPAL_MODE || 'sandbox'}`);
  console.log(`FRONTEND_URL: ${process.env.FRONTEND_URL || 'http://localhost:3000'}`);
  
  if (!process.env.PAYPAL_CLIENT_ID || !process.env.PAYPAL_CLIENT_SECRET) {
    console.log('❌ PayPal凭据未配置，请检查.env文件');
    return;
  }
  
  try {
    const paypalService = new PayPalService();
    console.log('✅ PayPal服务初始化成功');
    
    // 测试创建支付订单
    console.log('🧪 测试创建支付订单...');
    const testPayment = await paypalService.createPayment(1, 10.00, 'USD', 'kongfuworld Test Payment');
    console.log('✅ 支付订单创建成功');
    console.log(`订单ID: ${testPayment.id}`);
    console.log(`支付链接: ${testPayment.links.find(link => link.rel === 'approve')?.href}`);
    
  } catch (error) {
    console.error('❌ PayPal测试失败:', error.message);
    console.log('💡 请检查:');
    console.log('1. PayPal API凭据是否正确');
    console.log('2. 网络连接是否正常');
    console.log('3. PayPal开发者账户是否已激活');
  }
}

// 运行测试
testPayPalConfig();
