/**
 * 查询实际数据库数据
 */

const mysql = require('mysql2/promise');

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '123456',
  database: process.env.DB_NAME || 'kongfuworld',
  charset: 'utf8mb4'
};

async function queryActualData() {
  let db;
  
  try {
    db = await mysql.createConnection(dbConfig);
    
    // 查询订阅记录
    const [records] = await db.execute(
      `SELECT id, payment_amount, start_date, end_date, subscription_duration_days
       FROM user_champion_subscription_record
       WHERE id IN (21, 22, 23, 27)
       ORDER BY id`
    );
    
    console.log('订阅记录:');
    records.forEach(r => {
      console.log(`  ID=${r.id}: payment_amount=${r.payment_amount}, start=${r.start_date}, end=${r.end_date}`);
    });
    
    // 查询 reader_spending 记录
    const [spending] = await db.execute(
      `SELECT id, source_id, amount_usd, settlement_month, spend_time
       FROM reader_spending
       WHERE source_type = 'subscription' AND source_id IN (21, 22, 23, 27)
       ORDER BY source_id, settlement_month`
    );
    
    console.log('\nreader_spending 记录:');
    spending.forEach(s => {
      console.log(`  ID=${s.id}: source_id=${s.source_id}, amount_usd=${s.amount_usd}, settlement_month=${s.settlement_month} (类型: ${typeof s.settlement_month})`);
    });
    
    // 按 source_id 分组汇总
    console.log('\n按 source_id 汇总:');
    const grouped = {};
    spending.forEach(s => {
      if (!grouped[s.source_id]) {
        grouped[s.source_id] = [];
      }
      grouped[s.source_id].push(s);
    });
    
    Object.keys(grouped).forEach(sourceId => {
      const items = grouped[sourceId];
      const total = items.reduce((sum, item) => sum + parseFloat(item.amount_usd), 0);
      const record = records.find(r => r.id == sourceId);
      const paymentAmount = record ? parseFloat(record.payment_amount) : 0;
      const diff = total - paymentAmount;
      
      console.log(`\n  source_id=${sourceId}:`);
      console.log(`    原始 payment_amount: ${paymentAmount}`);
      console.log(`    拆分记录数: ${items.length}`);
      items.forEach(item => {
        console.log(`      ${item.settlement_month}: ${item.amount_usd}`);
      });
      console.log(`    合计: ${total}`);
      console.log(`    差异: ${diff} (${diff > 0 ? '多' : '少'} ${Math.abs(diff)})`);
    });
    
  } catch (error) {
    console.error('错误:', error);
  } finally {
    if (db) await db.end();
  }
}

queryActualData();

