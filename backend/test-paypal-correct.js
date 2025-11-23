// 使用正确的PayPal SDK测试
require('dotenv').config();

console.log('🔍 测试PayPal SDK (正确版本)...');

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
  console.log('客户端对象:', Object.keys(paypalClient));
  
  // 尝试直接调用API
  console.log('🧪 尝试创建支付订单...');
  
  const paymentRequest = {
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
      cancel_url: 'http://localhost:3000/payment/cancel'
    }
  };
  
  // 尝试不同的API调用方式
  try {
    // 方式1: 直接调用
    const result1 = await paypalClient.ordersController.ordersCreate(paymentRequest);
    console.log('✅ 方式1成功:', result1);
  } catch (err1) {
    console.log('❌ 方式1失败:', err1.message);
    
    try {
      // 方式2: 使用body包装
      const result2 = await paypalClient.ordersController.ordersCreate({ body: paymentRequest });
      console.log('✅ 方式2成功:', result2);
    } catch (err2) {
      console.log('❌ 方式2失败:', err2.message);
      
      try {
        // 方式3: 检查是否有其他方法
        console.log('🔍 可用的控制器方法:', Object.keys(paypalClient.ordersController || {}));
        console.log('🔍 客户端所有方法:', Object.getOwnPropertyNames(paypalClient));
      } catch (err3) {
        console.log('❌ 方式3失败:', err3.message);
      }
    }
  }
  
} catch (error) {
  console.error('❌ PayPal SDK测试失败:', error.message);
  console.error('错误详情:', error);
}

