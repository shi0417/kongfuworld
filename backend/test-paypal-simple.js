// 简单的PayPal SDK测试
require('dotenv').config();

console.log('🔍 测试PayPal SDK...');

try {
  const { Client, Environment } = require('@paypal/paypal-server-sdk');
  
  console.log('✅ PayPal SDK导入成功');
  
  // 检查环境变量
  console.log('📋 环境变量:');
  console.log(`PAYPAL_CLIENT_ID: ${process.env.PAYPAL_CLIENT_ID ? '已设置' : '未设置'}`);
  console.log(`PAYPAL_CLIENT_SECRET: ${process.env.PAYPAL_CLIENT_SECRET ? '已设置' : '未设置'}`);
  console.log(`PAYPAL_MODE: ${process.env.PAYPAL_MODE}`);
  
  // 创建PayPal客户端
  const paypalClient = new Client({
    environment: process.env.PAYPAL_MODE === 'live' ? Environment.Live : Environment.Sandbox,
    clientId: process.env.PAYPAL_CLIENT_ID,
    clientSecret: process.env.PAYPAL_CLIENT_SECRET
  });
  
  console.log('✅ PayPal客户端创建成功');
  
  // 检查客户端结构
  console.log('🔍 客户端结构:');
  console.log('ordersController:', typeof paypalClient.ordersController);
  console.log('ordersController.ordersCreate:', typeof paypalClient.ordersController?.ordersCreate);
  
  if (paypalClient.ordersController && paypalClient.ordersController.ordersCreate) {
    console.log('✅ ordersCreate方法可用');
  } else {
    console.log('❌ ordersCreate方法不可用');
    console.log('可用的方法:', Object.keys(paypalClient.ordersController || {}));
  }
  
} catch (error) {
  console.error('❌ PayPal SDK测试失败:', error.message);
  console.error('错误详情:', error);
}

