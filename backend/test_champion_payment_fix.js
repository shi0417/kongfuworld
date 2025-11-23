const mysql = require('mysql2/promise');

async function testChampionPaymentFix() {
  let db;
  try {
    db = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: '123456',
      database: 'kongfuworld',
      charset: 'utf8mb4'
    });

    console.log('🧪 测试Champion支付修复...\n');

    // 1. 检查用户ID=2的Champion订阅记录
    console.log('📋 检查用户ID=2的Champion订阅记录:');
    const [user2Records] = await db.execute(`
      SELECT user_id, novel_id, tier_level, payment_status, created_at
      FROM user_champion_subscription_record 
      WHERE user_id = 2
      ORDER BY created_at DESC
      LIMIT 5
    `);
    
    console.log(`找到 ${user2Records.length} 条记录:`);
    user2Records.forEach((r, i) => {
      console.log(`${i+1}. 用户:${r.user_id}, 小说:${r.novel_id}, 等级:${r.tier_level}, 状态:${r.payment_status}, 时间:${r.created_at}`);
    });

    console.log('\n' + '='.repeat(50) + '\n');

    // 2. 检查用户ID=2的Champion订阅
    console.log('📋 检查用户ID=2的Champion订阅:');
    const [user2Subs] = await db.execute(`
      SELECT user_id, novel_id, tier_level, is_active, created_at
      FROM user_champion_subscription 
      WHERE user_id = 2
      ORDER BY created_at DESC
    `);
    
    console.log(`找到 ${user2Subs.length} 条记录:`);
    user2Subs.forEach((s, i) => {
      console.log(`${i+1}. 用户:${s.user_id}, 小说:${s.novel_id}, 等级:${s.tier_level}, 激活:${s.is_active}, 时间:${s.created_at}`);
    });

    console.log('\n' + '='.repeat(50) + '\n');

    // 3. 检查是否有硬编码的user_id=1的记录
    console.log('📋 检查是否有硬编码的user_id=1的记录:');
    const [hardcodedRecords] = await db.execute(`
      SELECT user_id, novel_id, tier_level, payment_status, created_at
      FROM user_champion_subscription_record 
      WHERE user_id = 1 AND novel_id = 10
      ORDER BY created_at DESC
      LIMIT 3
    `);
    
    console.log(`找到 ${hardcodedRecords.length} 条user_id=1, novel_id=10的记录:`);
    hardcodedRecords.forEach((r, i) => {
      console.log(`${i+1}. 用户:${r.user_id}, 小说:${r.novel_id}, 等级:${r.tier_level}, 状态:${r.payment_status}, 时间:${r.created_at}`);
    });

    console.log('\n' + '='.repeat(50) + '\n');

    // 4. 分析问题
    console.log('🔍 问题分析:');
    if (user2Records.length === 0 && hardcodedRecords.length > 0) {
      console.log('❌ 确认问题: 用户ID=2没有记录，但用户ID=1有记录');
      console.log('   这表明前端确实有硬编码的user_id=1');
      console.log('   修复后，新的支付应该使用正确的用户ID');
    } else if (user2Records.length > 0) {
      console.log('✅ 修复成功: 用户ID=2有记录，说明硬编码问题已解决');
    } else {
      console.log('ℹ️  用户ID=2和用户ID=1都没有novel_id=10的记录');
    }

    console.log('\n💡 修复建议:');
    console.log('1. 确保前端ChampionDisplay组件使用user?.id而不是硬编码的1');
    console.log('2. 确保SmartPaymentModal组件使用user?.id而不是硬编码的1');
    console.log('3. 测试新的Champion订阅流程');

  } catch (error) {
    console.error('❌ 测试失败:', error);
  } finally {
    if (db) await db.end();
  }
}

testChampionPaymentFix();
