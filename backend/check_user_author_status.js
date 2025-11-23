// 检查用户的作者状态
const mysql = require('mysql2/promise');

const dbConfig = {
  host: 'localhost',
  user: 'root',
  password: '123456',
  database: 'kongfuworld',
  charset: 'utf8mb4'
};

async function checkUserStatus() {
  let connection;
  
  try {
    connection = await mysql.createConnection(dbConfig);
    
    console.log('📊 检查用户作者状态:');
    console.log('─'.repeat(70));
    
    // 查询所有用户，重点关注用户1（根据截图中的用户名判断）
    const [users] = await connection.execute(`
      SELECT 
        id, 
        username, 
        email, 
        is_author, 
        confirmed_email,
        confirmed_email IS NOT NULL as has_confirmed_email
      FROM user 
      WHERE username LIKE '%shi%' OR id IN (1, 2)
      ORDER BY id
    `);
    
    users.forEach(u => {
      const isAuthor = u.is_author === 1;
      const hasConfirmed = u.has_confirmed_email;
      
      console.log(`\n用户ID: ${u.id}`);
      console.log(`  用户名: ${u.username}`);
      console.log(`  email: ${u.email || 'NULL'}`);
      console.log(`  is_author: ${u.is_author} ${isAuthor ? '✅ (是作者)' : '❌ (不是作者)'}`);
      console.log(`  confirmed_email: ${u.confirmed_email || 'NULL'} ${hasConfirmed ? '✅' : '❌'}`);
      
      if (u.confirmed_email && !isAuthor) {
        console.log(`  ⚠️  警告: 用户已验证邮箱但is_author=0，可能需要更新`);
      }
    });
    
    // 检查是否有已验证邮箱但未设置为作者的用户
    const [needUpdate] = await connection.execute(`
      SELECT COUNT(*) as count
      FROM user
      WHERE confirmed_email IS NOT NULL 
        AND (is_author = 0 OR is_author IS NULL)
    `);
    
    if (needUpdate[0].count > 0) {
      console.log(`\n⚠️  发现 ${needUpdate[0].count} 个用户已验证邮箱但未设置为作者`);
    }
    
  } catch (error) {
    console.error('❌ 检查失败:', error.message);
  } finally {
    if (connection) await connection.end();
  }
}

checkUserStatus().catch(console.error);

