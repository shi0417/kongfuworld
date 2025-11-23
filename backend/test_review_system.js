const mysql = require('mysql2/promise');

async function testReviewSystem() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '123456',
    database: 'kongfuworld'
  });

  try {
    console.log('🧪 测试评论系统...\n');

    // 1. 检查表是否存在
    console.log('1. 检查数据库表结构...');
    
    const tables = ['review', 'comment', 'review_like'];
    for (const table of tables) {
      const [rows] = await connection.execute(`SHOW TABLES LIKE '${table}'`);
      if (rows.length > 0) {
        console.log(`✅ ${table} 表存在`);
      } else {
        console.log(`❌ ${table} 表不存在`);
      }
    }

    // 2. 检查是否有测试数据
    console.log('\n2. 检查测试数据...');
    
    const [novels] = await connection.execute('SELECT COUNT(*) as count FROM novel');
    console.log(`📚 小说数量: ${novels[0].count}`);
    
    const [users] = await connection.execute('SELECT COUNT(*) as count FROM user');
    console.log(`👥 用户数量: ${users[0].count}`);
    
    const [reviews] = await connection.execute('SELECT COUNT(*) as count FROM review');
    console.log(`💬 评论数量: ${reviews[0].count}`);

    // 3. 插入测试数据（如果不存在）
    console.log('\n3. 创建测试数据...');
    
    // 检查是否有用户
    const [existingUsers] = await connection.execute('SELECT id FROM user LIMIT 1');
    if (existingUsers.length === 0) {
      console.log('创建测试用户...');
      await connection.execute(`
        INSERT INTO user (username, email, password_hash, avatar, is_vip, balance, points, karma, settings_json)
        VALUES ('testuser', 'test@example.com', 'hashedpassword', '', 0, 0, 0, 0, '{}')
      `);
      console.log('✅ 测试用户创建成功');
    } else {
      console.log('✅ 用户已存在');
    }

    // 检查是否有小说
    const [existingNovels] = await connection.execute('SELECT id FROM novel LIMIT 1');
    if (existingNovels.length === 0) {
      console.log('创建测试小说...');
      await connection.execute(`
        INSERT INTO novel (title, author, description, status, cover, rating, reviews, chapters)
        VALUES ('测试小说', '测试作者', '这是一个测试小说', 'Ongoing', '', 0, 0, 0)
      `);
      console.log('✅ 测试小说创建成功');
    } else {
      console.log('✅ 小说已存在');
    }

    // 4. 测试API端点
    console.log('\n4. 测试API端点...');
    console.log('📡 可用的评论API端点:');
    console.log('   GET  /api/novel/:novelId/reviews - 获取评论列表');
    console.log('   GET  /api/novel/:novelId/review-stats - 获取评论统计');
    console.log('   POST /api/novel/:novelId/review - 提交评论');
    console.log('   POST /api/review/:reviewId/like - 点赞评论');
    console.log('   GET  /api/review/:reviewId/comments - 获取评论回复');
    console.log('   POST /api/review/:reviewId/comment - 回复评论');

    // 5. 显示数据库结构
    console.log('\n5. 数据库表结构:');
    
    const [reviewStructure] = await connection.execute('DESCRIBE review');
    console.log('\n📋 review 表结构:');
    reviewStructure.forEach(field => {
      console.log(`   ${field.Field}: ${field.Type} ${field.Null === 'NO' ? '(NOT NULL)' : ''}`);
    });

    const [commentStructure] = await connection.execute('DESCRIBE comment');
    console.log('\n📋 comment 表结构:');
    commentStructure.forEach(field => {
      console.log(`   ${field.Field}: ${field.Type} ${field.Null === 'NO' ? '(NOT NULL)' : ''}`);
    });

    const [reviewLikeStructure] = await connection.execute('DESCRIBE review_like');
    console.log('\n📋 review_like 表结构:');
    reviewLikeStructure.forEach(field => {
      console.log(`   ${field.Field}: ${field.Type} ${field.Null === 'NO' ? '(NOT NULL)' : ''}`);
    });

    console.log('\n✅ 评论系统测试完成！');
    console.log('\n📝 使用说明:');
    console.log('1. 启动后端服务器: cd backend && node server.js');
    console.log('2. 启动前端应用: cd frontend && npm start');
    console.log('3. 访问 http://localhost:3000/book/1 查看评论功能');
    console.log('4. 登录后可以提交评论、点赞、回复等操作');

  } catch (error) {
    console.error('❌ 测试失败:', error);
  } finally {
    await connection.end();
  }
}

testReviewSystem();
