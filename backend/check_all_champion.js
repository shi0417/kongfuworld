const mysql = require('mysql2/promise');

async function checkAllChampion() {
  let db;
  try {
    db = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: '123456',
      database: 'kongfuworld',
      charset: 'utf8mb4'
    });

    console.log('🔍 检查所有Champion订阅记录...\n');

    // 检查 user_champion_subscription_record 表
    const [records] = await db.execute(`
      SELECT user_id, novel_id, tier_level, tier_name, payment_status, created_at
      FROM user_champion_subscription_record 
      ORDER BY created_at DESC 
      LIMIT 10
    `);
    
    console.log('📋 user_champion_subscription_record 表记录数:', records.length);
    records.forEach((r, i) => {
      console.log(`${i+1}. 用户:${r.user_id}, 小说:${r.novel_id}, 等级:${r.tier_level}, 状态:${r.payment_status}, 时间:${r.created_at}`);
    });

    console.log('\n' + '='.repeat(50) + '\n');

    // 检查 user_champion_subscription 表
    const [subs] = await db.execute(`
      SELECT user_id, novel_id, tier_level, tier_name, is_active, created_at
      FROM user_champion_subscription 
      ORDER BY created_at DESC 
      LIMIT 10
    `);
    
    console.log('📋 user_champion_subscription 表记录数:', subs.length);
    subs.forEach((s, i) => {
      console.log(`${i+1}. 用户:${s.user_id}, 小说:${s.novel_id}, 等级:${s.tier_level}, 激活:${s.is_active}, 时间:${s.created_at}`);
    });

    console.log('\n' + '='.repeat(50) + '\n');

    // 检查是否有用户2的数据
    const [user2Records] = await db.execute(`
      SELECT user_id, novel_id, tier_level, payment_status, created_at
      FROM user_champion_subscription_record 
      WHERE user_id = 2
      ORDER BY created_at DESC
    `);
    
    console.log('📋 用户ID=2的Champion记录数:', user2Records.length);
    user2Records.forEach((r, i) => {
      console.log(`${i+1}. 小说:${r.novel_id}, 等级:${r.tier_level}, 状态:${r.payment_status}, 时间:${r.created_at}`);
    });

  } catch (error) {
    console.error('❌ 检查失败:', error);
  } finally {
    if (db) await db.end();
  }
}

checkAllChampion();
