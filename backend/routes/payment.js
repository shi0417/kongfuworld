const express = require('express');
const router = express.Router();
const PayPalServiceSDK = require('../services/paypalServiceSDK');
const StripeService = require('../services/stripeService');
const SimplePaymentService = require('../services/simplePaymentService');
const UnifiedPaymentService = require('../services/unifiedPaymentService');
const KarmaPaymentService = require('../services/karmaPaymentService');

const paypalService = new PayPalServiceSDK();
const stripeService = new StripeService();
const paymentService = new SimplePaymentService();
const unifiedPaymentService = new UnifiedPaymentService();
const karmaPaymentService = new KarmaPaymentService();

// PayPal支付相关路由

// 创建PayPal支付
router.post('/paypal/create', async (req, res) => {
  try {
    const { userId, amount, currency = 'USD', description = 'kongfuworld Credits', novelId } = req.body;

    if (!userId || !amount) {
      return res.status(400).json({ success: false, message: 'Missing required parameters' });
    }

    // 使用PayPal服务创建支付
    const payment = await paypalService.createPayment(userId, amount, currency, description);
    
    // 记录支付到数据库，包含小说ID信息
    await paypalService.recordPayment(userId, amount, payment.id, 'pending', novelId);

    // 查找approve链接
    const approveLink = payment.links.find(link => link.rel === 'approve');
    if (!approveLink) {
      throw new Error('无法找到PayPal支付链接');
    }

    res.json({
      success: true,
      orderId: payment.id,
      approvalUrl: approveLink.href
    });
  } catch (error) {
    console.error('PayPal payment creation failed:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// PayPal支付成功回调处理
router.get('/paypal/execute', async (req, res) => {
  const { token, PayerID } = req.query;
  console.log('PayPal execute callback received:', { token, PayerID });

  if (!token) {
    console.error('PayPal execute: Missing order token.');
    return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/payment/error?message=${encodeURIComponent('PayPal订单令牌缺失')}`);
  }

  try {
    // 1. 捕获PayPal支付
    const captureResponse = await paypalService.executePayment(token);

    if (captureResponse.status === 'COMPLETED') {
      console.log(`PayPal Order ${token} captured successfully.`);

      // 2. 更新payment_record状态
      const [updateResult] = await paypalService.db.execute(
        'UPDATE payment_record SET status = ?, updated_at = NOW() WHERE description LIKE ?',
        ['completed', `%${token}%`]
      );
      console.log(`Updated payment_record for order ${token}: ${updateResult.affectedRows} rows affected.`);

      // 3. 获取支付详情并创建Champion订阅
      const [paymentRecords] = await paypalService.db.execute(
        'SELECT id, user_id, amount, description FROM payment_record WHERE description LIKE ?',
        [`%${token}%`]
      );

      if (paymentRecords.length > 0) {
        const payment = paymentRecords[0];
        const userId = payment.user_id;
        const amount = parseFloat(payment.amount);
        const paymentRecordId = payment.id;

        // 从描述中提取小说ID
        let novelId = 7; // 默认值
        if (payment.description && payment.description.includes('Novel ID:')) {
          const novelIdMatch = payment.description.match(/Novel ID: (\d+)/);
          if (novelIdMatch) {
            novelId = parseInt(novelIdMatch[1]);
          }
        }

        // 使用统一支付处理服务
        await unifiedPaymentService.handlePaymentSuccess(
          userId,
          novelId,
          amount,
          'paypal',
          paymentRecordId,
          captureResponse
        );
      } else {
        console.warn(`No payment_record found for PayPal order ${token}. Subscription not created.`);
      }

      // 重定向到前端成功页面
      res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/payment/success?orderId=${token}`);

    } else {
      console.error(`PayPal Order ${token} not completed. Status: ${captureResponse.status}`);
      res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/payment/error?message=${encodeURIComponent('PayPal支付未完成')}`);
    }
  } catch (error) {
    console.error('PayPal execute callback error:', error);
    res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/payment/error?message=${encodeURIComponent(error.message)}`);
  }
});

// PayPal支付成功回调（Champion会员专用）
router.get('/paypal/success', async (req, res) => {
  try {
    const { orderId, token, PayerID } = req.query;
    
    console.log(`[PayPal Champion支付成功回调] 接收参数 - orderId: ${orderId}, token: ${token}, PayerID: ${PayerID}`);

    // PayPal实际提供的是token参数，不是orderId
    const actualOrderId = orderId || token;
    
    if (!actualOrderId) {
      return res.status(400).json({ success: false, message: 'Missing order ID or token' });
    }

    // 使用PayPal服务执行支付
    const payment = await paypalService.executePayment(actualOrderId);
    
    if (payment.status === 'COMPLETED') {
      console.log(`[PayPal Champion支付成功] 支付完成 - orderId: ${actualOrderId}`);
      
      // 更新支付状态
      await paypalService.updatePaymentStatus(actualOrderId, 'completed', payment.id);
      
      // 获取支付详情
      const amount = parseFloat(payment.purchase_units[0].payments.captures[0].amount.value);
      
      // 获取支付记录
      const [paymentRecords] = await paypalService.db.execute(
        'SELECT id, user_id, description FROM payment_record WHERE description LIKE ?',
        [`%${actualOrderId}%`]
      );

      if (paymentRecords.length > 0) {
        const paymentRecord = paymentRecords[0];
        const userId = paymentRecord.user_id;
        const paymentRecordId = paymentRecord.id;

        // 从描述中提取小说ID
        let novelId = 7; // 默认值
        if (paymentRecord.description && paymentRecord.description.includes('Novel ID:')) {
          const novelIdMatch = paymentRecord.description.match(/Novel ID: (\d+)/);
          if (novelIdMatch) {
            novelId = parseInt(novelIdMatch[1]);
          }
        }

        // 使用统一支付处理服务处理Champion订阅
        await unifiedPaymentService.handlePaymentSuccess(
          userId,
          novelId,
          amount,
          'paypal',
          paymentRecordId,
          payment
        );

        console.log(`[PayPal Champion支付成功] 处理完成 - 用户: ${userId}, 小说: ${novelId}, 金额: $${amount}`);
      } else {
        console.warn(`[PayPal Champion支付成功] 未找到支付记录 - orderId: ${actualOrderId}`);
      }
    } else {
      console.error(`[PayPal Champion支付成功] 支付未完成 - orderId: ${actualOrderId}, status: ${payment.status}`);
    }

    // 重定向到前端成功页面
    res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/payment/success?orderId=${actualOrderId}`);
  } catch (error) {
    console.error('PayPal Champion payment execution failed:', error);
    res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/payment/error?message=${encodeURIComponent(error.message)}`);
  }
});

// PayPal支付取消
router.get('/paypal/cancel', (req, res) => {
  res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/payment/cancel`);
});

// Stripe支付相关路由

// 创建Stripe支付意图
router.post('/stripe/create-payment-intent', async (req, res) => {
  try {
    const { userId, amount, currency = 'usd' } = req.body;

    if (!userId || !amount) {
      return res.status(400).json({ success: false, message: 'Missing required parameters' });
    }

    const paymentIntent = await paymentService.createPaymentIntent(
      amount, 
      currency, 
      { user_id: userId }
    );

    // 记录支付到数据库
    await paymentService.recordPayment(userId, amount, paymentIntent.id);

    res.json({
      success: true,
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Stripe Webhook处理
router.post('/stripe/webhook', express.raw({type: 'application/json'}), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
  } catch (err) {
    console.log(`Webhook signature verification failed.`, err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    await paymentService.handleWebhook(event);
    res.json({ received: true });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 创建Stripe订阅
router.post('/stripe/create-subscription', async (req, res) => {
  try {
    const { userId, customerId, priceId } = req.body;

    if (!userId || !customerId || !priceId) {
      return res.status(400).json({ success: false, message: 'Missing required parameters' });
    }

    const subscription = await stripeService.createSubscription(customerId, priceId);

    res.json({
      success: true,
      subscriptionId: subscription.id,
      clientSecret: subscription.latest_invoice.payment_intent.client_secret
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 获取支付历史
router.get('/history/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    const [rows] = await paymentService.db.execute(
      'SELECT * FROM payment_record WHERE user_id = ? ORDER BY created_at DESC',
      [userId]
    );

    res.json({ success: true, payments: rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Stripe支付相关路由

// 获取用户支付方式
router.get('/stripe/payment-methods/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const paymentMethods = await stripeService.getUserPaymentMethods(parseInt(userId));
    
    res.json({
      success: true,
      paymentMethods: paymentMethods
    });
  } catch (error) {
    console.error('获取支付方式失败:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// 创建Stripe支付意图
router.post('/stripe/create', async (req, res) => {
  try {
    const { userId, amount, currency = 'usd', novelId, paymentMethodId } = req.body;

    if (!userId || !amount) {
      return res.status(400).json({ success: false, message: 'Missing required parameters' });
    }

    // 创建Stripe支付意图
    const paymentIntent = await stripeService.createPaymentIntent(userId, amount, currency, novelId, paymentMethodId);
    
    // 记录支付到数据库
    await stripeService.recordPayment(userId, amount, paymentIntent.id, 'pending', novelId);

    res.json({
      success: true,
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      status: paymentIntent.status
    });
  } catch (error) {
    console.error('Stripe payment creation failed:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// 确认Stripe支付
router.post('/stripe/confirm', async (req, res) => {
  try {
    const { paymentIntentId } = req.body;

    if (!paymentIntentId) {
      return res.status(400).json({ success: false, message: 'Missing paymentIntentId' });
    }

    // 确认支付意图
    const paymentIntent = await stripeService.confirmPaymentIntent(paymentIntentId);

    if (paymentIntent.status === 'succeeded') {
      // 支付成功，根据支付类型选择处理方式
      const { userId, novelId, packageId, type } = paymentIntent.metadata;
      const amount = paymentIntent.amount / 100;

      // 更新支付状态
      await stripeService.updatePaymentStatus(paymentIntent.id, 'completed', paymentIntent.id);

      // 获取支付记录ID
      const [paymentRecords] = await stripeService.db.execute(
        'SELECT id FROM payment_record WHERE description LIKE ? ORDER BY created_at DESC LIMIT 1',
        [`%${paymentIntent.id}%`]
      );
      
      const paymentRecordId = paymentRecords.length > 0 ? paymentRecords[0].id : null;

      // 根据支付类型选择处理方式
      if (type === 'karma_purchase') {
        // Karma购买处理
        console.log(`[Karma支付确认] 开始处理 - 用户: ${userId}, 套餐: ${packageId}, 金额: $${amount}`);
        await karmaPaymentService.handleKarmaPaymentSuccess(
          parseInt(userId),
          parseInt(packageId),
          amount,
          'stripe',
          paymentRecordId
        );
      } else {
        // Champion会员订阅处理
        console.log(`[Champion支付确认] 开始处理 - 用户: ${userId}, 小说: ${novelId}, 金额: $${amount}`);
        await unifiedPaymentService.handlePaymentSuccess(
          parseInt(userId),
          parseInt(novelId),
          amount,
          'stripe',
          paymentRecordId,
          paymentIntent
        );
      }

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
    console.error('Stripe payment confirmation failed:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// 保存支付方式
router.post('/stripe/save-payment-method', async (req, res) => {
  try {
    const { userId, paymentMethodId, cardInfo } = req.body;

    if (!userId || !paymentMethodId || !cardInfo) {
      return res.status(400).json({ success: false, message: 'Missing required parameters' });
    }

    const result = await stripeService.savePaymentMethod(userId, paymentMethodId, cardInfo);
    
    res.json({
      success: true,
      message: 'Payment method saved successfully',
      id: result
    });
  } catch (error) {
    console.error('保存支付方式失败:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// 设置默认支付方式
router.post('/stripe/set-default-payment-method', async (req, res) => {
  try {
    const { userId, paymentMethodId } = req.body;

    if (!userId || !paymentMethodId) {
      return res.status(400).json({ success: false, message: 'Missing required parameters' });
    }

    await stripeService.setDefaultPaymentMethod(userId, paymentMethodId);
    
    res.json({
      success: true,
      message: 'Default payment method updated'
    });
  } catch (error) {
    console.error('设置默认支付方式失败:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// 删除支付方式
router.delete('/stripe/payment-method/:userId/:paymentMethodId', async (req, res) => {
  try {
    const { userId, paymentMethodId } = req.params;

    await stripeService.deletePaymentMethod(parseInt(userId), paymentMethodId);
    
    res.json({
      success: true,
      message: 'Payment method deleted'
    });
  } catch (error) {
    console.error('删除支付方式失败:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Stripe Webhook处理
router.post('/stripe/webhook', express.raw({type: 'application/json'}), async (req, res) => {
  try {
    const signature = req.headers['stripe-signature'];
    const result = await stripeService.handleWebhook(req.body, signature);
    res.json(result);
  } catch (error) {
    console.error('Stripe webhook failed:', error);
    res.status(400).json({ error: error.message });
  }
});

// Karma购买支付处理
router.post('/karma/create', async (req, res) => {
  try {
    const { userId, packageId, amount, currency = 'USD', paymentMethod = 'stripe' } = req.body;

    if (!userId || !packageId || !amount) {
      return res.status(400).json({ 
        success: false, 
        message: '缺少必要参数' 
      });
    }

    if (paymentMethod === 'stripe') {
      // 使用Stripe支付 - 独立处理，不依赖Champion逻辑
      const result = await stripeService.createKarmaPaymentIntent(
        userId,
        amount * 100, // 转换为分
        currency,
        packageId
      );

      // 创建支付记录
      const paymentRecordId = await karmaPaymentService.createKarmaPaymentRecord(
        userId, 
        packageId, 
        amount, 
        paymentMethod
      );

      res.json({
        success: true,
        clientSecret: result.client_secret,
        paymentRecordId: paymentRecordId
      });
    } else if (paymentMethod === 'paypal') {
      // 使用PayPal支付
      const payment = await paypalService.createPayment(
        userId, 
        amount, 
        currency, 
        `Karma购买-套餐${packageId}`,
        'karma',  // 指定支付类型为karma
        packageId  // 传入套餐ID
      );

      // 创建支付记录，传入PayPal订单ID
      const paymentRecordId = await karmaPaymentService.createKarmaPaymentRecord(
        userId, 
        packageId, 
        amount, 
        paymentMethod,
        payment.id  // 传入PayPal订单ID
      );

      const approveLink = payment.links.find(link => link.rel === 'approve');
      if (!approveLink) {
        throw new Error('无法找到PayPal支付链接');
      }

      res.json({
        success: true,
        orderId: payment.id,
        approvalUrl: approveLink.href,
        paymentRecordId: paymentRecordId
      });
    } else {
      throw new Error('不支持的支付方式');
    }
  } catch (error) {
    console.error('Karma支付创建失败:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
});

// Karma支付成功处理
router.post('/karma/success', async (req, res) => {
  try {
    const { userId, packageId, amount, paymentMethod, paymentRecordId } = req.body;

    if (!userId || !packageId || !amount) {
      return res.status(400).json({ 
        success: false, 
        message: '缺少必要参数' 
      });
    }

    // 处理Karma支付成功
    const result = await karmaPaymentService.handleKarmaPaymentSuccess(
      userId, 
      packageId, 
      amount, 
      paymentMethod, 
      paymentRecordId
    );

    res.json(result);
  } catch (error) {
    console.error('Karma支付成功处理失败:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
});

module.exports = router;
