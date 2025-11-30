/**
 * 检查 PayPal Champion 订阅数据
 */

const mysql = require('mysql2/promise');

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '123456',
  database: process.env.DB_NAME || 'kongfuworld',
  charset: 'utf8mb4'
};

async function checkData() {
  let db;
  
  try {
    db = await mysql.createConnection(dbConfig);
    
    console.log('=== 1. user_champion_subscription 表结构 ===\n');
    const [table1] = await db.execute('SHOW CREATE TABLE user_champion_subscription');
    console.log(table1[0]['Create Table']);
    
    console.log('\n=== 2. user_champion_subscription 数据统计 ===\n');
    const [count1] = await db.execute('SELECT COUNT(*) AS total FROM user_champion_subscription');
    console.log(`总记录数: ${count1[0].total}`);
    
    console.log('\n=== 3. user_champion_subscription 最近20条记录 ===\n');
    const [records1] = await db.execute(
      'SELECT * FROM user_champion_subscription ORDER BY id DESC LIMIT 20'
    );
    console.log(JSON.stringify(records1, null, 2));
    
    console.log('\n=== 4. user_champion_subscription_record 表结构 ===\n');
    const [table2] = await db.execute('SHOW CREATE TABLE user_champion_subscription_record');
    console.log(table2[0]['Create Table']);
    
    console.log('\n=== 5. user_champion_subscription_record 数据统计 ===\n');
    const [count2] = await db.execute('SELECT COUNT(*) AS total FROM user_champion_subscription_record');
    console.log(`总记录数: ${count2[0].total}`);
    
    console.log('\n=== 6. user_champion_subscription_record 最近20条记录 ===\n');
    const [records2] = await db.execute(
      'SELECT * FROM user_champion_subscription_record ORDER BY id DESC LIMIT 20'
    );
    console.log(JSON.stringify(records2, null, 2));
    
    console.log('\n=== 7. reader_spending 订阅拆分数据（最近20条） ===\n');
    const [records3] = await db.execute(
      `SELECT * FROM reader_spending WHERE source_type = 'subscription' ORDER BY id DESC LIMIT 20`
    );
    console.log(JSON.stringify(records3, null, 2));
    
    console.log('\n=== 8. 检查最近的 PayPal 订阅 ===\n');
    const [paypalSubs] = await db.execute(
      `SELECT * FROM user_champion_subscription WHERE payment_method = 'paypal' ORDER BY created_at DESC LIMIT 5`
    );
    console.log('PayPal 订阅记录:');
    console.log(JSON.stringify(paypalSubs, null, 2));
    
    if (paypalSubs.length > 0) {
      const latestPaypal = paypalSubs[0];
      console.log(`\n检查最新的 PayPal 订阅 (id=${latestPaypal.id}) 是否有对应的 record:\n`);
      const [relatedRecords] = await db.execute(
        `SELECT * FROM user_champion_subscription_record 
         WHERE user_id = ? AND novel_id = ? 
         ORDER BY created_at DESC LIMIT 5`,
        [latestPaypal.user_id, latestPaypal.novel_id]
      );
      console.log('相关的 subscription_record:');
      console.log(JSON.stringify(relatedRecords, null, 2));
    }
    
  } catch (error) {
    console.error('查询失败:', error);
  } finally {
    if (db) await db.end();
  }
}

checkData();

