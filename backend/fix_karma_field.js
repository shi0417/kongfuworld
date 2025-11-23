const mysql = require('mysql2/promise');

const dbConfig = {
  host: 'localhost',
  user: 'root',
  password: '123456',
  database: 'kongfuworld'
};

async function fixKarmaField() {
  let db;
  try {
    db = await mysql.createConnection(dbConfig);
    console.log('🔧 修复Karma字段问题...');
    
    // 1. 删除错误的karma字段
    console.log('🗑️ 删除错误的karma字段...');
    try {
      await db.execute(`
        ALTER TABLE user DROP COLUMN karma
      `);
      console.log('✅ karma字段已删除');
    } catch (error) {
      if (error.code === 'ER_CANT_DROP_FIELD_OR_KEY') {
        console.log('ℹ️ karma字段不存在，无需删除');
      } else {
        throw error;
      }
    }
    
    // 2. 检查golden_karma字段
    console.log('🔍 检查golden_karma字段...');
    const [columns] = await db.execute(`
      DESCRIBE user
    `);
    
    const hasGoldenKarma = columns.some(col => col.Field === 'golden_karma');
    if (hasGoldenKarma) {
      console.log('✅ golden_karma字段已存在');
    } else {
      console.log('❌ golden_karma字段不存在，需要添加');
      await db.execute(`
        ALTER TABLE user ADD COLUMN golden_karma INT DEFAULT 0 COMMENT 'Golden Karma余额'
      `);
      console.log('✅ golden_karma字段已添加');
    }
    
    // 3. 检查用户数据
    const [users] = await db.execute('SELECT id, username, golden_karma FROM user LIMIT 5');
    console.log('\n📊 用户数据示例:');
    users.forEach((user, index) => {
      console.log(`   ${index + 1}. ID: ${user.id}, 用户名: ${user.username}, Golden Karma: ${user.golden_karma}`);
    });
    
    // 4. 检查user_karma_transactions表是否存在
    const [tables] = await db.execute(`
      SHOW TABLES LIKE 'user_karma_transactions'
    `);
    
    if (tables.length === 0) {
      console.log('\n📊 创建user_karma_transactions表...');
      await db.execute(`
        CREATE TABLE user_karma_transactions (
          id INT AUTO_INCREMENT PRIMARY KEY,
          user_id INT NOT NULL,
          transaction_type ENUM('unlock', 'purchase', 'refund', 'admin') NOT NULL,
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
      console.log('✅ user_karma_transactions表已创建');
    } else {
      console.log('✅ user_karma_transactions表已存在');
    }
    
  } catch (error) {
    console.error('❌ 修复失败:', error.message);
  } finally {
    if (db) await db.end();
  }
}

fixKarmaField();
