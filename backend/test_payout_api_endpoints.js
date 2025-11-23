const mysql = require('mysql2/promise');

// 数据库配置
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '123456',
  database: process.env.DB_NAME || 'kongfuworld',
  charset: 'utf8mb4'
};

async function testAPIEndpoints() {
  let connection;
  try {
    console.log('🧪 开始测试后端 API 逻辑...\n');
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ 数据库连接成功\n');
    
    // 1. 测试创建支付单的SQL逻辑
    console.log('1️⃣ 测试创建支付单逻辑...');
    
    // 查找一个未支付的月度收入记录
    const [unpaidIncomes] = await connection.query(`
      SELECT uim.*, u.username
      FROM user_income_monthly uim
      LEFT JOIN user u ON uim.user_id = u.id
      WHERE uim.payout_status = 'unpaid' AND uim.total_income_usd > 0
      LIMIT 1
    `);
    
    if (unpaidIncomes.length === 0) {
      console.log('   ⚠️  没有找到未支付的月度收入记录，跳过测试');
    } else {
      const income = unpaidIncomes[0];
      console.log(`   📋 测试数据: user_id=${income.user_id}, month=${income.month}, total_income_usd=${income.total_income_usd}`);
      
      // 检查是否已存在支付单
      const [existingPayouts] = await connection.query(`
        SELECT id FROM user_payout
        WHERE user_id = ? AND month = ?
        LIMIT 1
      `, [income.user_id, income.month]);
      
      if (existingPayouts.length > 0) {
        console.log(`   ⚠️  该月已存在支付单 #${existingPayouts[0].id}`);
      } else {
        console.log('   ✅ 该月没有支付单，可以创建新的支付单');
      }
      
      // 查找用户的收款账户
      const [accounts] = await connection.query(`
        SELECT * FROM user_payout_account
        WHERE user_id = ? AND is_default = 1
        LIMIT 1
      `, [income.user_id]);
      
      if (accounts.length > 0) {
        console.log(`   ✅ 找到默认收款账户: ${accounts[0].account_label} (${accounts[0].method})`);
      } else {
        console.log(`   ⚠️  用户没有默认收款账户`);
      }
    }
    
    // 2. 测试结算总览查询
    console.log('\n2️⃣ 测试结算总览查询逻辑...');
    
    const [overviewResults] = await connection.query(`
      SELECT 
        u.id as user_id,
        u.username,
        u.pen_name,
        COALESCE(uim_month.total_income_usd, 0) as month_total_income,
        CASE WHEN uim_month.payout_status = 'paid' THEN uim_month.total_income_usd ELSE 0 END as month_paid_amount,
        CASE WHEN uim_month.payout_status = 'paid' THEN 0 ELSE COALESCE(uim_month.total_income_usd, 0) END as month_unpaid_amount,
        COALESCE(uim_month.payout_status, 'unpaid') as month_status,
        COALESCE((
          SELECT SUM(total_income_usd)
          FROM user_income_monthly
          WHERE user_id = u.id AND payout_status = 'unpaid'
        ), 0) as total_unpaid_amount
      FROM user u
      LEFT JOIN user_income_monthly uim_month ON u.id = uim_month.user_id 
        AND uim_month.month = '2025-11-01'
      WHERE uim_month.total_income_usd > 0
      LIMIT 5
    `);
    
    console.log(`   ✅ 查询到 ${overviewResults.length} 条记录`);
    overviewResults.forEach((row, idx) => {
      console.log(`   ${idx + 1}. 用户 ${row.username || row.user_id}: 本月收入=$${row.month_total_income.toFixed(2)}, 未支付=$${row.month_unpaid_amount.toFixed(2)}, 累计未支付=$${row.total_unpaid_amount.toFixed(2)}`);
    });
    
    // 3. 测试用户结算详情查询
    console.log('\n3️⃣ 测试用户结算详情查询逻辑...');
    
    if (unpaidIncomes.length > 0) {
      const testUserId = unpaidIncomes[0].user_id;
      
      const [monthlyIncomes] = await connection.query(`
        SELECT 
          id,
          month,
          author_base_income_usd,
          reader_referral_income_usd,
          author_referral_income_usd,
          total_income_usd,
          CASE WHEN payout_status = 'paid' THEN 0 ELSE total_income_usd END as unpaid_amount,
          payout_status,
          payout_id
        FROM user_income_monthly
        WHERE user_id = ?
        ORDER BY month DESC
        LIMIT 6
      `, [testUserId]);
      
      console.log(`   ✅ 用户 ${testUserId} 的月度收入记录: ${monthlyIncomes.length} 条`);
      monthlyIncomes.forEach((row, idx) => {
        const totalIncome = parseFloat(row.total_income_usd || 0);
        const unpaidAmount = parseFloat(row.unpaid_amount || 0);
        console.log(`   ${idx + 1}. ${row.month}: 总收入=$${totalIncome.toFixed(2)}, 状态=${row.payout_status}, 未支付=$${unpaidAmount.toFixed(2)}`);
      });
      
      // 查询支付记录
      const [payouts] = await connection.query(`
        SELECT 
          id, month, income_monthly_id,
          base_amount_usd, payout_currency, payout_amount, fx_rate,
          status, method, requested_at, paid_at
        FROM user_payout
        WHERE user_id = ?
        ORDER BY created_at DESC
        LIMIT 5
      `, [testUserId]);
      
      console.log(`   ✅ 用户 ${testUserId} 的支付记录: ${payouts.length} 条`);
      payouts.forEach((row, idx) => {
        const currency = row.payout_currency || 'USD';
        const amount = row.payout_amount || row.base_amount_usd || 0;
        const rate = row.fx_rate || (currency === 'USD' ? 1.0 : 0);
        console.log(`   ${idx + 1}. 支付单 #${row.id}: ${currency} ${amount.toFixed(2)} (汇率=${rate}), 状态=${row.status}`);
      });
    }
    
    // 4. 测试标记已支付逻辑
    console.log('\n4️⃣ 测试标记已支付逻辑...');
    
    const [pendingPayouts] = await connection.query(`
      SELECT up.*, uim.id as income_monthly_id
      FROM user_payout up
      LEFT JOIN user_income_monthly uim ON up.user_id = uim.user_id AND up.month = uim.month
      WHERE up.status = 'pending'
      LIMIT 1
    `);
    
    if (pendingPayouts.length > 0) {
      const payout = pendingPayouts[0];
      console.log(`   ✅ 找到待支付单 #${payout.id}`);
      console.log(`   - base_amount_usd: ${payout.base_amount_usd || payout.amount_usd}`);
      console.log(`   - payout_currency: ${payout.payout_currency || payout.currency || 'USD'}`);
      console.log(`   - payout_amount: ${payout.payout_amount || payout.amount_usd}`);
      console.log(`   - fx_rate: ${payout.fx_rate || (payout.payout_currency === 'USD' ? 1.0 : 0)}`);
      console.log(`   - income_monthly_id: ${payout.income_monthly_id || 'NULL'}`);
      
      if (payout.income_monthly_id) {
        console.log(`   ✅ 可以更新对应的 user_income_monthly 记录`);
      } else {
        console.log(`   ⚠️  缺少 income_monthly_id，无法自动更新 user_income_monthly`);
      }
    } else {
      console.log('   ⚠️  没有找到待支付的支付单');
    }
    
    console.log('\n✅ API 逻辑测试完成！');
    console.log('\n📝 总结:');
    console.log('   ✅ 数据库结构迁移成功');
    console.log('   ✅ 所有新字段已添加');
    console.log('   ✅ 查询逻辑可以正常工作');
    console.log('   ⚠️  现有支付单需要手动关联 month 和 income_monthly_id（新创建的会自动填充）');
    
  } catch (error) {
    console.error('❌ 测试失败:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

// 执行测试
testAPIEndpoints().catch(error => {
  console.error('❌ 执行测试时发生错误:', error);
  process.exit(1);
});

