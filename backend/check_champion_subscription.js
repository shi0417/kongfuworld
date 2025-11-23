const mysql = require('mysql2/promise');

async function checkChampionSubscription() {
  let db;
  try {
    db = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: '123456',
      database: 'kongfuworld',
      charset: 'utf8mb4'
    });

    console.log('🔍 检查用户ID=2，小说ID=10的Champion订阅状态...\n');

    // 1. 检查 user_champion_subscription_record 表
    console.log('📋 user_champion_subscription_record 表数据:');
    const [records] = await db.execute(`
      SELECT id, user_id, novel_id, tier_level, tier_name, payment_status, 
             start_date, end_date, created_at
      FROM user_champion_subscription_record 
      WHERE user_id = 2 AND novel_id = 10 
      ORDER BY created_at DESC 
      LIMIT 5
    `);
    
    if (records.length > 0) {
      console.log(`找到 ${records.length} 条记录:`);
      records.forEach((record, index) => {
        console.log(`  ${index + 1}. ID: ${record.id}, 等级: ${record.tier_level} (${record.tier_name}), 状态: ${record.payment_status}, 创建时间: ${record.created_at}`);
      });
    } else {
      console.log('❌ 未找到任何记录');
    }

    console.log('\n' + '='.repeat(50) + '\n');

    // 2. 检查 user_champion_subscription 表
    console.log('📋 user_champion_subscription 表数据:');
    const [subscriptions] = await db.execute(`
      SELECT id, user_id, novel_id, tier_level, tier_name, monthly_price,
             start_date, end_date, is_active, created_at
      FROM user_champion_subscription 
      WHERE user_id = 2 AND novel_id = 10
    `);
    
    if (subscriptions.length > 0) {
      console.log(`找到 ${subscriptions.length} 条记录:`);
      subscriptions.forEach((sub, index) => {
        console.log(`  ${index + 1}. ID: ${sub.id}, 等级: ${sub.tier_level} (${sub.tier_name}), 价格: $${sub.monthly_price}, 激活: ${sub.is_active}, 到期: ${sub.end_date}`);
      });
    } else {
      console.log('❌ 未找到任何记录');
    }

    console.log('\n' + '='.repeat(50) + '\n');

    // 3. 检查 payment_record 表
    console.log('📋 payment_record 表数据 (最近5条):');
    const [payments] = await db.execute(`
      SELECT id, user_id, amount, type, status, description, created_at
      FROM payment_record 
      WHERE user_id = 2 
      ORDER BY created_at DESC 
      LIMIT 5
    `);
    
    if (payments.length > 0) {
      console.log(`找到 ${payments.length} 条记录:`);
      payments.forEach((payment, index) => {
        console.log(`  ${index + 1}. ID: ${payment.id}, 金额: $${payment.amount}, 类型: ${payment.type}, 状态: ${payment.status}, 描述: ${payment.description?.substring(0, 50)}...`);
      });
    } else {
      console.log('❌ 未找到任何记录');
    }

    console.log('\n' + '='.repeat(50) + '\n');

    // 4. 分析问题
    console.log('🔍 问题分析:');
    if (records.length > 0 && subscriptions.length === 0) {
      console.log('❌ 问题确认: user_champion_subscription_record 有数据，但 user_champion_subscription 表没有数据');
      console.log('   这表明支付成功回调处理有问题，只创建了详细记录，但没有创建订阅记录');
      
      // 检查最新的记录
      const latestRecord = records[0];
      console.log(`\n📊 最新记录详情:`);
      console.log(`   - 支付状态: ${latestRecord.payment_status}`);
      console.log(`   - 等级: ${latestRecord.tier_level} (${latestRecord.tier_name})`);
      console.log(`   - 开始时间: ${latestRecord.start_date}`);
      console.log(`   - 结束时间: ${latestRecord.end_date}`);
      
      if (latestRecord.payment_status === 'completed') {
        console.log('\n💡 建议修复方案:');
        console.log('   1. 检查 unifiedPaymentService.handlePaymentSuccess 方法');
        console.log('   2. 确认 user_champion_subscription 表的插入操作是否成功');
        console.log('   3. 检查数据库事务是否回滚');
      }
    } else if (records.length === 0) {
      console.log('❌ 问题: 连 user_champion_subscription_record 都没有数据');
      console.log('   这表明支付回调根本没有被调用');
    } else {
      console.log('✅ 数据正常: 两个表都有数据');
    }

  } catch (error) {
    console.error('❌ 检查失败:', error);
  } finally {
    if (db) await db.end();
  }
}

checkChampionSubscription();
