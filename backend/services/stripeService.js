const mysql = require('mysql2/promise');
const stripe = require('stripe');

// NOTE: env is already loaded by server.js via config/loadEnv.js

// Stripe配置
const STRIPE_CONFIG = {
  secretKey: process.env.STRIPE_SECRET_KEY,
  publishableKey: process.env.STRIPE_PUBLISHABLE_KEY,
  webhookSecret: process.env.STRIPE_WEBHOOK_SECRET
};

console.log('Stripe配置初始化:', {
  secretKey: STRIPE_CONFIG.secretKey ? '已设置' : '未设置',
  publishableKey: STRIPE_CONFIG.publishableKey ? '已设置' : '未设置',
  webhookSecret: STRIPE_CONFIG.webhookSecret ? '已设置' : '未设置'
});

class StripeService {
  constructor() {
    this.db = mysql.createPool({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'kongfuworld'
    });
    
    // 初始化Stripe客户端
    this.stripe = stripe(STRIPE_CONFIG.secretKey);
  }

  // 工具函数：格式化日期时间为字符串 'YYYY-MM-DD HH:mm:ss'
  formatDateTime(date) {
    if (!date) return null;
    const d = date instanceof Date ? date : new Date(date);
    if (isNaN(d.getTime())) return null;
    
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const seconds = String(d.getSeconds()).padStart(2, '0');
    
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  }

  // 工具函数：构造会员快照 JSON
  buildMembershipSnapshot(membership) {
    if (!membership) return null; // 没有会员就是 null
    
    return JSON.stringify({
      tier_level: membership.tier_level || null,
      tier_name: membership.tier_name || null,
      start_date: membership.start_date ? this.formatDateTime(membership.start_date) : null,
      end_date: membership.end_date ? this.formatDateTime(membership.end_date) : null
    });
  }

  // 创建支付意图
  async createPaymentIntent(userId, amount, currency = 'usd', novelId = null, paymentMethodId = null) {
    try {
      const paymentIntentData = {
        amount: Math.round(amount * 100), // 转换为分
        currency: currency,
        metadata: {
          userId: userId.toString(),
          novelId: novelId ? novelId.toString() : '7',
          type: 'champion_subscription'
        },
        automatic_payment_methods: {
          enabled: true,
        },
      };

      // 如果提供了支付方式ID，使用它
      if (paymentMethodId) {
        paymentIntentData.payment_method = paymentMethodId;
        paymentIntentData.confirmation_method = 'manual';
        paymentIntentData.confirm = true;
      }

      const paymentIntent = await this.stripe.paymentIntents.create(paymentIntentData);

      console.log('Stripe PaymentIntent创建成功:', paymentIntent.id);
      return paymentIntent;
    } catch (error) {
      console.error('Stripe PaymentIntent创建失败:', error);
      throw new Error(`Stripe payment creation failed: ${error.message}`);
    }
  }

  // 确认支付意图
  async confirmPaymentIntent(paymentIntentId) {
    try {
      const paymentIntent = await this.stripe.paymentIntents.retrieve(paymentIntentId);
      return paymentIntent;
    } catch (error) {
      console.error('Stripe PaymentIntent确认失败:', error);
      throw new Error(`Stripe payment confirmation failed: ${error.message}`);
    }
  }

  // 创建Karma支付意图 - 独立处理，不依赖Champion逻辑
  async createKarmaPaymentIntent(userId, amount, currency = 'usd', packageId) {
    try {
      const paymentIntentData = {
        amount: Math.round(amount), // 已经是分，不需要再转换
        currency: currency,
        metadata: {
          userId: userId.toString(),
          packageId: packageId.toString(),
          type: 'karma_purchase'
        },
        automatic_payment_methods: {
          enabled: true,
        },
      };

      const paymentIntent = await this.stripe.paymentIntents.create(paymentIntentData);

      console.log('Stripe Karma PaymentIntent创建成功:', paymentIntent.id);
      return paymentIntent;
    } catch (error) {
      console.error('Stripe Karma PaymentIntent创建失败:', error);
      throw new Error(`Stripe karma payment creation failed: ${error.message}`);
    }
  }

  // 记录支付到数据库
  async recordPayment(userId, amount, paymentId, status = 'pending', novelId = null, tierLevel = null, tierName = null) {
    try {
      let description = novelId ? 
        `Stripe Payment ID: ${paymentId} | Novel ID: ${novelId}` : 
        `Stripe Payment ID: ${paymentId}`;
      
      // 如果有等级信息，添加到描述中
      if (tierLevel !== null && tierName) {
        description += ` | Tier Level: ${tierLevel} | Tier Name: ${tierName}`;
      }
      
      const [result] = await this.db.execute(
        'INSERT INTO payment_record (user_id, novel_id, amount, payment_method, status, type, description) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [userId, novelId, amount, 'stripe', status, 'recharge', description]
      );
      return result.insertId;
    } catch (error) {
      throw new Error(`Database record failed: ${error.message}`);
    }
  }

  // 更新支付状态
  async updatePaymentStatus(paymentId, status, transactionId = null) {
    try {
      // 查找包含PaymentIntent ID的记录
      const [rows] = await this.db.execute(
        'SELECT id, description FROM payment_record WHERE description LIKE ?',
        [`%${paymentId}%`]
      );
      
      if (rows.length === 0) {
        console.warn(`未找到包含PaymentIntent ID ${paymentId}的支付记录`);
        return;
      }
      
      // 更新状态，保留原始description
      await this.db.execute(
        'UPDATE payment_record SET status = ?, updated_at = NOW() WHERE description LIKE ?',
        [status, `%${paymentId}%`]
      );
      
      console.log(`支付记录状态已更新: ${paymentId} -> ${status}`);
    } catch (error) {
      throw new Error(`Payment status update failed: ${error.message}`);
    }
  }

  // 创建Champion订阅
  async createChampionSubscription(userId, novelId, amount, tierLevel, tierName, paymentRecordId = null, paymentIntent = null) {
    try {
      // 检查是否已存在订阅（获取完整会员信息用于快照）
      const [existingSubscription] = await this.db.execute(
        'SELECT id, tier_level, tier_name, start_date, end_date FROM user_champion_subscription WHERE user_id = ? AND novel_id = ? AND is_active = 1',
        [userId, novelId]
      );

      // 构造购买前会员快照（在计算新日期之前）
      const currentMembership = existingSubscription.length > 0 ? existingSubscription[0] : null;
      const beforeMembershipSnapshot = this.buildMembershipSnapshot(currentMembership);

      // Champion 订阅采用「每笔订单 = 30 天服务期」的固定周期
      let subscriptionType = 'new';
      let startDate = new Date();
      // 新订阅：从当前时间开始，固定30天
      let endDate = new Date(startDate.getTime() + 30 * 24 * 60 * 60 * 1000);

      if (existingSubscription.length > 0) {
        // 如果存在订阅，延长到期时间
        // 续费：仍然以「现有订阅的 end_date 为下一段 start」的排队模型，但改成 30 天
        subscriptionType = 'extend';
        const currentEndDate = new Date(existingSubscription[0].end_date);
        startDate = currentEndDate;
        endDate = new Date(currentEndDate.getTime() + 30 * 24 * 60 * 60 * 1000);
        
        await this.db.execute(
          'UPDATE user_champion_subscription SET tier_level = ?, tier_name = ?, monthly_price = ?, end_date = ?, updated_at = NOW() WHERE id = ?',
          [tierLevel, tierName, amount, endDate, existingSubscription[0].id]
        );
        console.log(`Extended subscription for user ${userId}, novel ${novelId}. New end date: ${endDate.toISOString().split('T')[0]}`);
      } else {
        // 创建新的Champion订阅
        await this.db.execute(
          'INSERT INTO user_champion_subscription (user_id, novel_id, tier_level, tier_name, monthly_price, start_date, end_date, payment_method, is_active, created_at) VALUES (?, ?, ?, ?, ?, NOW(), DATE_ADD(NOW(), INTERVAL 30 DAY), ?, ?, NOW())',
          [userId, novelId, tierLevel, tierName, amount, 'stripe', 1]
        );
        console.log(`Created new subscription for user ${userId}, novel ${novelId}.`);
      }

      // 记录详细的支付信息到 user_champion_subscription_record 表
      if (paymentRecordId) {
        console.log('[createChampionSubscription] 准备创建订阅记录', {
          userId,
          novelId,
          paymentRecordId,
          paymentMethod: 'stripe',
          amount,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          subscriptionType
        });
        
        await this.createSubscriptionRecord({
          userId,
          novelId,
          paymentRecordId,
          tierLevel,
          tierName,
          monthlyPrice: amount,
          paymentAmount: amount,
          paymentMethod: 'stripe',
          paymentStatus: 'completed',
          subscriptionType,
          subscriptionDurationDays: 30,
          beforeMembershipSnapshot,
          afterMembershipSnapshot: JSON.stringify({
            tier_level: tierLevel,
            tier_name: tierName,
            start_date: this.formatDateTime(startDate),
            end_date: this.formatDateTime(endDate)
          }),
          startDate,
          endDate,
          paymentData: paymentIntent
        });
        
        console.log('[createChampionSubscription] 订阅记录创建成功');
      } else {
        console.warn('[createChampionSubscription] paymentRecordId 为空，跳过创建订阅记录');
      }
    } catch (error) {
      throw new Error(`Champion subscription creation failed: ${error.message}`);
    }
  }

  // 创建订阅记录详情
  // 参数说明：与 unifiedPaymentService.createSubscriptionRecord 保持一致
  async createSubscriptionRecord(payload) {
    const {
      userId,
      novelId,
      paymentRecordId,
      tierLevel,
      tierName,
      monthlyPrice,
      paymentAmount,
      paymentMethod = 'stripe',
      paymentStatus = 'completed',
      subscriptionType,
      subscriptionDurationDays = 30,
      beforeMembershipSnapshot,
      afterMembershipSnapshot,
      startDate,
      endDate,
      paymentData = null
    } = payload;

    try {
      console.log('[createSubscriptionRecord] 开始创建订阅记录', {
        userId,
        novelId,
        paymentRecordId,
        paymentMethod,
        paymentAmount,
        subscriptionType
      });

      // 提取支付平台相关信息
      let transactionId = null;
      let stripePaymentIntentId = null;
      let paypalOrderId = null;
      let stripeCustomerId = null;
      let paypalPayerId = null;
      let cardBrand = null;
      let cardLast4 = null;
      let cardExpMonth = null;
      let cardExpYear = null;

      if (paymentData) {
        if (paymentMethod === 'stripe' && paymentData.id) {
          transactionId = paymentData.id;
          stripePaymentIntentId = paymentData.id;
          stripeCustomerId = paymentData.customer || null;
          
          // Stripe 卡片信息
          if (paymentData.payment_method && typeof paymentData.payment_method === 'object') {
            const pm = paymentData.payment_method;
            if (pm.card) {
              cardBrand = pm.card.brand || null;
              cardLast4 = pm.card.last4 || null;
              cardExpMonth = pm.card.exp_month || null;
              cardExpYear = pm.card.exp_year || null;
            }
          }
        } else if (paymentMethod === 'paypal') {
          // PayPal 订单ID可能在多个位置
          if (paymentData.id) {
            transactionId = paymentData.id;
            paypalOrderId = paymentData.id;
          } else if (paymentData.purchase_units && paymentData.purchase_units[0] && paymentData.purchase_units[0].payments && paymentData.purchase_units[0].payments.captures && paymentData.purchase_units[0].payments.captures[0]) {
            const capture = paymentData.purchase_units[0].payments.captures[0];
            transactionId = capture.id || null;
            paypalOrderId = capture.id || null;
          }
          
          if (paymentData.payer && paymentData.payer.payer_id) {
            paypalPayerId = paymentData.payer.payer_id;
          }
        }
      }

      // 使用与 unifiedPaymentService 完全相同的 INSERT 语句结构
      const sql = `
        INSERT INTO user_champion_subscription_record (
          user_id,
          novel_id,
          payment_record_id,
          tier_level,
          tier_name,
          monthly_price,
          payment_amount,
          payment_method,
          payment_status,
          subscription_type,
          subscription_duration_days,
          before_membership_snapshot,
          after_membership_snapshot,
          start_date,
          end_date,
          is_active,
          auto_renew,
          transaction_id,
          stripe_payment_intent_id,
          paypal_order_id,
          stripe_customer_id,
          paypal_payer_id,
          card_brand,
          card_last4,
          card_exp_month,
          card_exp_year,
          currency,
          exchange_rate,
          local_amount,
          local_currency,
          discount_amount,
          discount_code,
          tax_amount,
          fee_amount,
          refund_amount,
          refund_reason,
          refund_date,
          notes,
          ip_address,
          user_agent
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      const params = [
        userId,                                    // user_id
        novelId,                                   // novel_id
        paymentRecordId,                           // payment_record_id
        tierLevel,                                 // tier_level
        tierName,                                  // tier_name
        monthlyPrice,                              // monthly_price
        paymentAmount,                             // payment_amount
        paymentMethod,                             // payment_method
        paymentStatus,                             // payment_status
        subscriptionType,                          // subscription_type
        subscriptionDurationDays,                  // subscription_duration_days
        beforeMembershipSnapshot,                  // before_membership_snapshot
        afterMembershipSnapshot,                   // after_membership_snapshot
        startDate,                                 // start_date
        endDate,                                   // end_date
        1,                                         // is_active
        0,                                         // auto_renew
        transactionId,                             // transaction_id
        stripePaymentIntentId,                     // stripe_payment_intent_id
        paypalOrderId,                             // paypal_order_id
        stripeCustomerId,                           // stripe_customer_id
        paypalPayerId,                             // paypal_payer_id
        cardBrand,                                 // card_brand
        cardLast4,                                 // card_last4
        cardExpMonth,                              // card_exp_month
        cardExpYear,                               // card_exp_year
        'USD',                                     // currency
        null,                                      // exchange_rate
        null,                                      // local_amount
        null,                                      // local_currency
        0.00,                                      // discount_amount
        null,                                      // discount_code
        0.00,                                      // tax_amount
        0.00,                                      // fee_amount
        0.00,                                      // refund_amount
        null,                                      // refund_reason
        null,                                      // refund_date
        null,                                      // notes
        null,                                      // ip_address
        null                                       // user_agent
      ];

      await this.db.execute(sql, params);

      console.log(`[createSubscriptionRecord] 订阅记录创建成功 - 用户: ${userId}, 小说: ${novelId}, 支付记录: ${paymentRecordId}`);
    } catch (error) {
      console.error('[createSubscriptionRecord] 创建订阅记录失败', {
        errorMessage: error.message,
        errorCode: error.code,
        errorStack: error.stack,
        userId,
        novelId,
        paymentRecordId,
        paymentMethod,
        paymentAmount,
        subscriptionType
      });
      // ⚠️ 抛出错误，让调用方知道有问题，避免静默失败
      throw error;
    }
  }

  // 处理Webhook事件
  async handleWebhook(payload, signature) {
    try {
      const event = this.stripe.webhooks.constructEvent(
        payload,
        signature,
        STRIPE_CONFIG.webhookSecret
      );

      console.log('Stripe Webhook事件:', event.type);

      switch (event.type) {
        case 'payment_intent.succeeded':
          await this.handlePaymentSuccess(event.data.object);
          break;
        case 'payment_intent.payment_failed':
          await this.handlePaymentFailure(event.data.object);
          break;
        case 'invoice.payment_succeeded':
          await this.handleInvoicePaymentSucceeded(event.data.object);
          break;
        case 'customer.subscription.deleted':
          await this.handleSubscriptionDeleted(event.data.object);
          break;
        default:
          console.log(`未处理的Stripe事件类型: ${event.type}`);
      }

      return { received: true };
    } catch (error) {
      console.error('Stripe Webhook处理失败:', error);
      throw new Error(`Webhook handling failed: ${error.message}`);
    }
  }

  // 处理发票支付成功事件（订阅续费）
  async handleInvoicePaymentSucceeded(invoice) {
    try {
      console.log(`[Stripe订阅续费] 收到invoice.payment_succeeded事件 - Invoice ID: ${invoice.id}`);

      // 调试日志：打印关键字段（不打印全量对象，避免日志过长）
      console.log('[Stripe订阅续费] Invoice 关键信息', {
        invoiceId: invoice.id,
        customer: invoice.customer,
        subscription: invoice.subscription,
        lineSubscription: invoice.lines && Array.isArray(invoice.lines.data) && invoice.lines.data.length > 0
          ? invoice.lines.data[0].subscription
          : null,
        amountPaid: invoice.amount_paid,
        currency: invoice.currency,
      });

      // 1. 从 invoice 中更鲁棒地获取 subscriptionId
      // 优先使用 invoice.subscription
      let subscriptionId = invoice.subscription;
      
      // 如果为空，再从 invoice.lines.data[0].subscription 兜底获取
      if (!subscriptionId && invoice.lines && Array.isArray(invoice.lines.data) && invoice.lines.data.length > 0) {
        const firstLine = invoice.lines.data[0];
        if (firstLine.subscription) {
          subscriptionId = firstLine.subscription;
          console.log(`[Stripe订阅续费] 从 invoice.lines.data[0].subscription 获取 subscriptionId: ${subscriptionId}`);
        }
      }

      // 如果仍然没有，从 Stripe API 重新获取完整的 invoice 对象（webhook 可能只传递了部分数据）
      if (!subscriptionId) {
        try {
          console.log(`[Stripe订阅续费] 从 Stripe API 重新获取 Invoice 对象 - Invoice ID: ${invoice.id}`);
          const fullInvoice = await this.stripe.invoices.retrieve(invoice.id, {
            expand: ['subscription', 'lines.data.subscription']
          });
          
          // 再次尝试获取 subscriptionId
          if (fullInvoice.subscription) {
            subscriptionId = typeof fullInvoice.subscription === 'string' 
              ? fullInvoice.subscription 
              : fullInvoice.subscription.id;
            console.log(`[Stripe订阅续费] 从 Stripe API 获取的 invoice.subscription: ${subscriptionId}`);
          } else if (fullInvoice.lines && Array.isArray(fullInvoice.lines.data) && fullInvoice.lines.data.length > 0) {
            const firstLine = fullInvoice.lines.data[0];
            if (firstLine.subscription) {
              subscriptionId = typeof firstLine.subscription === 'string'
                ? firstLine.subscription
                : firstLine.subscription.id;
              console.log(`[Stripe订阅续费] 从 Stripe API 获取的 invoice.lines.data[0].subscription: ${subscriptionId}`);
            }
          }
          
          // 如果从 API 获取到了完整的 invoice，使用它替换原来的 invoice
          if (subscriptionId) {
            invoice = fullInvoice;
            console.log(`[Stripe订阅续费] 已使用从 Stripe API 获取的完整 Invoice 对象`);
          }
        } catch (apiError) {
          console.error(`[Stripe订阅续费] 从 Stripe API 获取 Invoice 失败: ${apiError.message}`);
        }
      }

      // 仍然没有则记录详细日志并返回
      if (!subscriptionId) {
        console.warn('[Stripe订阅续费] 无法从 Invoice 中解析出 stripeSubscriptionId', {
          invoiceId: invoice.id,
          hasInvoiceSubscriptionField: !!invoice.subscription,
          lineCount: invoice.lines && Array.isArray(invoice.lines.data) ? invoice.lines.data.length : 0,
          firstLineHasSubscription: invoice.lines && Array.isArray(invoice.lines.data) && invoice.lines.data.length > 0
            ? !!invoice.lines.data[0].subscription
            : false,
        });
        return;
      }

      console.log('[Stripe订阅续费] 解析到 Stripe Subscription ID', {
        invoiceId: invoice.id,
        stripeSubscriptionId: subscriptionId,
      });

      const customerId = invoice.customer;
      const amountPaid = invoice.amount_paid / 100; // 转换为美元
      const currency = invoice.currency;

      // 2. 获取周期起止时间
      let periodStart = null;
      let periodEnd = null;
      if (invoice.lines && invoice.lines.data && invoice.lines.data.length > 0) {
        const line = invoice.lines.data[0];
        if (line.period) {
          periodStart = new Date(line.period.start * 1000);
          periodEnd = new Date(line.period.end * 1000);
        }
      }

      // 3. 通过 subscription_id 查找本地订阅记录
      const [subscriptionRecords] = await this.db.execute(
        'SELECT id, user_id, novel_id, tier_level, tier_name, end_date FROM user_champion_subscription WHERE stripe_subscription_id = ? AND is_active = 1',
        [subscriptionId]
      );

      if (subscriptionRecords.length === 0) {
        console.warn(`[Stripe订阅续费] 未找到本地订阅记录 - Subscription ID: ${subscriptionId}`);
        return; // 不抛异常，避免影响 Webhook 返回
      }

      const subscriptionRecord = subscriptionRecords[0];
      const userId = subscriptionRecord.user_id;
      const novelId = subscriptionRecord.novel_id;
      const tierLevel = subscriptionRecord.tier_level;
      const tierName = subscriptionRecord.tier_name;

      console.log(`[Stripe订阅续费] 找到本地订阅记录 - 用户: ${userId}, 小说: ${novelId}, 等级: ${tierLevel}, 当前到期时间: ${subscriptionRecord.end_date}`);

      // 4. 计算新的 end_date
      // 策略：在现有 end_date 基础上延长 30 天，然后与 invoice.period.end 比较，取两者中更长的日期
      // 这样可以确保用户权益最大化（如果 Stripe 周期更长，使用 Stripe 的；如果本地延长更长，使用本地的）
      const currentEndDate = new Date(subscriptionRecord.end_date);
      const localExtendedDate = new Date(currentEndDate);
      localExtendedDate.setDate(localExtendedDate.getDate() + 30);
      
      // 比较本地延长后的日期和 invoice 的 period.end，取更长的
      let newEndDate = localExtendedDate;
      if (periodEnd && periodEnd > localExtendedDate) {
        newEndDate = periodEnd;
        console.log(`[Stripe订阅续费] 使用 Stripe Invoice period.end（更长）: ${newEndDate.toISOString()}`);
      } else {
        console.log(`[Stripe订阅续费] 使用本地延长后的日期（更长）: ${newEndDate.toISOString()}`);
      }
      
      console.log(`[Stripe订阅续费] 日期比较 - 当前到期: ${currentEndDate.toISOString()}, 本地延长30天: ${localExtendedDate.toISOString()}, Stripe period.end: ${periodEnd ? periodEnd.toISOString() : 'N/A'}, 最终使用: ${newEndDate.toISOString()}`);

      // 5. 更新 user_champion_subscription
      await this.db.execute(
        'UPDATE user_champion_subscription SET end_date = ?, auto_renew = 1, updated_at = NOW() WHERE id = ?',
        [newEndDate, subscriptionRecord.id]
      );
      console.log(`[Stripe订阅续费] 更新订阅到期时间 - 新到期时间: ${newEndDate.toISOString().split('T')[0]}`);

      // 6. 创建 payment_record 记录（续费也需要支付记录）
      let paymentRecordId = null;
      try {
        const description = `Champion Subscription Renewal - Tier ${tierLevel} (${tierName}) - Invoice: ${invoice.id}`;
        
        // 获取 payment_intent_id
        let paymentIntentIdForRecord = null;
        if (invoice.payment_intent) {
          paymentIntentIdForRecord = typeof invoice.payment_intent === 'string' 
            ? invoice.payment_intent 
            : invoice.payment_intent.id;
        }
        
        const [paymentRecordResult] = await this.db.execute(
          `INSERT INTO payment_record (user_id, novel_id, amount, payment_method, status, type, description, stripe_subscription_id, stripe_payment_intent_id, stripe_customer_id, created_at) 
           VALUES (?, ?, ?, 'stripe', 'completed', 'champion_subscribe', ?, ?, ?, ?, NOW())`,
          [
            userId,
            novelId,
            amountPaid,
            description,
            subscriptionId,
            paymentIntentIdForRecord,
            customerId
          ]
        );
        paymentRecordId = paymentRecordResult.insertId;
        console.log(`[Stripe订阅续费] 创建支付记录 - ID: ${paymentRecordId}, 金额: $${amountPaid}`);
      } catch (paymentRecordError) {
        console.error(`[Stripe订阅续费] 创建支付记录失败: ${paymentRecordError.message}`);
        // 不抛出异常，继续处理续费逻辑
      }

      // 7. 获取 payment_intent_id（如果有）
      let paymentIntentId = null;
      if (invoice.payment_intent) {
        if (typeof invoice.payment_intent === 'string') {
          paymentIntentId = invoice.payment_intent;
        } else if (invoice.payment_intent.id) {
          paymentIntentId = invoice.payment_intent.id;
        }
      }

      // 8. 计算订阅时长（天）
      // 续费固定为 30 天
      const subscriptionDurationDays = 30;

      // 9. 插入新的 user_champion_subscription_record 记录
      const startDateForRecord = new Date(subscriptionRecord.end_date); // 续费开始时间 = 原到期时间
      const endDateForRecord = newEndDate;

      // 构造会员快照
      const beforeMembershipSnapshot = this.buildMembershipSnapshot({
        tier_level: tierLevel,
        tier_name: tierName,
        start_date: subscriptionRecord.end_date,
        end_date: subscriptionRecord.end_date
      });

      const afterMembershipSnapshot = JSON.stringify({
        tier_level: tierLevel,
        tier_name: tierName,
        start_date: this.formatDateTime(startDateForRecord),
        end_date: this.formatDateTime(endDateForRecord)
      });

      // 获取 monthly_price（原价 basePrice）
      const [tierInfo] = await this.db.execute(
        'SELECT monthly_price FROM novel_champion_tiers WHERE novel_id = ? AND tier_level = ? AND is_active = 1',
        [novelId, tierLevel]
      );
      const basePrice = tierInfo.length > 0 ? parseFloat(tierInfo[0].monthly_price) : amountPaid;
      
      // 计算折扣信息
      // 续费时，如果 coupon 的 duration='once'，Stripe 只会在首个 invoice 应用折扣
      // 后续续费时，invoice.amount_paid = 原价金额
      const actualPaymentAmount = amountPaid; // 本期实际支付金额
      const discountAmount = basePrice - actualPaymentAmount; // 正常情况下等于 0（因为续费时没有折扣）
      
      console.log(`[Stripe订阅续费] 价格信息 - 原价: $${basePrice}, 实际支付: $${actualPaymentAmount}, 折扣: $${discountAmount}`);

      // 使用 unifiedPaymentService.createSubscriptionRecord 统一创建订阅记录
      // 注意：stripe_subscription_id 只存储 Stripe Subscription ID (sub_xxx)，不存储 invoice.id
      const UnifiedPaymentService = require('./unifiedPaymentService');
      const unifiedPaymentService = new UnifiedPaymentService();

      // 如果 paymentRecordId 为 null，说明创建支付记录失败，需要处理
      if (!paymentRecordId) {
        console.warn(`[Stripe订阅续费] paymentRecordId 为 null，无法创建订阅记录。但订阅到期时间已更新。`);
        // 不创建订阅记录，但订阅已更新，这是可以接受的
        return;
      }

      await unifiedPaymentService.createSubscriptionRecord({
        userId,
        novelId,
        paymentRecordId: paymentRecordId, // 续费时也需要关联 payment_record
        tierLevel,
        tierName,
        monthlyPrice: basePrice, // 原价
        paymentAmount: actualPaymentAmount, // 实际支付金额
        paymentMethod: 'stripe',
        paymentStatus: 'completed',
        subscriptionType: 'renew',
        subscriptionDurationDays,
        beforeMembershipSnapshot,
        afterMembershipSnapshot,
        startDate: startDateForRecord,
        endDate: endDateForRecord,
        paymentData: null, // 续费时不需要 paymentData
        discountAmount: discountAmount, // 续费时通常为 0
        discountCode: null, // 续费时无折扣代码
        autoRenew: 1, // 续费时自动续费开启
        stripeSubscriptionId: subscriptionId, // Stripe Subscription ID (sub_xxx)，不存储 invoice.id
        stripePaymentIntentId: paymentIntentId, // Stripe PaymentIntent ID (pi_xxx)
        stripeCustomerId: customerId // Stripe Customer ID (cus_xxx)
      });

      console.log(`[Stripe订阅续费] 续费记录已创建 - 用户: ${userId}, 小说: ${novelId}, 金额: $${actualPaymentAmount}`);

      // 9. 可选：同步 Stripe Subscription 状态（确保 billing_cycle_anchor 对齐）
      // 理论上，Stripe 此时的 billing_cycle_anchor 已经是新的周期；我们本地 end_date 是按这个周期为基础延长的
      // 为了简单和一致性，可以选择性调用 sync 函数，确保极端情况下也强行对齐
      try {
        await this.syncChampionStripeSubscriptionWithLocalState(userId, novelId);
        console.log(`[Stripe订阅续费] Stripe Subscription 同步完成 - 用户: ${userId}, 小说: ${novelId}`);
      } catch (syncError) {
        // 同步失败不影响续费流程，只记录日志
        console.warn(`[Stripe订阅续费] Stripe Subscription 同步失败（不影响续费）`, {
          userId,
          novelId,
          error: syncError.message
        });
      }

    } catch (error) {
      console.error('[Stripe订阅续费] 处理失败:', error);
      // 不抛异常，避免影响 Webhook 返回，但记录错误日志
    }
  }

  // 处理支付成功
  async handlePaymentSuccess(paymentIntent) {
    try {
      console.log(`[Stripe支付成功] 开始处理 - PaymentIntent ID: ${paymentIntent.id}`);
      
      const amount = paymentIntent.amount / 100; // 转换为美元
      
      // 1. 查找对应的支付记录（优先通过 stripe_payment_intent_id，向后兼容通过 description）
      let paymentRecords = [];
      // 优先使用新字段查询
      const [recordsByField] = await this.db.execute(
        'SELECT id, user_id, novel_id, amount, description, type FROM payment_record WHERE stripe_payment_intent_id = ? ORDER BY created_at DESC LIMIT 1',
        [paymentIntent.id]
      );
      if (recordsByField.length > 0) {
        paymentRecords = recordsByField;
      } else {
        // 向后兼容：通过 description 查找
        const [recordsByDesc] = await this.db.execute(
          'SELECT id, user_id, novel_id, amount, description, type FROM payment_record WHERE description LIKE ? ORDER BY created_at DESC LIMIT 1',
          [`%PaymentIntent ID: ${paymentIntent.id}%`]
        );
        paymentRecords = recordsByDesc;
      }

      if (paymentRecords.length === 0) {
        console.warn(`[Stripe支付成功] 未找到包含PaymentIntent ID ${paymentIntent.id}的支付记录`);
        
        // 尝试通过 metadata 查找（兼容旧逻辑）
        const { userId, novelId } = paymentIntent.metadata || {};
        if (userId && novelId) {
          console.log(`[Stripe支付成功] 尝试通过 metadata 处理 - 用户: ${userId}, 小说: ${novelId}`);
          // 这里可以调用旧的逻辑，但通常订阅支付应该已经有记录
        }
        return;
      }

      const paymentRecord = paymentRecords[0];
      const userId = paymentRecord.user_id;
      const novelId = paymentRecord.novel_id;
      const paymentRecordId = paymentRecord.id;
      const isChampionSubscribe = paymentRecord.type === 'champion_subscribe';

      console.log(`[Stripe支付成功] 找到支付记录 - ID: ${paymentRecordId}, 用户: ${userId}, 小说: ${novelId}, 原金额: $${paymentRecord.amount}, 实际支付: $${amount}`);

      // 2. 更新支付记录的金额、状态和 Stripe 专用字段
      // 对于所有支付，都尝试更新 Stripe 相关字段（如果存在）
      const updateFields = ['amount = ?', 'status = ?', 'updated_at = NOW()'];
      const updateValues = [amount, 'completed'];
      
      // 添加 Stripe 相关字段
      if (paymentIntent.id) {
        updateFields.push('stripe_payment_intent_id = ?');
        updateValues.push(paymentIntent.id);
      }
      if (paymentIntent.customer) {
        updateFields.push('stripe_customer_id = ?');
        updateValues.push(paymentIntent.customer);
      }
      
      // 尝试从 paymentIntent 的 metadata 或 subscription 中获取 subscription_id
      let subscriptionId = null;
      if (paymentIntent.metadata && paymentIntent.metadata.subscriptionId) {
        subscriptionId = paymentIntent.metadata.subscriptionId;
      } else if (paymentIntent.invoice) {
        // 如果 paymentIntent 关联了 invoice，可以通过 invoice 获取 subscription
        try {
          const invoice = await this.stripe.invoices.retrieve(paymentIntent.invoice);
          if (invoice.subscription) {
            subscriptionId = typeof invoice.subscription === 'string' ? invoice.subscription : invoice.subscription.id;
          }
        } catch (err) {
          console.warn(`[Stripe支付成功] 获取 invoice 失败: ${err.message}`);
        }
      }
      
      if (subscriptionId) {
        updateFields.push('stripe_subscription_id = ?');
        updateValues.push(subscriptionId);
      }
      
      updateValues.push(paymentRecordId);
      
      await this.db.execute(
        `UPDATE payment_record SET ${updateFields.join(', ')} WHERE id = ?`,
        updateValues
      );
      console.log(`[Stripe支付成功] 支付记录已更新 - ID: ${paymentRecordId}, 金额: $${amount}`);

      // 3. 查找对应的订阅记录（通过 payment_record_id）
      const [subscriptionRecords] = await this.db.execute(
        'SELECT id, payment_amount, end_date, subscription_type, subscription_duration_days FROM user_champion_subscription_record WHERE payment_record_id = ? ORDER BY created_at DESC LIMIT 1',
        [paymentRecordId]
      );

      if (subscriptionRecords.length > 0) {
        const subscriptionRecord = subscriptionRecords[0];
        const oldPaymentAmount = subscriptionRecord.payment_amount;
        const oldEndDate = new Date(subscriptionRecord.end_date);
        
        console.log(`[Stripe支付成功] 找到订阅记录 - ID: ${subscriptionRecord.id}, 原支付金额: $${oldPaymentAmount}, 原到期时间: ${oldEndDate.toISOString()}`);

        // 4. 更新订阅记录的支付金额
        await this.db.execute(
          'UPDATE user_champion_subscription_record SET payment_amount = ?, payment_status = ?, updated_at = NOW() WHERE id = ?',
          [amount, 'completed', subscriptionRecord.id]
        );
        console.log(`[Stripe支付成功] 订阅记录支付金额已更新 - ID: ${subscriptionRecord.id}, 金额: $${amount}`);

        // 5. 如果是首次支付（subscription_type = 'extend' 或 'new'），且支付金额从 0 变为实际金额，需要延长期限
        if ((subscriptionRecord.subscription_type === 'extend' || subscriptionRecord.subscription_type === 'new') && 
            oldPaymentAmount === 0 && amount > 0) {
          
          // 获取当前订阅信息
          const [currentSubscription] = await this.db.execute(
            'SELECT id, end_date FROM user_champion_subscription WHERE user_id = ? AND novel_id = ? AND is_active = 1 ORDER BY end_date DESC LIMIT 1',
            [userId, novelId]
          );

          if (currentSubscription.length > 0) {
            const currentEndDate = new Date(currentSubscription[0].end_date);
            // 从订阅记录中获取订阅天数，如果没有则使用默认值 31 天
            const subscriptionDurationDays = subscriptionRecord.subscription_duration_days || 31;
            
            // 计算新的到期时间：在现有到期时间基础上延长
            const newEndDate = new Date(currentEndDate.getTime() + subscriptionDurationDays * 24 * 60 * 60 * 1000);
            
            console.log(`[Stripe支付成功] 延长期限 - 当前到期: ${currentEndDate.toISOString()}, 延长 ${subscriptionDurationDays} 天, 新到期: ${newEndDate.toISOString()}`);
            
            // 更新订阅的到期时间
            await this.db.execute(
              'UPDATE user_champion_subscription SET end_date = ?, updated_at = NOW() WHERE id = ?',
              [newEndDate, currentSubscription[0].id]
            );
            
            // 更新订阅记录的到期时间
            await this.db.execute(
              'UPDATE user_champion_subscription_record SET end_date = ?, after_membership_snapshot = JSON_SET(COALESCE(after_membership_snapshot, "{}"), "$.end_date", ?) WHERE id = ?',
              [newEndDate, newEndDate.toISOString().replace('T', ' ').substring(0, 19), subscriptionRecord.id]
            );
            
            console.log(`[Stripe支付成功] 期限已延长 - 订阅ID: ${currentSubscription[0].id}, 新到期时间: ${newEndDate.toISOString()}`);
          }
        }
      } else {
        console.warn(`[Stripe支付成功] 未找到对应的订阅记录 - payment_record_id: ${paymentRecordId}`);
      }

      console.log(`[Stripe支付成功] 处理完成 - PaymentIntent ID: ${paymentIntent.id}`);
    } catch (error) {
      console.error('[Stripe支付成功] 处理失败:', error);
      throw error; // 重新抛出错误，让调用方知道有问题
    }
  }

  // 处理支付失败
  async handlePaymentFailure(paymentIntent) {
    try {
      await this.updatePaymentStatus(paymentIntent.id, 'failed');
      console.log(`Stripe支付失败处理完成: ${paymentIntent.id}`);
    } catch (error) {
      console.error('处理Stripe支付失败失败:', error);
    }
  }

  // 获取用户的支付方式
  async getUserPaymentMethods(userId) {
    try {
      const [rows] = await this.db.execute(
        'SELECT * FROM user_payment_methods WHERE user_id = ? AND is_active = 1 ORDER BY is_default DESC, created_at DESC',
        [userId]
      );
      return rows;
    } catch (error) {
      throw new Error(`获取用户支付方式失败: ${error.message}`);
    }
  }

  // 保存支付方式
  async savePaymentMethod(userId, paymentMethodId, cardInfo) {
    try {
      const [result] = await this.db.execute(
        'INSERT INTO user_payment_methods (user_id, payment_method_id, card_brand, card_last4, card_exp_month, card_exp_year, is_default) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [
          userId,
          paymentMethodId,
          cardInfo.brand,
          cardInfo.last4,
          cardInfo.exp_month,
          cardInfo.exp_year,
          0 // 新添加的支付方式默认不是默认方式
        ]
      );
      return result.insertId;
    } catch (error) {
      throw new Error(`保存支付方式失败: ${error.message}`);
    }
  }

  // 设置默认支付方式
  async setDefaultPaymentMethod(userId, paymentMethodId) {
    try {
      // 先清除所有默认标记
      await this.db.execute(
        'UPDATE user_payment_methods SET is_default = 0 WHERE user_id = ?',
        [userId]
      );
      
      // 设置新的默认支付方式
      await this.db.execute(
        'UPDATE user_payment_methods SET is_default = 1 WHERE user_id = ? AND payment_method_id = ?',
        [userId, paymentMethodId]
      );
    } catch (error) {
      throw new Error(`设置默认支付方式失败: ${error.message}`);
    }
  }

  // 删除支付方式
  async deletePaymentMethod(userId, paymentMethodId) {
    try {
      await this.db.execute(
        'UPDATE user_payment_methods SET is_active = 0 WHERE user_id = ? AND payment_method_id = ?',
        [userId, paymentMethodId]
      );
    } catch (error) {
      throw new Error(`删除支付方式失败: ${error.message}`);
    }
  }

  // 获取或创建 Stripe Customer
  async getOrCreateCustomer(userId, userEmail = null) {
    try {
      // 首先尝试从 user_champion_subscription_record 中查找已有的 customer_id
      const [existingRecords] = await this.db.execute(
        'SELECT stripe_customer_id FROM user_champion_subscription_record WHERE user_id = ? AND stripe_customer_id IS NOT NULL ORDER BY created_at DESC LIMIT 1',
        [userId]
      );

      if (existingRecords.length > 0 && existingRecords[0].stripe_customer_id) {
        const customerId = existingRecords[0].stripe_customer_id;
        console.log(`[Stripe订阅] 找到已有Customer ID: ${customerId}`);
        
        // 验证 customer 是否仍然存在
        try {
          const customer = await this.stripe.customers.retrieve(customerId);
          return customer.id;
        } catch (error) {
          console.warn(`[Stripe订阅] Customer ${customerId} 不存在，将创建新的`);
        }
      }

      // 如果没有找到，创建新的 customer
      // TODO: 需要从 user 表获取 email，这里暂时使用传入的 email 或生成一个临时标识
      const customerData = {
        metadata: {
          userId: userId.toString()
        }
      };

      if (userEmail) {
        customerData.email = userEmail;
      }

      const customer = await this.stripe.customers.create(customerData);
      console.log(`[Stripe订阅] 创建新Customer ID: ${customer.id}`);
      
      return customer.id;
    } catch (error) {
      console.error('[Stripe订阅] 获取或创建Customer失败:', error);
      throw new Error(`获取或创建Stripe Customer失败: ${error.message}`);
    }
  }

  // 创建 Champion 订阅（Stripe Subscription）
  // 使用动态 Price（从数据库 novel_champion_tiers 中获取或创建）
  // 支持传入 couponId 应用促销折扣
  // 如果没有提供 paymentMethodId，将创建未完成的订阅，返回 client_secret 供前端完成支付
  // 如果用户已有订阅且到期时间更晚，可以在创建时设置 billing_cycle_anchor（通过 billingCycleAnchor 参数传入）
  async createChampionSubscription({ userId, novelId, tierLevel, tierName, priceId, paymentMethodId = null, userEmail = null, couponId = null, billingCycleAnchor = null }) {
    try {
      console.log(`[Stripe订阅] 开始创建Champion订阅 - 用户: ${userId}, 小说: ${novelId}, 等级: ${tierLevel}, Price ID: ${priceId}, Coupon ID: ${couponId || '无'}, Payment Method ID: ${paymentMethodId || '无'}`);

      if (!priceId) {
        throw new Error('Price ID 不能为空，请先调用 getOrCreateStripePriceForChampionTier 获取 Price ID');
      }

      // 0. 检查是否已有 active 的 Stripe Subscription
      // 策略 B：如果用户已有 Stripe Subscription，不应该创建新的
      // 这个检查在路由层已经处理，这里只做日志记录
      const [existingSubscriptions] = await this.db.execute(
        'SELECT id, stripe_subscription_id, auto_renew FROM user_champion_subscription WHERE user_id = ? AND novel_id = ? AND is_active = 1',
        [userId, novelId]
      );

      if (existingSubscriptions.length > 0) {
        const existingSub = existingSubscriptions[0];
        if (existingSub.stripe_subscription_id && Number(existingSub.auto_renew) === 1) {
          console.warn(`[Stripe订阅] 用户 ${userId} 对小说 ${novelId} 已有 active 的 Stripe Subscription: ${existingSub.stripe_subscription_id}`);
          // 注意：路由层应该已经处理了这种情况，这里不应该抛出错误
          // 但如果路由层没有处理，这里仍然抛出错误作为最后一道防线
          throw new Error('You already have an active Stripe subscription for this novel.');
        }
      }

      // 1. 获取或创建 Stripe Customer
      const customerId = await this.getOrCreateCustomer(userId, userEmail);

      // 2. 创建 Stripe Subscription（使用传入的 priceId）
      const subscriptionData = {
        customer: customerId,
        items: [{ price: priceId }],
        metadata: {
          userId: userId.toString(),
          novelId: novelId.toString(),
          tierLevel: tierLevel.toString(),
          tierName: tierName
        },
        expand: ['latest_invoice.payment_intent']
      };

      // 如果提供了 billingCycleAnchor，在创建订阅时设置（用于对齐用户已有的更晚到期时间）
      if (billingCycleAnchor) {
        subscriptionData.billing_cycle_anchor = billingCycleAnchor;
        console.log(`[Stripe订阅] 设置 billing_cycle_anchor - ${new Date(billingCycleAnchor * 1000).toISOString()}`);
      }

      // 如果提供了 paymentMethodId，设置为默认支付方式
      if (paymentMethodId) {
        subscriptionData.default_payment_method = paymentMethodId;
      } else {
        // 如果没有提供支付方式，使用 default_incomplete 模式
        // 这样订阅会先创建，但需要用户完成支付后才能激活
        subscriptionData.payment_behavior = 'default_incomplete';
        subscriptionData.payment_settings = {
          payment_method_types: ['card'],
          save_default_payment_method: 'on_subscription'
        };
        console.log(`[Stripe订阅] 未提供支付方式，将创建未完成的订阅，等待用户完成支付`);
      }

      // 如果提供了 couponId，应用折扣
      if (couponId) {
        subscriptionData.discounts = [{ coupon: couponId }];
        console.log(`[Stripe订阅] 应用促销折扣 - Coupon ID: ${couponId}`);
      }

      const subscription = await this.stripe.subscriptions.create(subscriptionData);

      console.log(`[Stripe订阅] 订阅创建成功 - Subscription ID: ${subscription.id}, Customer ID: ${customerId}, Price ID: ${priceId}, Status: ${subscription.status}`);

      // 3. 获取第一期的金额和支付信息
      const amountPaid = subscription.latest_invoice?.amount_paid || 0;
      const amountInDollars = amountPaid / 100;
      
      // 获取 client_secret（用于前端完成支付）
      let clientSecret = null;
      if (subscription.latest_invoice?.payment_intent) {
        const paymentIntent = subscription.latest_invoice.payment_intent;
        if (typeof paymentIntent === 'object' && paymentIntent.client_secret) {
          clientSecret = paymentIntent.client_secret;
        } else if (typeof paymentIntent === 'string') {
          // 如果 payment_intent 是字符串 ID，需要获取详细信息
          const pi = await this.stripe.paymentIntents.retrieve(paymentIntent);
          clientSecret = pi.client_secret;
        }
      }

      return {
        subscription,
        customerId,
        amountInDollars,
        currentPeriodStart: new Date(subscription.current_period_start * 1000),
        currentPeriodEnd: new Date(subscription.current_period_end * 1000),
        clientSecret, // 返回 client_secret 供前端完成支付
        status: subscription.status // 返回订阅状态
      };
    } catch (error) {
      console.error('[Stripe订阅] 创建订阅失败:', error);
      throw new Error(`创建Stripe订阅失败: ${error.message}`);
    }
  }

  // 取消订阅（在周期结束时取消）
  async cancelSubscriptionAtPeriodEnd(subscriptionId) {
    try {
      console.log(`[Stripe订阅] 取消订阅 - Subscription ID: ${subscriptionId}`);
      
      const subscription = await this.stripe.subscriptions.update(subscriptionId, {
        cancel_at_period_end: true
      });

      console.log(`[Stripe订阅] 订阅已设置为周期结束后取消 - cancel_at_period_end: ${subscription.cancel_at_period_end}`);
      
      return subscription;
    } catch (error) {
      console.error('[Stripe订阅] 取消订阅失败:', error);
      throw new Error(`取消Stripe订阅失败: ${error.message}`);
    }
  }

  /**
   * 将指定 Stripe Subscription 切换到新的 price（升级 tier 场景）
   * - 默认假定 Subscription 只有一个 item（单价目），使用 items.data[0]
   * - 使用 proration_behavior: 'none'，不做 proration 补差价，从下一期开始按新价格扣款
   * 
   * @param {Object} params
   * @param {string} params.stripeSubscriptionId  订阅 ID (sub_xxx)
   * @param {string} params.newPriceId             新等级的 Stripe Price ID
   * @param {string} [params.logContext]           日志上下文，方便排错
   */
  async updateSubscriptionPriceWithoutProration({ stripeSubscriptionId, newPriceId, logContext = '' }) {
    try {
      if (!stripeSubscriptionId || !newPriceId) {
        console.warn('[Stripe订阅] updateSubscriptionPriceWithoutProration 缺少参数', { stripeSubscriptionId, newPriceId, logContext });
        return;
      }

      // 先获取 subscription，拿到 item id
      const subscription = await this.stripe.subscriptions.retrieve(stripeSubscriptionId, {
        expand: ['items'],
      });

      if (!subscription.items || !subscription.items.data || subscription.items.data.length === 0) {
        console.warn('[Stripe订阅] 当前订阅没有 items，无法更新 price', { stripeSubscriptionId, logContext });
        return;
      }

      const subscriptionItemId = subscription.items.data[0].id;

      console.log('[Stripe订阅] 准备更新订阅 price（无 proration）', {
        stripeSubscriptionId,
        subscriptionItemId,
        newPriceId,
        logContext,
      });

      const updated = await this.stripe.subscriptions.update(stripeSubscriptionId, {
        items: [
          {
            id: subscriptionItemId,
            price: newPriceId,
          },
        ],
        proration_behavior: 'none',
      });

      console.log('[Stripe订阅] 已更新订阅 price（无 proration）', {
        stripeSubscriptionId,
        newPriceId,
        logContext,
        current_period_start: updated.current_period_start,
        current_period_end: updated.current_period_end,
      });
    } catch (error) {
      console.error('[Stripe订阅] 更新订阅 price 失败', {
        stripeSubscriptionId,
        newPriceId,
        logContext,
        error: error.message,
      });
      // 不抛出错误，保持静默失败，只记日志
    }
  }

  /**
   * 同步本地 Champion 订阅的 end_date 到 Stripe Subscription 的 billing_cycle_anchor
   * 场景：用户手动购买（一次性支付）成功后，本地 end_date 被延长，
   *       需要把 Stripe 下次自动扣款日期一起往后推，避免 1 月 6 日扣一次、2 月 6 日又扣一次。
   * 
   * @param {Object} params
   * @param {string} params.stripeSubscriptionId  订阅 ID (sub_xxx)
   * @param {Date}   params.newEndDate           本地计算好的新的会员到期时间
   * @param {string} [params.logContext]         日志上下文，方便排错
   */
  async syncBillingCycleAnchorWithLocalEndDate({ stripeSubscriptionId, newEndDate, logContext = '' }) {
    try {
      if (!stripeSubscriptionId || !newEndDate) {
        console.warn('[Stripe订阅] syncBillingCycleAnchorWithLocalEndDate 缺少参数', { stripeSubscriptionId, newEndDate, logContext });
        return;
      }

      const now = Date.now();
      const newEndTimeMs = newEndDate.getTime();

      // 只在新的 end_date 在当前时间之后时才更新，避免设置成过去日期
      if (newEndTimeMs <= now) {
        console.warn('[Stripe订阅] 新的 end_date 不在未来，跳过更新 billing_cycle_anchor', {
          stripeSubscriptionId,
          newEndDate: newEndDate.toISOString(),
          logContext,
        });
        return;
      }

      const billingCycleAnchor = Math.floor(newEndTimeMs / 1000);

      console.log('[Stripe订阅] 准备更新 billing_cycle_anchor', {
        stripeSubscriptionId,
        billingCycleAnchor,
        anchorIso: newEndDate.toISOString(),
        logContext,
      });

      // 关键点：使用 proration_behavior: 'none'，避免生成额外账单或补差价
      const updated = await this.stripe.subscriptions.update(stripeSubscriptionId, {
        billing_cycle_anchor: billingCycleAnchor,
        proration_behavior: 'none',
      });

      console.log('[Stripe订阅] 已更新 billing_cycle_anchor 成功', {
        stripeSubscriptionId,
        current_period_start: updated.current_period_start,
        current_period_end: updated.current_period_end,
        logContext,
      });
    } catch (error) {
      console.error('[Stripe订阅] 更新 billing_cycle_anchor 失败', {
        stripeSubscriptionId,
        newEndDate: newEndDate.toISOString(),
        logContext,
        error: error.message,
      });
      // 不要抛出错误影响用户支付结果，保持静默失败，只记日志
    }
  }

  /**
   * 同步本地 Champion 订阅状态到 Stripe Subscription
   * 策略 B：所有 promotion/折扣只作用于手动支付，Stripe Subscription 自动续费始终按 base price 扣款
   * 
   * 功能：
   * 1. 将 Stripe Subscription 的 price 更新为当前 tier 的 base price 对应的 priceId
   * 2. 将 billing_cycle_anchor 对齐到本地 end_date（加一天作为 anchor）
   * 
   * @param {number} userId 用户ID
   * @param {number} novelId 小说ID
   */
  async syncChampionStripeSubscriptionWithLocalState(userId, novelId) {
    try {
      console.log(`[Stripe订阅同步] 开始同步 - 用户: ${userId}, 小说: ${novelId}`);

      // 1. 查询本地订阅记录
      const [subscriptionRows] = await this.db.execute(
        'SELECT id, tier_level, tier_name, monthly_price, end_date, stripe_subscription_id, stripe_customer_id, payment_method, auto_renew FROM user_champion_subscription WHERE user_id = ? AND novel_id = ? AND is_active = 1 LIMIT 1',
        [userId, novelId]
      );

      if (subscriptionRows.length === 0) {
        console.log(`[Stripe订阅同步] 未找到本地订阅记录，跳过同步 - 用户: ${userId}, 小说: ${novelId}`);
        return;
      }

      const localSubscription = subscriptionRows[0];
      const stripeSubscriptionId = localSubscription.stripe_subscription_id;
      const paymentMethod = localSubscription.payment_method;
      const autoRenew = Number(localSubscription.auto_renew) || 0;

      // 2. 检查是否需要同步
      // 如果没有 Stripe Subscription ID，或者 payment_method 不是 'stripe' 且没有绑定 Stripe Subscription，跳过
      if (!stripeSubscriptionId) {
        console.log(`[Stripe订阅同步] 本地订阅未绑定 Stripe Subscription，跳过同步 - 用户: ${userId}, 小说: ${novelId}`);
        return;
      }

      // 如果未开启自动续费，也跳过同步（因为不会自动扣款）
      if (autoRenew !== 1) {
        console.log(`[Stripe订阅同步] 订阅未开启自动续费，跳过同步 - 用户: ${userId}, 小说: ${novelId}, auto_renew: ${autoRenew}`);
        return;
      }

      const tierLevel = localSubscription.tier_level;
      const monthlyPrice = parseFloat(localSubscription.monthly_price) || 0;
      const endDate = new Date(localSubscription.end_date);

      console.log(`[Stripe订阅同步] 找到本地订阅 - tier_level: ${tierLevel}, monthly_price: $${monthlyPrice}, end_date: ${endDate.toISOString()}, stripe_subscription_id: ${stripeSubscriptionId}`);

      // 3. 获取当前 tier 对应的 Stripe Price ID
      const ChampionService = require('./championService');
      const championService = new ChampionService();
      
      const priceInfo = await championService.getOrCreateStripePriceForChampionTier({
        novelId: parseInt(novelId),
        tierLevel: parseInt(tierLevel),
        stripeService: this
      });

      const targetPriceId = priceInfo.priceId;
      console.log(`[Stripe订阅同步] 目标 Price ID: ${targetPriceId} (tier_level: ${tierLevel})`);

      // 4. 读取 Stripe Subscription
      const subscription = await this.stripe.subscriptions.retrieve(stripeSubscriptionId, {
        expand: ['items']
      });

      if (!subscription.items || !subscription.items.data || subscription.items.data.length === 0) {
        console.warn(`[Stripe订阅同步] Stripe Subscription 没有 items，无法更新 - Subscription ID: ${stripeSubscriptionId}`);
        return;
      }

      const subscriptionItemId = subscription.items.data[0].id;
      const currentPriceId = subscription.items.data[0].price.id;

      console.log(`[Stripe订阅同步] 当前 Stripe Subscription - item_id: ${subscriptionItemId}, current_price_id: ${currentPriceId}`);

      // 5. 计算 billing_cycle_anchor
      // 由本地 end_date 计算，加一天作为 anchor（确保扣款日在 end_date 之后）
      const anchorDate = new Date(endDate);
      anchorDate.setDate(anchorDate.getDate() + 1); // 加一天
      const anchorTimestamp = Math.floor(anchorDate.getTime() / 1000);

      console.log(`[Stripe订阅同步] 计算 billing_cycle_anchor - end_date: ${endDate.toISOString()}, anchor_date: ${anchorDate.toISOString()}, anchor_timestamp: ${anchorTimestamp}`);

      // 6. 检查是否需要更新 price
      const needUpdatePrice = currentPriceId !== targetPriceId;
      
      // 7. 关于 billing_cycle_anchor 的说明
      // Stripe API 限制：更新现有订阅时，billing_cycle_anchor 只能是 'now' 或 'unchanged'
      // 要改变 billing_cycle_anchor，需要取消当前订阅并创建新订阅
      // 但这样做可能会影响用户体验，所以我们暂时只更新 price
      // 注意：这意味着 Stripe 的下次扣款日期可能不会与本地 end_date 对齐
      // 但本地 end_date 仍然是唯一真相，Stripe 的扣款日期仅供参考
      
      if (needUpdatePrice) {
        // 8. 只更新 price（不更新 billing_cycle_anchor）
        const updateParams = {
          items: [{
            id: subscriptionItemId,
            price: targetPriceId,
          }],
          proration_behavior: 'none', // 防止中途补差价/退款
          cancel_at_period_end: false, // 保证继续自动扣
        };

        console.log(`[Stripe订阅同步] 准备更新 Stripe Subscription Price`, {
          stripeSubscriptionId,
          targetPriceId,
          currentPriceId,
          desiredAnchorDate: anchorDate.toISOString(),
          userId,
          novelId,
          note: 'Stripe API 限制：无法在更新时直接设置 billing_cycle_anchor。本地 end_date 是唯一真相，Stripe 扣款日期仅供参考。'
        });

        const updated = await this.stripe.subscriptions.update(stripeSubscriptionId, updateParams);
        console.log(`[Stripe订阅同步] Price 已更新 - 从 ${currentPriceId} 更新到 ${targetPriceId}`);
      } else {
        console.log(`[Stripe订阅同步] Price 无需更新 - 当前 price 已经是目标 price`);
        console.log(`[Stripe订阅同步] 注意：billing_cycle_anchor 无法更新（Stripe API 限制），本地 end_date: ${endDate.toISOString()} 是唯一真相`);
      }

      // 9. 记录更新结果（使用之前获取的 subscription 对象）
      const currentPeriodEnd = new Date(subscription.current_period_end * 1000);
      const desiredPeriodEnd = anchorDate;
      
      console.log(`[Stripe订阅同步] 同步完成`, {
        stripeSubscriptionId,
        newPriceId: targetPriceId,
        currentBillingCycleAnchor: subscription.billing_cycle_anchor ? new Date(subscription.billing_cycle_anchor * 1000).toISOString() : 'N/A',
        currentPeriodStart: new Date(subscription.current_period_start * 1000).toISOString(),
        currentPeriodEnd: currentPeriodEnd.toISOString(),
        desiredPeriodEnd: desiredPeriodEnd.toISOString(),
        localEndDate: endDate.toISOString(),
        userId,
        novelId,
        note: '注意：由于 Stripe API 限制，无法更新 billing_cycle_anchor。本地 end_date 是唯一真相，Stripe 的 current_period_end 仅供参考。'
      });
      
      // 10. 如果 desiredPeriodEnd 与 currentPeriodEnd 差异较大（超过 1 天），记录警告
      const daysDiff = Math.abs((desiredPeriodEnd.getTime() - currentPeriodEnd.getTime()) / (1000 * 60 * 60 * 24));
      if (daysDiff > 1) {
        console.warn(`[Stripe订阅同步] ⚠️ Stripe 扣款日期与本地 end_date 差异较大`, {
          stripeSubscriptionId,
          currentPeriodEnd: currentPeriodEnd.toISOString(),
          desiredPeriodEnd: desiredPeriodEnd.toISOString(),
          localEndDate: endDate.toISOString(),
          daysDiff: daysDiff.toFixed(1),
          note: '由于 Stripe API 限制，无法同步 billing_cycle_anchor。本地 end_date 是唯一真相。'
        });
      }

    } catch (error) {
      console.error(`[Stripe订阅同步] 同步失败（不影响主流程）`, {
        userId,
        novelId,
        error: error.message,
        errorStack: error.stack
      });
      // 不抛出错误，只记录日志，避免影响主流程
    }
  }

  /**
   * 处理 Stripe Subscription 删除事件
   * 当 Stripe Subscription 被删除时，更新本地订阅状态
   * 
   * @param {Object} subscription Stripe Subscription 对象
   */
  async handleSubscriptionDeleted(subscription) {
    try {
      console.log(`[Stripe订阅删除] 收到 customer.subscription.deleted 事件 - Subscription ID: ${subscription.id}`);

      const subscriptionId = subscription.id;

      // 1. 查找本地订阅记录
      const [subscriptionRecords] = await this.db.execute(
        'SELECT id, user_id, novel_id, auto_renew FROM user_champion_subscription WHERE stripe_subscription_id = ? AND is_active = 1',
        [subscriptionId]
      );

      if (subscriptionRecords.length === 0) {
        console.log(`[Stripe订阅删除] 未找到本地订阅记录 - Subscription ID: ${subscriptionId}`);
        return;
      }

      const localSubscription = subscriptionRecords[0];
      const userId = localSubscription.user_id;
      const novelId = localSubscription.novel_id;

      console.log(`[Stripe订阅删除] 找到本地订阅记录 - 用户: ${userId}, 小说: ${novelId}`);

      // 2. 更新本地订阅状态
      // 注意：不删除订阅记录，只是关闭自动续费，保留订阅直到 end_date
      await this.db.execute(
        'UPDATE user_champion_subscription SET auto_renew = 0, stripe_subscription_id = NULL, updated_at = NOW() WHERE id = ?',
        [localSubscription.id]
      );

      console.log(`[Stripe订阅删除] 已更新本地订阅状态 - 关闭自动续费，保留订阅直到 end_date - 用户: ${userId}, 小说: ${novelId}`);

    } catch (error) {
      console.error('[Stripe订阅删除] 处理失败:', error);
      // 不抛异常，避免影响 Webhook 返回，但记录错误日志
    }
  }
}

module.exports = StripeService;