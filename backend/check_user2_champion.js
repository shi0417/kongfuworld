const mysql = require('mysql2/promise');

async function checkUser2Champion() {
  let db;
  try {
    db = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: '123456',
      database: 'kongfuworld',
      charset: 'utf8mb4'
    });

    console.log('🔍 检查用户ID=2的所有Champion订阅...\n');

    const [user2Subs] = await db.execute(`
      SELECT novel_id, tier_level, tier_name, is_active, end_date, created_at
      FROM user_champion_subscription 
      WHERE user_id = 2
    `);
    
    console.log('用户ID=2的Champion订阅数:', user2Subs.length);
    user2Subs.forEach((s, i) => {
      console.log(`${i+1}. 小说:${s.novel_id}, 等级:${s.tier_level} (${s.tier_name}), 激活:${s.is_active}, 到期:${s.end_date}`);
    });

    console.log('\n' + '='.repeat(50) + '\n');

    // 检查用户ID=2是否有novel_id=10的订阅
    const [novel10Sub] = await db.execute(`
      SELECT * FROM user_champion_subscription 
      WHERE user_id = 2 AND novel_id = 10
    `);
    
    if (novel10Sub.length > 0) {
      console.log('✅ 用户ID=2有novel_id=10的Champion订阅:');
      novel10Sub.forEach((s, i) => {
        console.log(`  等级: ${s.tier_level} (${s.tier_name}), 激活: ${s.is_active}, 到期: ${s.end_date}`);
      });
    } else {
      console.log('❌ 用户ID=2没有novel_id=10的Champion订阅');
    }

    console.log('\n' + '='.repeat(50) + '\n');

    // 检查用户ID=2的Champion记录
    const [user2Records] = await db.execute(`
      SELECT novel_id, tier_level, payment_status, created_at
      FROM user_champion_subscription_record 
      WHERE user_id = 2
      ORDER BY created_at DESC
    `);
    
    console.log('用户ID=2的Champion记录数:', user2Records.length);
    user2Records.forEach((r, i) => {
      console.log(`${i+1}. 小说:${r.novel_id}, 等级:${r.tier_level}, 状态:${r.payment_status}, 时间:${r.created_at}`);
    });

  } catch (error) {
    console.error('❌ 检查失败:', error);
  } finally {
    if (db) await db.end();
  }
}

checkUser2Champion();
