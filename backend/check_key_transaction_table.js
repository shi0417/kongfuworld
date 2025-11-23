const mysql = require('mysql2/promise');

const dbConfig = {
  host: 'localhost',
  user: 'root',
  password: '123456',
  database: 'kongfuworld'
};

async function checkKeyTransactionTable() {
  let db;
  try {
    db = await mysql.createConnection(dbConfig);
    console.log('🔍 检查key_transaction表...');
    
    // 检查表是否存在
    const [tables] = await db.execute(`
      SHOW TABLES LIKE 'key_transaction'
    `);
    
    if (tables.length === 0) {
      console.log('❌ key_transaction表不存在，需要创建');
      
      // 创建表
      await db.execute(`
        CREATE TABLE key_transaction (
          id INT AUTO_INCREMENT PRIMARY KEY,
          user_id INT NOT NULL,
          transaction_type ENUM('checkin', 'mission', 'unlock', 'purchase', 'refund', 'admin') NOT NULL,
          amount INT NOT NULL,
          balance_before INT NOT NULL,
          balance_after INT NOT NULL,
          reference_id INT NULL,
          reference_type VARCHAR(50) NULL,
          description TEXT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_user_id (user_id),
          INDEX idx_transaction_type (transaction_type),
          INDEX idx_created_at (created_at)
        )
      `);
      
      console.log('✅ key_transaction表已创建');
    } else {
      console.log('✅ key_transaction表存在');
    }
    
  } catch (error) {
    console.error('❌ 检查失败:', error.message);
  } finally {
    if (db) await db.end();
  }
}

checkKeyTransactionTable();
