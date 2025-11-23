const mysql = require('mysql2/promise');

async function migrateData() {
  const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '123456',
    database: process.env.DB_NAME || 'kongfuworld',
    charset: 'utf8mb4'
  };

  let connection;
  try {
    connection = await mysql.createConnection(dbConfig);
    
    console.log('开始迁移数据...');
    
    // 迁移 author_income_monthly 到 user_income_monthly
    const [oldRecords] = await connection.query('SELECT * FROM author_income_monthly');
    
    if (oldRecords.length > 0) {
      console.log(`找到 ${oldRecords.length} 条记录需要迁移`);
      
      for (const record of oldRecords) {
        // 将 base_income_usd 映射到 author_base_income_usd
        await connection.execute(
          `INSERT INTO user_income_monthly 
           (user_id, month, author_base_income_usd, reader_referral_income_usd, author_referral_income_usd, total_income_usd, paid_amount_usd, payout_status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE
           author_base_income_usd = VALUES(author_base_income_usd),
           reader_referral_income_usd = VALUES(reader_referral_income_usd),
           author_referral_income_usd = VALUES(author_referral_income_usd),
           total_income_usd = VALUES(total_income_usd),
           paid_amount_usd = VALUES(paid_amount_usd),
           payout_status = VALUES(payout_status),
           updated_at = CURRENT_TIMESTAMP`,
          [
            record.user_id,
            record.month,
            record.base_income_usd, // 映射到 author_base_income_usd
            record.reader_referral_income_usd,
            record.author_referral_income_usd,
            record.total_income_usd,
            record.paid_amount_usd,
            record.payout_status
          ]
        );
        console.log(`  迁移用户 ${record.user_id} 的 ${record.month} 月数据`);
      }
      
      console.log('✅ 数据迁移完成！');
    } else {
      console.log('没有需要迁移的数据');
    }
    
  } catch (error) {
    console.error('❌ 迁移数据失败:', error.message);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

migrateData();

