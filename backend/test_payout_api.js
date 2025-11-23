const mysql = require('mysql2/promise');

// 数据库配置
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '123456',
  database: process.env.DB_NAME || 'kongfuworld',
  charset: 'utf8mb4'
};

async function testDatabaseStructure() {
  let connection;
  try {
    console.log('🧪 开始测试数据库结构...\n');
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ 数据库连接成功\n');
    
    // 1. 检查 user_payout 表结构
    console.log('1️⃣ 检查 user_payout 表结构:');
    const [payoutColumns] = await connection.query(`
      SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT, COLUMN_COMMENT
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'user_payout'
      ORDER BY ORDINAL_POSITION
    `, [dbConfig.database]);
    
    const requiredPayoutFields = ['month', 'income_monthly_id', 'base_amount_usd', 'payout_currency', 'payout_amount', 'fx_rate'];
    const existingPayoutFields = payoutColumns.map(col => col.COLUMN_NAME);
    
    console.log(`   总字段数: ${payoutColumns.length}`);
    requiredPayoutFields.forEach(field => {
      if (existingPayoutFields.includes(field)) {
        const col = payoutColumns.find(c => c.COLUMN_NAME === field);
        console.log(`   ✅ ${field}: ${col.DATA_TYPE} (${col.IS_NULLABLE === 'YES' ? 'NULL' : 'NOT NULL'})`);
      } else {
        console.log(`   ❌ ${field}: 缺失`);
      }
    });
    
    // 2. 检查 payout_gateway_transaction 表结构
    console.log('\n2️⃣ 检查 payout_gateway_transaction 表结构:');
    const [gatewayColumns] = await connection.query(`
      SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT, COLUMN_COMMENT
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'payout_gateway_transaction'
      ORDER BY ORDINAL_POSITION
    `, [dbConfig.database]);
    
    const requiredGatewayFields = ['base_amount_usd', 'payout_currency', 'payout_amount', 'fx_rate'];
    const existingGatewayFields = gatewayColumns.map(col => col.COLUMN_NAME);
    
    console.log(`   总字段数: ${gatewayColumns.length}`);
    requiredGatewayFields.forEach(field => {
      if (existingGatewayFields.includes(field)) {
        const col = gatewayColumns.find(c => c.COLUMN_NAME === field);
        console.log(`   ✅ ${field}: ${col.DATA_TYPE} (${col.IS_NULLABLE === 'YES' ? 'NULL' : 'NOT NULL'})`);
      } else {
        console.log(`   ❌ ${field}: 缺失`);
      }
    });
    
    // 3. 检查 user_income_monthly 表结构
    console.log('\n3️⃣ 检查 user_income_monthly 表结构:');
    const [incomeColumns] = await connection.query(`
      SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT, COLUMN_COMMENT
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'user_income_monthly'
      ORDER BY ORDINAL_POSITION
    `, [dbConfig.database]);
    
    const incomeFieldNames = incomeColumns.map(col => col.COLUMN_NAME);
    console.log(`   总字段数: ${incomeColumns.length}`);
    
    if (incomeFieldNames.includes('payout_id')) {
      const col = incomeColumns.find(c => c.COLUMN_NAME === 'payout_id');
      console.log(`   ✅ payout_id: ${col.DATA_TYPE} (${col.IS_NULLABLE === 'YES' ? 'NULL' : 'NOT NULL'})`);
    } else {
      console.log(`   ❌ payout_id: 缺失`);
    }
    
    // 检查 payout_status 枚举值
    const payoutStatusCol = incomeColumns.find(c => c.COLUMN_NAME === 'payout_status');
    if (payoutStatusCol) {
      console.log(`   ✅ payout_status: ${payoutStatusCol.DATA_TYPE}`);
      // 检查是否包含 partially_paid
      if (payoutStatusCol.DATA_TYPE && payoutStatusCol.DATA_TYPE.includes('partially_paid')) {
        console.log(`   ⚠️  payout_status 仍包含 'partially_paid'，需要修改`);
      } else {
        console.log(`   ✅ payout_status 枚举值正确（不包含 partially_paid）`);
      }
    }
    
    // 4. 检查唯一索引
    console.log('\n4️⃣ 检查 user_payout 表唯一索引:');
    const [indexes] = await connection.query(`
      SELECT INDEX_NAME, GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX) as COLUMNS
      FROM INFORMATION_SCHEMA.STATISTICS
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'user_payout'
      AND NON_UNIQUE = 0
      GROUP BY INDEX_NAME
    `, [dbConfig.database]);
    
    const uniqIndex = indexes.find(idx => idx.INDEX_NAME === 'uniq_user_month_payout');
    if (uniqIndex) {
      console.log(`   ✅ uniq_user_month_payout: (${uniqIndex.COLUMNS})`);
    } else {
      console.log(`   ❌ uniq_user_month_payout: 缺失`);
    }
    
    // 5. 检查 user_payout_item 表是否存在
    console.log('\n5️⃣ 检查 user_payout_item 表:');
    const [tables] = await connection.query(`
      SELECT TABLE_NAME
      FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'user_payout_item'
    `, [dbConfig.database]);
    
    if (tables.length > 0) {
      console.log(`   ⚠️  user_payout_item 表仍存在（可以稍后删除）`);
    } else {
      console.log(`   ✅ user_payout_item 表已删除`);
    }
    
    // 6. 测试数据查询
    console.log('\n6️⃣ 测试数据查询:');
    
    // 检查是否有 user_payout 数据
    const [payoutCount] = await connection.query('SELECT COUNT(*) as cnt FROM user_payout');
    console.log(`   user_payout 记录数: ${payoutCount[0].cnt}`);
    
    // 检查是否有 user_income_monthly 数据
    const [incomeCount] = await connection.query('SELECT COUNT(*) as cnt FROM user_income_monthly');
    console.log(`   user_income_monthly 记录数: ${incomeCount[0].cnt}`);
    
    // 检查是否有新字段的数据
    if (payoutCount[0].cnt > 0) {
      const [samplePayout] = await connection.query(`
        SELECT id, user_id, month, income_monthly_id, base_amount_usd, payout_currency, payout_amount, fx_rate
        FROM user_payout
        LIMIT 1
      `);
      
      if (samplePayout.length > 0) {
        const payout = samplePayout[0];
        console.log(`\n   示例 user_payout 记录:`);
        console.log(`   - ID: ${payout.id}`);
        console.log(`   - user_id: ${payout.user_id}`);
        console.log(`   - month: ${payout.month || 'NULL'}`);
        console.log(`   - income_monthly_id: ${payout.income_monthly_id || 'NULL'}`);
        console.log(`   - base_amount_usd: ${payout.base_amount_usd || 'NULL'}`);
        console.log(`   - payout_currency: ${payout.payout_currency || 'NULL'}`);
        console.log(`   - payout_amount: ${payout.payout_amount || 'NULL'}`);
        console.log(`   - fx_rate: ${payout.fx_rate || 'NULL'}`);
      }
    }
    
    console.log('\n✅ 数据库结构测试完成！');
    
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
testDatabaseStructure().catch(error => {
  console.error('❌ 执行测试时发生错误:', error);
  process.exit(1);
});

