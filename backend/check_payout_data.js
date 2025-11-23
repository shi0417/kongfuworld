const mysql = require('mysql2/promise');
require('dotenv').config();

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '123456',
  database: process.env.DB_NAME || 'kongfuworld',
  charset: 'utf8mb4'
};

async function checkPayoutData() {
  let connection;
  try {
    connection = await mysql.createConnection(dbConfig);
    
    console.log('========== 查询支付相关数据 ==========\n');
    
    // 1. 查询最新的 payout_gateway_transaction
    console.log('1. payout_gateway_transaction 表（最近5条）:');
    const [gatewayTxs] = await connection.execute(
      `SELECT id, provider, provider_tx_id, status, base_amount_usd, payout_currency, payout_amount, fx_rate,
              JSON_EXTRACT(response_payload, '$.batch_id') as batch_id_from_json,
              response_payload,
              created_at, updated_at
       FROM payout_gateway_transaction 
       WHERE provider = 'paypal'
       ORDER BY created_at DESC 
       LIMIT 5`
    );
    
    gatewayTxs.forEach((tx, index) => {
      console.log(`\n记录 ${index + 1}:`);
      console.log(`  ID: ${tx.id}`);
      console.log(`  provider_tx_id: ${tx.provider_tx_id}`);
      console.log(`  status: ${tx.status}`);
      console.log(`  batch_id_from_json: ${tx.batch_id_from_json}`);
      console.log(`  amount: ${tx.payout_amount} ${tx.payout_currency}`);
      console.log(`  created_at: ${tx.created_at}`);
      console.log(`  updated_at: ${tx.updated_at}`);
      
      // 解析 response_payload
      try {
        const payload = typeof tx.response_payload === 'string' 
          ? JSON.parse(tx.response_payload) 
          : tx.response_payload;
        console.log(`  response_payload.batch_id: ${payload?.batch_id || 'N/A'}`);
      } catch (e) {
        console.log(`  response_payload解析失败: ${e.message}`);
      }
    });
    
    // 2. 查询最新的 user_payout
    console.log('\n\n2. user_payout 表（最近5条）:');
    const [payouts] = await connection.execute(
      `SELECT id, user_id, month, income_monthly_id, base_amount_usd, payout_currency, payout_amount, fx_rate,
              status, method, gateway_tx_id, requested_at, paid_at, created_at, updated_at
       FROM user_payout 
       ORDER BY created_at DESC 
       LIMIT 5`
    );
    
    payouts.forEach((payout, index) => {
      console.log(`\n记录 ${index + 1}:`);
      console.log(`  ID: ${payout.id}`);
      console.log(`  user_id: ${payout.user_id}`);
      console.log(`  month: ${payout.month}`);
      console.log(`  income_monthly_id: ${payout.income_monthly_id}`);
      console.log(`  gateway_tx_id: ${payout.gateway_tx_id}`);
      console.log(`  status: ${payout.status}`);
      console.log(`  method: ${payout.method}`);
      console.log(`  amount: ${payout.payout_amount} ${payout.payout_currency}`);
      console.log(`  requested_at: ${payout.requested_at}`);
      console.log(`  paid_at: ${payout.paid_at || 'NULL'}`);
      console.log(`  created_at: ${payout.created_at}`);
      console.log(`  updated_at: ${payout.updated_at}`);
    });
    
    // 3. 查询 user_income_monthly
    console.log('\n\n3. user_income_monthly 表（user_id=2，最近5条）:');
    const [incomes] = await connection.execute(
      `SELECT id, user_id, month, author_base_income_usd, reader_referral_income_usd, 
              author_referral_income_usd, total_income_usd, payout_status, payout_id,
              created_at, updated_at
       FROM user_income_monthly 
       WHERE user_id = 2
       ORDER BY month DESC 
       LIMIT 5`
    );
    
    incomes.forEach((income, index) => {
      console.log(`\n记录 ${index + 1}:`);
      console.log(`  ID: ${income.id}`);
      console.log(`  user_id: ${income.user_id}`);
      console.log(`  month: ${income.month}`);
      console.log(`  total_income_usd: ${income.total_income_usd}`);
      console.log(`  payout_status: ${income.payout_status}`);
      console.log(`  payout_id: ${income.payout_id || 'NULL'}`);
      console.log(`  created_at: ${income.created_at}`);
      console.log(`  updated_at: ${income.updated_at}`);
    });
    
    // 4. 关联查询：检查数据一致性
    console.log('\n\n4. 数据关联检查（最新的PayPal支付）:');
    const [latestPayout] = await connection.execute(
      `SELECT p.id as payout_id, p.user_id, p.month, p.income_monthly_id, p.gateway_tx_id, p.status as payout_status,
              g.id as gateway_tx_id_value, g.provider_tx_id, g.status as gateway_status,
              JSON_EXTRACT(g.response_payload, '$.batch_id') as batch_id_from_json,
              i.id as income_id, i.payout_status as income_payout_status, i.payout_id as income_payout_id
       FROM user_payout p
       LEFT JOIN payout_gateway_transaction g ON p.gateway_tx_id = g.id
       LEFT JOIN user_income_monthly i ON p.income_monthly_id = i.id
       WHERE p.method = 'paypal'
       ORDER BY p.created_at DESC
       LIMIT 3`
    );
    
    latestPayout.forEach((row, index) => {
      console.log(`\n关联记录 ${index + 1}:`);
      console.log(`  user_payout.id: ${row.payout_id}`);
      console.log(`  user_payout.gateway_tx_id: ${row.gateway_tx_id}`);
      console.log(`  user_payout.status: ${row.payout_status}`);
      console.log(`  payout_gateway_transaction.id: ${row.gateway_tx_id_value || 'NULL'}`);
      console.log(`  payout_gateway_transaction.provider_tx_id: ${row.provider_tx_id || 'NULL'}`);
      console.log(`  payout_gateway_transaction.status: ${row.gateway_status || 'NULL'}`);
      console.log(`  batch_id_from_json: ${row.batch_id_from_json || 'NULL'}`);
      console.log(`  user_income_monthly.id: ${row.income_id || 'NULL'}`);
      console.log(`  user_income_monthly.payout_status: ${row.income_payout_status || 'NULL'}`);
      console.log(`  user_income_monthly.payout_id: ${row.income_payout_id || 'NULL'}`);
      
      // 检查数据一致性
      console.log(`\n  数据一致性检查:`);
      if (row.gateway_tx_id_value && row.gateway_tx_id === row.gateway_tx_id_value) {
        console.log(`  ✓ user_payout.gateway_tx_id 匹配 payout_gateway_transaction.id`);
      } else {
        console.log(`  ✗ user_payout.gateway_tx_id 不匹配 payout_gateway_transaction.id`);
      }
      
      if (row.income_payout_id && row.income_payout_id === row.payout_id) {
        console.log(`  ✓ user_income_monthly.payout_id 匹配 user_payout.id`);
      } else {
        console.log(`  ✗ user_income_monthly.payout_id 不匹配 user_payout.id (income_payout_id: ${row.income_payout_id}, payout_id: ${row.payout_id})`);
      }
      
      if (row.provider_tx_id && row.batch_id_from_json && row.provider_tx_id === row.batch_id_from_json.replace(/"/g, '')) {
        console.log(`  ✓ provider_tx_id 匹配 response_payload.batch_id`);
      } else {
        console.log(`  ⚠ provider_tx_id 与 response_payload.batch_id 不一致`);
        console.log(`    provider_tx_id: ${row.provider_tx_id}`);
        console.log(`    batch_id_from_json: ${row.batch_id_from_json}`);
      }
    });
    
    // 5. 查询最新的批次ID（用于Webhook测试）
    console.log('\n\n5. 最新的PayPal批次ID（用于Webhook测试）:');
    const [latestBatch] = await connection.execute(
      `SELECT provider_tx_id, 
              JSON_EXTRACT(response_payload, '$.batch_id') as batch_id_from_json,
              status, created_at
       FROM payout_gateway_transaction 
       WHERE provider = 'paypal'
       ORDER BY created_at DESC 
       LIMIT 1`
    );
    
    if (latestBatch.length > 0) {
      const batch = latestBatch[0];
      console.log(`  最新的批次ID（provider_tx_id）: ${batch.provider_tx_id}`);
      console.log(`  最新的批次ID（from JSON）: ${batch.batch_id_from_json?.replace(/"/g, '') || 'N/A'}`);
      console.log(`  状态: ${batch.status}`);
      console.log(`  创建时间: ${batch.created_at}`);
      console.log(`\n  💡 Webhook测试时，应该使用批次ID: ${batch.provider_tx_id}`);
    }
    
    console.log('\n\n========== 查询完成 ==========');
    
  } catch (error) {
    console.error('查询错误:', error);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

checkPayoutData();

