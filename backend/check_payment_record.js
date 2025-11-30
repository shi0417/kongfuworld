/**
 * 检查 payment_record 表数据
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
    
    console.log('=== payment_record 表最近20条记录 ===\n');
    const [records] = await db.execute(
      'SELECT * FROM payment_record ORDER BY id DESC LIMIT 20'
    );
    console.log(JSON.stringify(records, null, 2));
    
    // 检查与最新 PayPal 订阅相关的 payment_record
    const [paypalSub] = await db.execute(
      `SELECT * FROM user_champion_subscription WHERE payment_method = 'paypal' ORDER BY created_at DESC LIMIT 1`
    );
    
    if (paypalSub.length > 0) {
      const sub = paypalSub[0];
      console.log(`\n=== 查找用户 ${sub.user_id} 在 ${sub.created_at} 附近的 payment_record ===\n`);
      
      // 查找时间相近的 payment_record
      const [relatedPayments] = await db.execute(
        `SELECT * FROM payment_record 
         WHERE user_id = ? 
           AND amount = ?
           AND created_at BETWEEN DATE_SUB(?, INTERVAL 5 MINUTE) AND DATE_ADD(?, INTERVAL 5 MINUTE)
         ORDER BY created_at DESC`,
        [sub.user_id, sub.monthly_price, sub.created_at, sub.created_at]
      );
      console.log('相关的 payment_record:');
      console.log(JSON.stringify(relatedPayments, null, 2));
    }
    
  } catch (error) {
    console.error('查询失败:', error);
  } finally {
    if (db) await db.end();
  }
}

checkData();

