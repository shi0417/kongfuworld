const StripeService = require('./stripeService');

// 初始化 StripeService 实例
const stripeService = new StripeService();

/**
 * Stripe Webhook Handler
 * 处理 Stripe 发送的 Webhook 事件
 * 
 * 重要：此路由必须使用 express.raw({ type: 'application/json' })
 * 不能使用 express.json()，否则 Stripe 签名验证会失败
 * 
 * @param {Object} req - Express 请求对象（req.body 是 Buffer）
 * @param {Object} res - Express 响应对象
 */
async function stripeWebhookHandler(req, res) {
  const sig = req.headers['stripe-signature'];
  const secret = process.env.STRIPE_WEBHOOK_SECRET;

  // 验证必要参数
  if (!sig) {
    console.error('❌ Stripe webhook: Missing stripe-signature header');
    return res.status(400).send('Missing stripe-signature header');
  }

  if (!secret) {
    console.error('❌ Stripe webhook: STRIPE_WEBHOOK_SECRET not configured');
    return res.status(500).send('Webhook secret not configured');
  }

  // req.body 应该是 Buffer（由 express.raw() 提供）
  if (!Buffer.isBuffer(req.body)) {
    console.error('❌ Stripe webhook: req.body is not a Buffer. Make sure to use express.raw() middleware');
    return res.status(400).send('Invalid request body format');
  }

  let event;

  try {
    // 使用 Stripe SDK 验证签名并构造事件对象
    event = stripeService.stripe.webhooks.constructEvent(
      req.body,
      sig,
      secret
    );
  } catch (err) {
    console.error('❌ Stripe webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  console.log('🔔 Received Stripe event:', event.type);

  try {
    // 使用 StripeService 的 handleWebhook 方法处理事件
    await stripeService.handleWebhook(req.body, sig);

    // 返回成功响应
    res.json({ received: true });
  } catch (error) {
    console.error('❌ Stripe webhook processing failed:', error);
    // 即使处理失败，也返回 200，避免 Stripe 重复发送
    // 但记录错误日志以便排查
    res.status(200).json({ 
      received: true, 
      error: error.message 
    });
  }
}

module.exports = stripeWebhookHandler;

