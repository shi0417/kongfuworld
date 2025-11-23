const mysql = require('mysql2/promise');

// 数据库配置
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '123456',
  database: process.env.DB_NAME || 'kongfuworld',
  charset: 'utf8mb4'
};

async function updateExistingPayoutData() {
  let connection;
  try {
    console.log('🔄 开始更新现有支付单数据...\n');
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ 数据库连接成功\n');
    
    // 1. 更新 user_payout 表的 month 和 income_monthly_id
    console.log('1️⃣ 更新 user_payout 表的 month 和 income_monthly_id...');
    
    // 查找没有 month 的支付单
    const [payoutsWithoutMonth] = await connection.query(`
      SELECT up.id, up.user_id, up.amount_usd, up.created_at
      FROM user_payout up
      WHERE up.month IS NULL
    `);
    
    console.log(`   找到 ${payoutsWithoutMonth.length} 条需要更新的支付单`);
    
    let updatedCount = 0;
    for (const payout of payoutsWithoutMonth) {
      // 尝试从 user_payout_item 找到对应的月份
      const [items] = await connection.query(`
        SELECT month, SUM(amount_usd) as total_amount
        FROM user_payout_item
        WHERE payout_id = ?
        GROUP BY month
        ORDER BY month DESC
        LIMIT 1
      `, [payout.id]);
      
      if (items.length > 0) {
        const item = items[0];
        // 查找对应的 user_income_monthly 记录
        const [incomeMonthly] = await connection.query(`
          SELECT id FROM user_income_monthly
          WHERE user_id = ? AND month = ?
          LIMIT 1
        `, [payout.user_id, item.month]);
        
        if (incomeMonthly.length > 0) {
          await connection.query(`
            UPDATE user_payout
            SET month = ?, income_monthly_id = ?
            WHERE id = ?
          `, [item.month, incomeMonthly[0].id, payout.id]);
          
          updatedCount++;
          console.log(`   ✅ 更新支付单 #${payout.id}: month=${item.month}, income_monthly_id=${incomeMonthly[0].id}`);
        } else {
          console.log(`   ⚠️  支付单 #${payout.id}: 找不到对应的 user_income_monthly 记录 (user_id=${payout.user_id}, month=${item.month})`);
        }
      } else {
        // 如果没有 user_payout_item，尝试从 created_at 推断月份
        const createdAt = new Date(payout.created_at);
        const month = `${createdAt.getFullYear()}-${String(createdAt.getMonth() + 1).padStart(2, '0')}-01`;
        
        // 查找对应的 user_income_monthly 记录
        const [incomeMonthly] = await connection.query(`
          SELECT id FROM user_income_monthly
          WHERE user_id = ? AND month = ?
          LIMIT 1
        `, [payout.user_id, month]);
        
        if (incomeMonthly.length > 0) {
          await connection.query(`
            UPDATE user_payout
            SET month = ?, income_monthly_id = ?
            WHERE id = ?
          `, [month, incomeMonthly[0].id, payout.id]);
          
          updatedCount++;
          console.log(`   ✅ 更新支付单 #${payout.id}: month=${month} (从created_at推断), income_monthly_id=${incomeMonthly[0].id}`);
        } else {
          console.log(`   ⚠️  支付单 #${payout.id}: 无法推断月份，需要手动处理`);
        }
      }
    }
    
    console.log(`\n   共更新 ${updatedCount} 条支付单\n`);
    
    // 2. 更新 user_income_monthly 的 payout_status 和 payout_id
    console.log('2️⃣ 更新 user_income_monthly 的 payout_status 和 payout_id...');
    
    const [updateResult] = await connection.query(`
      UPDATE user_income_monthly uim
      INNER JOIN user_payout up ON uim.user_id = up.user_id 
        AND uim.month = up.month
      SET uim.payout_status = CASE WHEN up.status = 'paid' THEN 'paid' ELSE 'unpaid' END,
          uim.payout_id = up.id
      WHERE up.status IN ('paid', 'processing', 'pending')
    `);
    
    console.log(`   ✅ 更新了 ${updateResult.affectedRows} 条 user_income_monthly 记录\n`);
    
    // 3. 验证更新结果
    console.log('3️⃣ 验证更新结果...');
    
    const [payoutsWithMonth] = await connection.query(`
      SELECT COUNT(*) as cnt FROM user_payout WHERE month IS NOT NULL
    `);
    console.log(`   ✅ 有 month 字段的支付单: ${payoutsWithMonth[0].cnt}`);
    
    const [payoutsWithIncomeId] = await connection.query(`
      SELECT COUNT(*) as cnt FROM user_payout WHERE income_monthly_id IS NOT NULL
    `);
    console.log(`   ✅ 有 income_monthly_id 字段的支付单: ${payoutsWithIncomeId[0].cnt}`);
    
    const [incomeWithPayoutId] = await connection.query(`
      SELECT COUNT(*) as cnt FROM user_income_monthly WHERE payout_id IS NOT NULL
    `);
    console.log(`   ✅ 有 payout_id 的月度收入记录: ${incomeWithPayoutId[0].cnt}`);
    
    console.log('\n✅ 数据更新完成！');
    
  } catch (error) {
    console.error('❌ 更新失败:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n数据库连接已关闭');
    }
  }
}

// 执行更新
updateExistingPayoutData().catch(error => {
  console.error('❌ 执行更新时发生错误:', error);
  process.exit(1);
});

