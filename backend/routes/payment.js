const express = require('express');
const router = express.Router();
const PayPalServiceSDK = require('../services/paypalServiceSDK');
const StripeService = require('../services/stripeService');
const SimplePaymentService = require('../services/simplePaymentService');
const UnifiedPaymentService = require('../services/unifiedPaymentService');
const KarmaPaymentService = require('../services/karmaPaymentService');
const ChampionService = require('../services/championService');

const paypalService = new PayPalServiceSDK();
const stripeService = new StripeService();
const paymentService = new SimplePaymentService();
const unifiedPaymentService = new UnifiedPaymentService();
const karmaPaymentService = new KarmaPaymentService();
const championService = new ChampionService();

// PayPal支付相关路由

// 创建PayPal支付
router.post('/paypal/create', async (req, res) => {
  try {
    const { userId, amount, currency = 'USD', description = 'kongfuworld Credits', novelId, tierLevel, tierName } = req.body;

    if (!userId || !amount) {
      return res.status(400).json({ success: false, message: 'Missing required parameters' });
    }

    // 使用PayPal服务创建支付
    const payment = await paypalService.createPayment(userId, amount, currency, description);
    
    // 记录支付到数据库，包含小说ID、等级信息
    await paypalService.recordPayment(userId, amount, payment.id, 'pending', novelId, tierLevel, tierName);

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
    const { userId, amount, currency = 'usd', novelId, paymentMethodId, tierLevel, tierName } = req.body;

    if (!userId || !amount) {
      return res.status(400).json({ success: false, message: 'Missing required parameters' });
    }

    // 创建Stripe支付意图
    const paymentIntent = await stripeService.createPaymentIntent(userId, amount, currency, novelId, paymentMethodId);
    
    // 记录支付到数据库，包含等级信息和 Stripe 相关字段
    const paymentRecordId = await stripeService.recordPayment(userId, amount, paymentIntent.id, 'pending', novelId, tierLevel, tierName);
    
    // 更新 payment_record 的 Stripe 相关字段
    if (paymentRecordId && paymentIntent.customer) {
      try {
        await stripeService.db.execute(
          'UPDATE payment_record SET stripe_payment_intent_id = ?, stripe_customer_id = ? WHERE id = ?',
          [paymentIntent.id, paymentIntent.customer, paymentRecordId]
        );
        console.log(`[Stripe支付创建] 已更新 payment_record 的 Stripe 字段 - ID: ${paymentRecordId}, customer_id: ${paymentIntent.customer}`);
      } catch (err) {
        console.warn(`[Stripe支付创建] 更新 payment_record 的 Stripe 字段失败: ${err.message}`);
      }
    }

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

// 创建 Stripe Champion 订阅（自动续费）
router.post('/stripe/champion-subscription', async (req, res) => {
  try {
    const { userId, novelId, tierLevel, tierName, autoRenew, paymentMethodId } = req.body;

    if (!userId || !novelId || !tierLevel) {
      return res.status(400).json({ 
        success: false, 
        message: '缺少必要参数: userId, novelId, tierLevel' 
      });
    }

    // 当前阶段只处理 autoRenew === true 的情况
    if (autoRenew !== true) {
      return res.status(400).json({ 
        success: false, 
        message: '当前接口仅支持自动续费订阅，请使用 autoRenew: true' 
      });
    }

    console.log(`[Champion订阅创建] 开始 - 用户: ${userId}, 小说: ${novelId}, 等级: ${tierLevel}, 自动续费: ${autoRenew}`);

    // 0. 检查是否已有 active 的 Stripe Subscription
    // 策略 B：如果用户已有 Stripe Subscription，不应该创建新的，而是返回现有订阅信息
    // 用户应该使用手动支付接口来延长/升级订阅
    const [existingSubscriptions] = await stripeService.db.execute(
      'SELECT id, stripe_subscription_id, auto_renew, tier_level, end_date FROM user_champion_subscription WHERE user_id = ? AND novel_id = ? AND is_active = 1',
      [userId, novelId]
    );

    if (existingSubscriptions.length > 0) {
      const existingSub = existingSubscriptions[0];
      if (existingSub.stripe_subscription_id && Number(existingSub.auto_renew) === 1) {
        console.log(`[Champion订阅创建] 用户 ${userId} 对小说 ${novelId} 已有 active 的 Stripe Subscription: ${existingSub.stripe_subscription_id}`);
        
        // 策略 B：返回现有订阅信息，提示用户使用手动支付接口来延长/升级
        // 或者，如果用户想要"重新开通自动续费"，可以返回现有订阅信息
        try {
          // 获取 Stripe Subscription 信息
          const subscription = await stripeService.stripe.subscriptions.retrieve(existingSub.stripe_subscription_id);
          
          return res.json({
            success: true,
            code: 'ALREADY_SUBSCRIBED',
            message: 'You already have an active Stripe subscription. Use manual payment to extend or upgrade.',
            subscriptionId: existingSub.stripe_subscription_id,
            currentPeriodStart: new Date(subscription.current_period_start * 1000).toISOString(),
            currentPeriodEnd: new Date(subscription.current_period_end * 1000).toISOString(),
            status: subscription.status,
            autoRenew: true,
            existingSubscription: true
          });
        } catch (error) {
          console.error(`[Champion订阅创建] 获取现有 Stripe Subscription 信息失败: ${error.message}`);
          // 如果获取失败，继续创建流程（可能是 Stripe 端的订阅已被删除）
        }
      }
    }

    // 1. 获取或创建 Stripe Price（从数据库动态管理）
    const priceInfo = await championService.getOrCreateStripePriceForChampionTier({
      novelId: parseInt(novelId),
      tierLevel: parseInt(tierLevel),
      stripeService: stripeService
    });

    console.log(`[Champion订阅创建] Price 信息 - Price ID: ${priceInfo.priceId}, 价格: $${priceInfo.monthlyPrice}, 币种: ${priceInfo.currency}`);

    // 2. 查询促销活动并获取或创建 Stripe Coupon
    const couponInfo = await championService.getOrCreateStripeCouponForPromotion({
      novelId: parseInt(novelId),
      basePrice: priceInfo.monthlyPrice,
      currency: priceInfo.currency
    });

    console.log(`[Champion订阅创建] Coupon 信息 - Coupon ID: ${couponInfo.couponId || '无'}, 促销信息: ${couponInfo.promotionInfo ? JSON.stringify(couponInfo.promotionInfo) : '无'}`);

    // 3. 获取或创建 Stripe Customer
    // TODO: 需要从 user 表获取 email，这里暂时传 null
    const customerId = await stripeService.getOrCreateCustomer(parseInt(userId), null);

    // 4. 调用 Stripe Service 创建订阅（使用动态 Price，如果存在促销则应用 Coupon）
    const subscriptionResult = await stripeService.createChampionSubscription({
      userId: parseInt(userId),
      novelId: parseInt(novelId),
      tierLevel: parseInt(tierLevel),
      tierName: priceInfo.tierName, // 使用从数据库获取的 tierName
      priceId: priceInfo.priceId, // 使用动态获取的 Price ID
      paymentMethodId: paymentMethodId || null,
      userEmail: null, // TODO: 从 user 表获取 email
      couponId: couponInfo.couponId || null // 如果有促销，传入 Coupon ID
    });

    // 5. 创建 payment_record（可选，用于记录）
    let paymentRecordId = null;
    try {
      // 获取 PaymentIntent ID（如果存在）
      let paymentIntentId = null;
      if (subscriptionResult.subscription.latest_invoice?.payment_intent) {
        const paymentIntent = subscriptionResult.subscription.latest_invoice.payment_intent;
        paymentIntentId = typeof paymentIntent === 'object' ? paymentIntent.id : paymentIntent;
      }
      
      // 获取 Stripe Subscription ID 和 Customer ID
      const subscriptionId = subscriptionResult.subscription.id;
      const customerId = subscriptionResult.subscription.customer;
      
      // 构建描述，包含促销信息和 PaymentIntent ID（保留用于人类可读）
      let description = `Stripe Subscription ID: ${subscriptionId} | Novel ID: ${novelId} | Tier Level: ${tierLevel} | Tier Name: ${priceInfo.tierName}`;
      if (paymentIntentId) {
        description += ` | PaymentIntent ID: ${paymentIntentId}`;
      }
      if (couponInfo.promotionInfo) {
        description += ` | Promo: ${couponInfo.promotionInfo.promotionId} (${couponInfo.promotionInfo.discountAmount > 0 ? `-$${couponInfo.promotionInfo.discountAmount}` : 'Free'})`;
      }
      
      // 插入 payment_record，包含 Stripe 专用字段
      const [result] = await stripeService.db.execute(
        'INSERT INTO payment_record (user_id, novel_id, amount, payment_method, status, type, description, stripe_subscription_id, stripe_payment_intent_id, stripe_customer_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [userId, novelId, subscriptionResult.amountInDollars, 'stripe', 'pending', 'champion_subscribe', description, subscriptionId, paymentIntentId, customerId]
      );
      paymentRecordId = result.insertId;
      console.log(`[Champion订阅创建] 支付记录已创建 - ID: ${paymentRecordId}, PaymentIntent ID: ${paymentIntentId || '无'}`);
    } catch (error) {
      console.warn(`[Champion订阅创建] 创建支付记录失败: ${error.message}，继续处理订阅`);
    }

    // 6. 调用统一处理服务写入数据库（传入促销信息）
    const handleResult = await unifiedPaymentService.handleStripeChampionSubscriptionCreated({
      userId: parseInt(userId),
      novelId: parseInt(novelId),
      tierLevel: parseInt(tierLevel),
      tierName: priceInfo.tierName,
      monthlyPrice: priceInfo.monthlyPrice, // 原价
      currency: priceInfo.currency,
      subscription: subscriptionResult.subscription,
      customerId: customerId,
      paymentRecordId: paymentRecordId,
      promotionInfo: couponInfo.promotionInfo // 传入促销信息
    });

    console.log(`[Champion订阅创建] 完成 - Subscription ID: ${handleResult.subscriptionId}`);

    // 如果订阅状态是 incomplete，返回 client_secret 供前端完成支付
    const responseData = {
      success: true,
      subscriptionId: handleResult.subscriptionId,
      currentPeriodStart: handleResult.currentPeriodStart.toISOString(),
      currentPeriodEnd: handleResult.currentPeriodEnd.toISOString(),
      autoRenew: true
    };

    // 如果订阅需要完成支付，返回 client_secret
    if (subscriptionResult.subscription.status === 'incomplete' && subscriptionResult.clientSecret) {
      responseData.clientSecret = subscriptionResult.clientSecret;
      responseData.status = 'incomplete';
      console.log(`[Champion订阅创建] 订阅需要完成支付，返回 client_secret`);
    } else {
      responseData.status = subscriptionResult.subscription.status;
    }

    res.json(responseData);
  } catch (error) {
    console.error('[Champion订阅创建] 失败:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message || '创建订阅失败' 
    });
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
