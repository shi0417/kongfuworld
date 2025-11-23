// 验证confirmed_email字段数据
const mysql = require('mysql2/promise');

const dbConfig = {
  host: 'localhost',
  user: 'root',
  password: '123456',
  database: 'kongfuworld',
  charset: 'utf8mb4'
};

async function verifyData() {
  let connection;
  
  try {
    connection = await mysql.createConnection(dbConfig);
    
    console.log('📊 已验证邮箱的用户:');
    console.log('─'.repeat(60));
    
    const [result] = await connection.execute(
      'SELECT id, email, confirmed_email FROM user WHERE confirmed_email IS NOT NULL LIMIT 10'
    );
    
    if (result.length === 0) {
      console.log('  暂无已验证邮箱的用户');
    } else {
      result.forEach(r => {
        console.log(`  用户ID: ${r.id}`);
        console.log(`     email: ${r.email || 'NULL'}`);
        console.log(`     confirmed_email: ${r.confirmed_email}`);
      });
    }
    
    console.log('\n📊 所有用户邮箱状态:');
    console.log('─'.repeat(60));
    
    const [allUsers] = await connection.execute(
      'SELECT id, username, email, confirmed_email FROM user LIMIT 10'
    );
    
    allUsers.forEach(u => {
      const status = u.confirmed_email 
        ? `✅ 已验证 (${u.confirmed_email})` 
        : '❌ 未验证';
      console.log(`  用户ID ${u.id} (${u.username}): ${status}`);
    });
    
  } catch (error) {
    console.error('❌ 验证失败:', error.message);
  } finally {
    if (connection) await connection.end();
  }
}

verifyData().catch(console.error);

