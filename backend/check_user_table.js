const mysql = require('mysql2/promise');

const dbConfig = {
  host: 'localhost',
  user: 'root',
  password: '123456',
  database: 'kongfuworld'
};

async function checkUserTable() {
  let db;
  try {
    db = await mysql.createConnection(dbConfig);
    console.log('🔍 检查用户表结构...');
    
    // 检查表结构
    const [columns] = await db.execute(`
      DESCRIBE user
    `);
    
    console.log('📊 用户表字段:');
    columns.forEach((column, index) => {
      console.log(`   ${index + 1}. ${column.Field}: ${column.Type} ${column.Null === 'YES' ? '(可空)' : '(非空)'}`);
    });
    
    // 检查是否有karma字段
    const hasKarma = columns.some(col => col.Field === 'karma');
    if (!hasKarma) {
      console.log('\n❌ 用户表缺少karma字段，需要添加');
      
      // 添加karma字段
      await db.execute(`
        ALTER TABLE user ADD COLUMN karma INT DEFAULT 0 COMMENT 'Karma余额'
      `);
      
      console.log('✅ karma字段已添加');
      
      // 给现有用户设置默认Karma余额
      await db.execute(`
        UPDATE user SET karma = 100 WHERE karma IS NULL OR karma = 0
      `);
      
      console.log('✅ 已为现有用户设置默认Karma余额');
    } else {
      console.log('\n✅ karma字段已存在');
    }
    
    // 检查用户数据
    const [users] = await db.execute('SELECT id, username, karma FROM user LIMIT 5');
    console.log('\n📊 用户数据示例:');
    users.forEach((user, index) => {
      console.log(`   ${index + 1}. ID: ${user.id}, 用户名: ${user.username}, Karma: ${user.karma}`);
    });
    
  } catch (error) {
    console.error('❌ 检查失败:', error.message);
  } finally {
    if (db) await db.end();
  }
}

checkUserTable();
