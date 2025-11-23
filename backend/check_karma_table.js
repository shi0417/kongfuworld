const mysql = require('mysql2/promise');

const dbConfig = {
  host: 'localhost',
  user: 'root',
  password: '123456',
  database: 'kongfuworld'
};

async function checkKarmaTable() {
  let db;
  try {
    db = await mysql.createConnection(dbConfig);
    console.log('🔍 检查user_karma_transactions表结构...');
    
    // 检查表结构
    const [columns] = await db.execute(`
      DESCRIBE user_karma_transactions
    `);
    
    console.log('📊 表字段:');
    columns.forEach((column, index) => {
      console.log(`   ${index + 1}. ${column.Field}: ${column.Type} ${column.Null === 'YES' ? '(可空)' : '(非空)'}`);
    });
    
    // 检查是否有amount字段
    const hasAmount = columns.some(col => col.Field === 'amount');
    if (!hasAmount) {
      console.log('\n❌ 缺少amount字段，需要添加');
      
      // 添加amount字段
      await db.execute(`
        ALTER TABLE user_karma_transactions ADD COLUMN amount INT NOT NULL DEFAULT 0 COMMENT '交易金额'
      `);
      
      console.log('✅ amount字段已添加');
    } else {
      console.log('\n✅ amount字段已存在');
    }
    
    // 检查现有数据
    const [records] = await db.execute(`
      SELECT * FROM user_karma_transactions 
      ORDER BY created_at DESC 
      LIMIT 3
    `);
    
    console.log('\n📊 现有数据示例:');
    records.forEach((record, index) => {
      console.log(`   ${index + 1}. ID: ${record.id}, 类型: ${record.transaction_type}, 金额: ${record.amount}, 余额: ${record.balance_before}->${record.balance_after}`);
    });
    
  } catch (error) {
    console.error('❌ 检查失败:', error.message);
  } finally {
    if (db) await db.end();
  }
}

checkKarmaTable();
