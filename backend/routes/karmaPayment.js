const express = require('express');
const router = express.Router();
const KarmaPaymentService = require('../services/karmaPaymentService');
const PayPalServiceSDK = require('../services/paypalServiceSDK');
const StripeService = require('../services/stripeService');

const karmaPaymentService = new KarmaPaymentService();
const paypalService = new PayPalServiceSDK();
const stripeService = new StripeService();

// 创建Karma PayPal支付
router.post('/paypal/create', async (req, res) => {
  try {
    const { userId, packageId, amount, currency = 'USD' } = req.body;

    if (!userId || !packageId || !amount) {
      return res.status(400).json({ 
        success: false, 
        message: '缺少必要参数' 
      });
    }

    console.log(`[Karma PayPal支付] 创建支付 - 用户: ${userId}, 套餐: ${packageId}, 金额: $${amount}`);

    // 创建PayPal支付订单
    const payment = await paypalService.createPayment(
      userId, 
      amount, 
      currency, 
      `Karma购买-套餐${packageId}`,
      'karma',  // 支付类型
      packageId  // 套餐ID
    );

    // 创建支付记录
    console.log(`[Karma PayPal支付创建] 创建支付记录 - 使用payment.id: ${payment.id}`);
    console.log(`[Karma PayPal支付创建] payment对象:`, JSON.stringify(payment, null, 2));
    const paymentRecordId = await karmaPaymentService.createKarmaPaymentRecord(
      userId, 
      packageId, 
      amount, 
      'paypal',
      payment.id  // PayPal订单ID
    );
    console.log(`[Karma PayPal支付创建] 支付记录创建成功 - paymentRecordId: ${paymentRecordId}`);

    const approveLink = payment.links.find(link => link.rel === 'approve');
    if (!approveLink) {
      throw new Error('无法找到PayPal支付链接');
    }

    console.log(`[Karma PayPal支付] 支付链接创建成功 - orderId: ${payment.id}`);

    res.json({
      success: true,
      orderId: payment.id,
      approvalUrl: approveLink.href,
      paymentRecordId: paymentRecordId
    });
  } catch (error) {
    console.error('Karma PayPal支付创建失败:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
});

// Karma PayPal支付成功回调
router.get('/paypal/success', async (req, res) => {
  try {
    const { orderId, token, PayerID } = req.query;
    const actualOrderId = orderId || token;
    
    console.log(`[Karma PayPal支付成功] 接收回调 - orderId: ${actualOrderId}, token: ${token}, PayerID: ${PayerID}`);

    if (!actualOrderId) {
      return res.status(400).json({ success: false, message: 'Missing order ID or token' });
    }

    // 执行PayPal支付捕获
    const payment = await paypalService.executePayment(actualOrderId);
    
    if (payment.status === 'COMPLETED') {
      console.log(`[Karma PayPal支付成功] 支付完成 - orderId: ${actualOrderId}`);
      console.log(`[Karma PayPal支付成功] payment对象:`, JSON.stringify(payment, null, 2));
      
      // 更新支付状态
      await paypalService.updatePaymentStatus(actualOrderId, 'completed', payment.id);
      
      // 获取支付详情
      const amount = parseFloat(payment.purchase_units[0].payments.captures[0].amount.value);
      const customId = payment.purchase_units[0].payments.captures[0].custom_id;
      
      // 解析custom_id获取userId和packageId
      const [userId, packageId] = customId.split('|');
      
      console.log(`[Karma PayPal支付成功] 开始处理 - orderId: ${actualOrderId}, userId: ${userId}, packageId: ${packageId}, amount: $${amount}`);
      
      // 查找支付记录ID - 使用payment.id，但考虑description可能被updatePaymentStatus覆盖
      console.log(`[Karma PayPal支付成功] 查找支付记录 - 使用payment.id: ${payment.id}`);
      
      // 先尝试查找原始格式
      let searchPattern = `%PayPal:${payment.id}%`;
      console.log(`[Karma PayPal支付成功] 查找模式1: ${searchPattern}`);
      let [paymentRecords] = await paypalService.db.execute(
        'SELECT id FROM payment_record WHERE description LIKE ? AND type = ? ORDER BY created_at DESC LIMIT 1',
        [searchPattern, 'karma_reward']
      );
      
      // 如果没找到，尝试查找被updatePaymentStatus覆盖后的格式
      if (paymentRecords.length === 0) {
        searchPattern = `%PayPal Transaction ID: ${payment.id}%`;
        console.log(`[Karma PayPal支付成功] 查找模式2: ${searchPattern}`);
        [paymentRecords] = await paypalService.db.execute(
          'SELECT id FROM payment_record WHERE description LIKE ? AND type = ? ORDER BY created_at DESC LIMIT 1',
          [searchPattern, 'karma_reward']
        );
      }
      
      console.log(`[Karma PayPal支付成功] 查找结果 - 找到${paymentRecords.length}条记录`);
      const paymentRecordId = paymentRecords.length > 0 ? paymentRecords[0].id : null;
      console.log(`[Karma PayPal支付成功] paymentRecordId: ${paymentRecordId}`);
      
      // 调用Karma支付成功处理，传递PayPal Transaction ID
      await karmaPaymentService.handleKarmaPaymentSuccess(
        parseInt(userId),
        parseInt(packageId),
        amount,
        'paypal',
        paymentRecordId,
        payment.id  // PayPal Transaction ID
      );
      
      console.log(`[Karma PayPal支付成功] 处理完成，重定向到Karma页面`);
      
      // 重定向到Karma页面
      res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/user-center?tab=karma&karmaPaypalSuccess=true&orderId=${actualOrderId}`);
    } else {
      console.error(`[Karma PayPal支付成功] 支付未完成 - orderId: ${actualOrderId}, status: ${payment.status}`);
      res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/user-center?tab=karma&karmaPaypalError=true&message=${encodeURIComponent('支付未完成')}`);
    }
  } catch (error) {
    console.error('Karma PayPal支付成功回调失败:', error);
    res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/user-center?tab=karma&karmaPaypalError=true&message=${encodeURIComponent(error.message)}`);
  }
});

// 创建Karma Stripe支付
router.post('/stripe/create', async (req, res) => {
  try {
    const { userId, packageId, amount, currency = 'USD' } = req.body;

    if (!userId || !packageId || !amount) {
      return res.status(400).json({ 
        success: false, 
        message: '缺少必要参数' 
      });
    }

    console.log(`[Karma Stripe支付] 创建支付 - 用户: ${userId}, 套餐: ${packageId}, 金额: $${amount}`);

    // 创建Stripe支付意图
    const result = await stripeService.createKarmaPaymentIntent(
      userId,
      amount * 100, // 转换为分
      currency,
      packageId
    );

    // 创建支付记录，包含PaymentIntent ID
    const paymentRecordId = await karmaPaymentService.createKarmaPaymentRecord(
      userId, 
      packageId, 
      amount, 
      'stripe',
      result.id // 传递PaymentIntent ID
    );

    console.log(`[Karma Stripe支付] 支付意图创建成功 - paymentIntentId: ${result.id}`);

    res.json({
      success: true,
      clientSecret: result.client_secret,
      paymentIntentId: result.id,
      paymentRecordId: paymentRecordId,
      status: result.status
    });
  } catch (error) {
    console.error('Karma Stripe支付创建失败:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
});

// Karma Stripe支付确认
router.post('/stripe/confirm', async (req, res) => {
  try {
    const { paymentIntentId } = req.body;

    if (!paymentIntentId) {
      return res.status(400).json({ success: false, message: 'Missing paymentIntentId' });
    }

    console.log(`[Karma Stripe支付确认] 开始处理 - paymentIntentId: ${paymentIntentId}`);

    // 确认支付意图
    const paymentIntent = await stripeService.confirmPaymentIntent(paymentIntentId);

    if (paymentIntent.status === 'succeeded') {
      // 获取支付详情
      const { userId, packageId } = paymentIntent.metadata;
      const amount = paymentIntent.amount / 100;

      console.log(`[Karma Stripe支付确认] 支付成功 - 用户: ${userId}, 套餐: ${packageId}, 金额: $${amount}`);

      // 查找支付记录ID
      const [paymentRecords] = await stripeService.db.execute(
        'SELECT id FROM payment_record WHERE description LIKE ? ORDER BY created_at DESC LIMIT 1',
        [`%${paymentIntentId}%`]
      );
      
      const paymentRecordId = paymentRecords.length > 0 ? paymentRecords[0].id : null;

      // 更新支付记录状态
      await stripeService.updatePaymentStatus(paymentIntentId, 'completed', paymentIntentId);

      // 调用Karma支付成功处理，传递Stripe PaymentIntent ID作为Transaction ID
      await karmaPaymentService.handleKarmaPaymentSuccess(
        parseInt(userId),
        parseInt(packageId),
        amount,
        'stripe',
        paymentRecordId,
        paymentIntentId  // Stripe PaymentIntent ID
      );

      console.log(`[Karma Stripe支付确认] 处理完成`);

      res.json({
        success: true,
        message: 'Payment successful',
        orderId: paymentIntent.id
      });
    } else {
      res.json({
        success: false,
        message: 'Payment not completed',
        status: paymentIntent.status
      });
    }
  } catch (error) {
    console.error('Karma Stripe支付确认失败:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
});

module.exports = router;
