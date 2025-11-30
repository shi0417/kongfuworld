/**
 * 验证 INSERT 语句的列数和参数数量是否匹配
 */

// 列名列表（从 SQL 中提取）
const columns = [
  'user_id',
  'novel_id',
  'payment_record_id',
  'tier_level',
  'tier_name',
  'monthly_price',
  'payment_amount',
  'payment_method',
  'payment_status',
  'subscription_type',
  'subscription_duration_days',
  'before_membership_snapshot',
  'after_membership_snapshot',
  'start_date',
  'end_date',
  'is_active',
  'auto_renew',
  'transaction_id',
  'stripe_payment_intent_id',
  'paypal_order_id',
  'stripe_customer_id',
  'paypal_payer_id',
  'card_brand',
  'card_last4',
  'card_exp_month',
  'card_exp_year',
  'currency',
  'exchange_rate',
  'local_amount',
  'local_currency',
  'discount_amount',
  'discount_code',
  'tax_amount',
  'fee_amount',
  'refund_amount',
  'refund_reason',
  'refund_date',
  'notes',
  'ip_address',
  'user_agent'
];

// 参数列表（从代码中提取）
const params = [
  'userId',                                    // user_id
  'novelId',                                   // novel_id
  'paymentRecordId',                           // payment_record_id
  'tierLevel',                                 // tier_level
  'tierName',                                  // tier_name
  'monthlyPrice',                              // monthly_price
  'paymentAmount',                             // payment_amount
  'paymentMethod',                             // payment_method
  'paymentStatus',                             // payment_status
  'subscriptionType',                          // subscription_type
  'subscriptionDurationDays',                  // subscription_duration_days
  'beforeMembershipSnapshot',                  // before_membership_snapshot
  'afterMembershipSnapshot',                   // after_membership_snapshot
  'startDate',                                 // start_date
  'endDate',                                   // end_date
  '1',                                         // is_active
  '0',                                         // auto_renew
  'transactionId',                             // transaction_id
  'stripePaymentIntentId',                     // stripe_payment_intent_id
  'paypalOrderId',                             // paypal_order_id
  'stripeCustomerId',                          // stripe_customer_id
  'paypalPayerId',                             // paypal_payer_id
  'cardBrand',                                 // card_brand
  'cardLast4',                                 // card_last4
  'cardExpMonth',                              // card_exp_month
  'cardExpYear',                               // card_exp_year
  "'USD'",                                     // currency
  'null',                                      // exchange_rate
  'null',                                      // local_amount
  'null',                                      // local_currency
  '0.00',                                      // discount_amount
  'null',                                      // discount_code
  '0.00',                                      // tax_amount
  '0.00',                                      // fee_amount
  '0.00',                                      // refund_amount
  'null',                                      // refund_reason
  'null',                                      // refund_date
  'null',                                      // notes
  'null',                                      // ip_address
  'null'                                       // user_agent
];

console.log('列数:', columns.length);
console.log('参数数:', params.length);
console.log('占位符数:', 40); // VALUES 中的 ? 数量

if (columns.length === params.length && params.length === 40) {
  console.log('✅ 匹配成功！');
} else {
  console.log('❌ 不匹配！');
  console.log('差异:', {
    columns: columns.length,
    params: params.length,
    placeholders: 40
  });
}

// 列出所有列名和对应的参数
console.log('\n列名和参数对应关系:');
columns.forEach((col, index) => {
  console.log(`${index + 1}. ${col} -> ${params[index]}`);
});

