// 修复头像显示问题的脚本
const mysql = require('mysql2/promise');

async function fixAvatarDisplay() {
  console.log('🔧 修复头像显示问题...\n');

  try {
    // 1. 测试数据库连接
    const connection = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: '123456',
      database: 'kongfuworld'
    });

    console.log('✅ 数据库连接成功');

    // 2. 检查用户头像数据
    const [users] = await connection.execute('SELECT id, username, avatar FROM user LIMIT 5');
    console.log('👤 用户头像数据:');
    users.forEach(user => {
      console.log(`  ID: ${user.id}, 用户名: ${user.username}, 头像: ${user.avatar || '无'}`);
    });

    // 3. 检查avatars目录
    const fs = require('fs');
    const path = require('path');
    const avatarsDir = path.join(__dirname, '../avatars');
    
    if (fs.existsSync(avatarsDir)) {
      const files = fs.readdirSync(avatarsDir);
      console.log('📁 avatars目录文件:');
      files.slice(0, 5).forEach(file => {
        console.log(`  ${file}`);
      });
      console.log(`  总共 ${files.length} 个文件`);
    } else {
      console.log('❌ avatars目录不存在');
    }

    // 4. 测试头像URL生成
    console.log('\n🔗 头像URL测试:');
    const testAvatars = [
      null,
      '',
      'user_1_1752549681696.jpeg',
      '/avatars/user_1_1752549681696.jpeg',
      'http://example.com/avatar.jpg'
    ];

    testAvatars.forEach(avatar => {
      let url;
      if (!avatar) {
        url = 'https://i.pravatar.cc/40?img=1';
      } else if (avatar.startsWith('http://') || avatar.startsWith('https://')) {
        url = avatar;
      } else if (avatar.startsWith('/')) {
        url = `http://localhost:5000${avatar}`;
      } else {
        url = `http://localhost:5000/avatars/${avatar}`;
      }
      console.log(`  输入: ${avatar || 'null'} → 输出: ${url}`);
    });

    // 5. 检查评论数据
    const [reviews] = await connection.execute(`
      SELECT r.id, r.content, r.created_at, u.username, u.avatar 
      FROM review r 
      JOIN user u ON r.user_id = u.id 
      ORDER BY r.created_at DESC 
      LIMIT 3
    `);

    console.log('\n💬 评论数据:');
    if (reviews.length === 0) {
      console.log('  暂无评论数据');
    } else {
      reviews.forEach(review => {
        console.log(`  ID: ${review.id}, 用户: ${review.username}, 头像: ${review.avatar || '无'}`);
      });
    }

    // 6. 修复建议
    console.log('\n🛠️ 修复建议:');
    console.log('1. 确保后端服务器正在运行 (http://localhost:5000)');
    console.log('2. 检查avatars目录是否存在且可访问');
    console.log('3. 确保用户头像字段不为空');
    console.log('4. 检查前端头像URL生成逻辑');

    // 7. 测试静态文件服务
    console.log('\n📡 测试静态文件服务:');
    console.log('  访问: http://localhost:5000/avatars/');
    console.log('  如果返回404，说明静态文件服务配置有问题');

    console.log('\n✅ 头像显示问题诊断完成！');

    await connection.end();

  } catch (error) {
    console.error('❌ 诊断失败:', error);
  }
}

fixAvatarDisplay();
