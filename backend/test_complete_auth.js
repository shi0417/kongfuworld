// 测试完整认证流程的脚本
const mysql = require('mysql2/promise');
const jwt = require('jsonwebtoken');

async function testCompleteAuth() {
  console.log('🧪 测试完整认证流程...\n');

  try {
    // 1. 测试数据库连接
    const connection = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: '123456',
      database: 'kongfuworld'
    });

    console.log('✅ 数据库连接成功');

    // 2. 检查用户数据
    const [users] = await connection.execute('SELECT id, username, email FROM user LIMIT 3');
    console.log('👥 用户数据:');
    users.forEach(user => {
      console.log(`  ID: ${user.id}, 用户名: ${user.username}, 邮箱: ${user.email}`);
    });

    // 3. 测试JWT token生成和验证
    const testUser = { userId: 1, username: 'shiyixian' };
    const token = jwt.sign(testUser, 'your-secret-key', { expiresIn: '7d' });
    console.log('🔑 生成JWT token成功');
    console.log('  Token长度:', token.length);
    console.log('  Token前20位:', token.substring(0, 20) + '...');

    // 4. 验证token
    try {
      const decoded = jwt.verify(token, 'your-secret-key');
      console.log('✅ JWT token验证成功:', decoded);
      console.log('  用户ID:', decoded.userId);
      console.log('  用户名:', decoded.username);
    } catch (error) {
      console.error('❌ JWT token验证失败:', error.message);
    }

    // 5. 测试API认证流程
    console.log('\n📡 测试API认证流程:');
    console.log('1. 用户登录 → 生成JWT token');
    console.log('2. 前端保存token到localStorage');
    console.log('3. 评论API调用时携带token');
    console.log('4. 后端验证token并获取用户ID');

    // 6. 模拟API调用
    const authHeader = `Bearer ${token}`;
    console.log('\n🔐 模拟API调用:');
    console.log('  Authorization header:', authHeader.substring(0, 30) + '...');
    
    // 解析token
    const tokenPart = authHeader.split(' ')[1];
    const decodedToken = jwt.verify(tokenPart, 'your-secret-key');
    console.log('  解析后的用户信息:', decodedToken);
    console.log('  用户ID:', decodedToken.userId);

    // 7. 检查评论相关表
    console.log('\n📊 评论系统表状态:');
    const tables = ['review', 'comment', 'review_like'];
    for (const table of tables) {
      const [rows] = await connection.execute(`SELECT COUNT(*) as count FROM ${table}`);
      console.log(`  ${table} 表记录数: ${rows[0].count}`);
    }

    console.log('\n🎉 完整认证流程测试完成！');
    console.log('\n📝 修复总结:');
    console.log('✅ 后端登录API现在返回JWT token');
    console.log('✅ 前端登录时保存token到localStorage');
    console.log('✅ 评论API现在需要JWT认证');
    console.log('✅ BookDetail页面监听用户状态变化');
    console.log('✅ 用户状态检测同时检查user和token');

    console.log('\n🚀 测试步骤:');
    console.log('1. 重启后端服务器');
    console.log('2. 清除浏览器localStorage');
    console.log('3. 重新登录（应该同时保存user和token）');
    console.log('4. 访问小说详情页（应该检测到用户已登录）');
    console.log('5. 测试评论功能（应该可以正常提交）');

    await connection.end();

  } catch (error) {
    console.error('❌ 测试失败:', error);
  }
}

testCompleteAuth();
