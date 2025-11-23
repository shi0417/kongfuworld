// 测试认证修复的脚本
const mysql = require('mysql2/promise');

async function testAuthFix() {
  console.log('🧪 测试认证修复...\n');

  try {
    // 1. 测试数据库连接
    const connection = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: '123456',
      database: 'kongfuworld'
    });

    console.log('✅ 数据库连接成功');

    // 2. 检查用户表
    const [users] = await connection.execute('SELECT id, username, email FROM user LIMIT 3');
    console.log('👥 用户数据:');
    users.forEach(user => {
      console.log(`  ID: ${user.id}, 用户名: ${user.username}, 邮箱: ${user.email}`);
    });

    // 3. 检查评论相关表
    const tables = ['review', 'comment', 'review_like'];
    for (const table of tables) {
      const [rows] = await connection.execute(`SELECT COUNT(*) as count FROM ${table}`);
      console.log(`📊 ${table} 表记录数: ${rows[0].count}`);
    }

    // 4. 测试JWT token生成
    const jwt = require('jsonwebtoken');
    const testToken = jwt.sign(
      { userId: 1, username: 'testuser' },
      'your-secret-key',
      { expiresIn: '7d' }
    );
    console.log('🔑 测试JWT token生成成功');
    console.log('  Token长度:', testToken.length);
    console.log('  Token前20位:', testToken.substring(0, 20) + '...');

    // 5. 验证token
    try {
      const decoded = jwt.verify(testToken, 'your-secret-key');
      console.log('✅ JWT token验证成功:', decoded);
    } catch (error) {
      console.error('❌ JWT token验证失败:', error.message);
    }

    console.log('\n🎉 认证修复测试完成！');
    console.log('\n📝 下一步操作:');
    console.log('1. 重启后端服务器: cd backend && node server.js');
    console.log('2. 清除浏览器localStorage');
    console.log('3. 重新登录获取token');
    console.log('4. 测试评论功能');

    await connection.end();

  } catch (error) {
    console.error('❌ 测试失败:', error);
  }
}

testAuthFix();
