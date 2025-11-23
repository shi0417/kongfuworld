// 测试章节解锁功能集成
const mysql = require('mysql2');

// 数据库连接配置
const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: '123456',
  database: 'kongfuworld',
  charset: 'utf8mb4'
});

async function testChapterUnlockIntegration() {
  try {
    console.log('🧪 测试章节解锁功能集成...\n');
    
    // 1. 检查章节解锁相关表是否存在
    console.log('1. 检查数据库表结构:');
    const tables = ['chapter_unlocks', 'chapter_access_log'];
    
    for (const table of tables) {
      const result = await new Promise((resolve, reject) => {
        db.query(`SHOW TABLES LIKE '${table}'`, (err, results) => {
          if (err) reject(err);
          else resolve(results);
        });
      });
      
      if (result.length > 0) {
        console.log(`✅ ${table} 表存在`);
      } else {
        console.log(`❌ ${table} 表不存在`);
      }
    }
    
    // 2. 检查章节表是否有解锁相关字段
    console.log('\n2. 检查章节表字段:');
    const chapterFields = await new Promise((resolve, reject) => {
      db.query('DESCRIBE chapter', (err, results) => {
        if (err) reject(err);
        else resolve(results);
      });
    });
    
    const requiredFields = ['is_premium', 'free_unlock_time', 'key_cost', 'unlock_price'];
    for (const field of requiredFields) {
      const exists = chapterFields.some(f => f.Field === field);
      console.log(`${exists ? '✅' : '❌'} 字段 ${field}: ${exists ? '存在' : '不存在'}`);
    }
    
    // 3. 检查用户表是否有相关字段
    console.log('\n3. 检查用户表字段:');
    const userFields = await new Promise((resolve, reject) => {
      db.query('DESCRIBE user', (err, results) => {
        if (err) reject(err);
        else resolve(results);
      });
    });
    
    const userRequiredFields = ['karma_count', 'subscription_status', 'subscription_end_date'];
    for (const field of userRequiredFields) {
      const exists = userFields.some(f => f.Field === field);
      console.log(`${exists ? '✅' : '❌'} 字段 ${field}: ${exists ? '存在' : '不存在'}`);
    }
    
    // 4. 测试章节解锁API
    console.log('\n4. 测试章节解锁API:');
    try {
      const response = await fetch('http://localhost:5000/api/chapter-unlock/status/1/1');
      if (response.ok) {
        const data = await response.json();
        console.log('✅ 章节解锁API响应正常');
        console.log('API响应:', JSON.stringify(data, null, 2));
      } else {
        console.log('❌ 章节解锁API响应异常:', response.status);
      }
    } catch (error) {
      console.log('❌ 章节解锁API连接失败:', error.message);
    }
    
    // 5. 检查示例数据
    console.log('\n5. 检查示例数据:');
    
    // 检查是否有锁定的章节
    const lockedChapters = await new Promise((resolve, reject) => {
      db.query('SELECT id, title, is_locked, is_premium FROM chapter WHERE is_locked = 1 LIMIT 5', (err, results) => {
        if (err) reject(err);
        else resolve(results);
      });
    });
    
    console.log(`找到 ${lockedChapters.length} 个锁定章节:`);
    lockedChapters.forEach(chapter => {
      console.log(`- 章节 ${chapter.id}: ${chapter.title} (锁定: ${chapter.is_locked}, 高级: ${chapter.is_premium})`);
    });
    
    // 检查用户数据
    const users = await new Promise((resolve, reject) => {
      db.query('SELECT id, username, points, karma_count FROM user LIMIT 3', (err, results) => {
        if (err) reject(err);
        else resolve(results);
      });
    });
    
    console.log(`\n找到 ${users.length} 个用户:`);
    users.forEach(user => {
      console.log(`- 用户 ${user.id}: ${user.username} (钥匙: ${user.points}, 业力: ${user.karma_count})`);
    });
    
    console.log('\n✅ 章节解锁功能集成测试完成！');
    
  } catch (error) {
    console.error('❌ 测试失败:', error);
  } finally {
    db.end();
  }
}

// 开始测试
testChapterUnlockIntegration();
