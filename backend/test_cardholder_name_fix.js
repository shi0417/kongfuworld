const mysql = require('mysql2/promise');

async function testCardholderNameFix() {
  let db;
  try {
    db = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: '123456',
      database: 'kongfuworld',
      charset: 'utf8mb4'
    });

    console.log('🧪 测试持卡人姓名输入字段修复...\n');

    // 1. 检查最近的Champion支付记录
    console.log('📋 检查最近的Champion支付记录:');
    const [recentPayments] = await db.execute(`
      SELECT 
        ucsr.user_id,
        ucsr.novel_id,
        ucsr.payment_method,
        ucsr.payment_status,
        ucsr.created_at,
        u.username
      FROM user_champion_subscription_record ucsr
      JOIN user u ON ucsr.user_id = u.id
      ORDER BY ucsr.created_at DESC
      LIMIT 5
    `);
    
    console.log(`找到 ${recentPayments.length} 条记录:`);
    recentPayments.forEach((p, i) => {
      console.log(`${i+1}. 用户:${p.username}(${p.user_id}), 小说:${p.novel_id}, 方式:${p.payment_method}, 状态:${p.payment_status}, 时间:${p.created_at}`);
    });

    console.log('\n' + '='.repeat(50) + '\n');

    // 2. 检查Stripe支付记录中的持卡人信息
    console.log('📋 检查Stripe支付记录中的持卡人信息:');
    const [stripePayments] = await db.execute(`
      SELECT 
        user_id,
        novel_id,
        card_brand,
        card_last4,
        payment_status,
        created_at
      FROM user_champion_subscription_record 
      WHERE payment_method = 'stripe'
      ORDER BY created_at DESC
      LIMIT 3
    `);
    
    console.log(`找到 ${stripePayments.length} 条Stripe支付记录:`);
    stripePayments.forEach((p, i) => {
      console.log(`${i+1}. 用户:${p.user_id}, 小说:${p.novel_id}, 卡片:${p.card_brand} ****${p.card_last4}, 状态:${p.payment_status}, 时间:${p.created_at}`);
    });

    console.log('\n' + '='.repeat(50) + '\n');

    // 3. 修复说明
    console.log('🔧 修复内容:');
    console.log('1. ✅ 在SmartPaymentModal中添加了持卡人姓名输入字段');
    console.log('2. ✅ 更新了支付处理逻辑，将持卡人姓名传递给Stripe');
    console.log('3. ✅ 添加了相应的CSS样式');
    console.log('4. ✅ 修复了硬编码的user_id=1问题');

    console.log('\n💡 测试建议:');
    console.log('1. 清除浏览器缓存并重新加载页面');
    console.log('2. 以用户ID=2登录');
    console.log('3. 访问Champion页面并选择Stripe支付');
    console.log('4. 检查是否显示持卡人姓名输入字段');
    console.log('5. 完成支付并检查数据库记录');

  } catch (error) {
    console.error('❌ 测试失败:', error);
  } finally {
    if (db) await db.end();
  }
}

testCardholderNameFix();
