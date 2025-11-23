// 测试章节解锁系统
const mysql = require('mysql2');

// 数据库连接配置
const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: '123456',
  database: 'kongfuworld',
  charset: 'utf8mb4'
});

async function testChapterUnlockSystem() {
  try {
    console.log('🧪 测试章节解锁系统...\n');
    
    // 1. 检查数据库表
    console.log('1. 检查数据库表:');
    const tables = ['chapter_unlocks', 'chapter_access_log'];
    
    for (const table of tables) {
      const exists = await new Promise((resolve, reject) => {
        db.query(`SHOW TABLES LIKE '${table}'`, (err, results) => {
          if (err) reject(err);
          else resolve(results.length > 0);
        });
      });
      
      console.log(`   ${exists ? '✓' : '❌'} ${table} 表`);
    }
    
    // 2. 检查chapter表的新字段
    console.log('\n2. 检查chapter表的新字段:');
    const chapterFields = await new Promise((resolve, reject) => {
      db.query(`
        SELECT COLUMN_NAME, DATA_TYPE, COLUMN_DEFAULT 
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_NAME = 'chapter' 
        AND COLUMN_NAME IN ('is_premium', 'free_unlock_time', 'key_cost', 'unlock_price', 'unlock_priority')
      `, (err, results) => {
        if (err) reject(err);
        else resolve(results);
      });
    });
    
    chapterFields.forEach(field => {
      console.log(`   ✓ ${field.COLUMN_NAME}: ${field.DATA_TYPE} (默认: ${field.COLUMN_DEFAULT})`);
    });
    
    // 3. 检查user表的新字段
    console.log('\n3. 检查user表的新字段:');
    const userFields = await new Promise((resolve, reject) => {
      db.query(`
        SELECT COLUMN_NAME, DATA_TYPE, COLUMN_DEFAULT 
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_NAME = 'user' 
        AND COLUMN_NAME IN ('karma_count', 'subscription_status', 'subscription_end_date')
      `, (err, results) => {
        if (err) reject(err);
        else resolve(results);
      });
    });
    
    userFields.forEach(field => {
      console.log(`   ✓ ${field.COLUMN_NAME}: ${field.DATA_TYPE} (默认: ${field.COLUMN_DEFAULT})`);
    });
    
    // 4. 测试章节解锁状态API
    console.log('\n4. 测试章节解锁状态API:');
    try {
      const response = await fetch('http://localhost:5000/api/chapter-unlock/status/1/1');
      const data = await response.json();
      
      if (data.success) {
        console.log('   ✓ 解锁状态API正常');
        console.log(`   章节: ${data.data.chapter.title}`);
        console.log(`   用户钥匙: ${data.data.user.points}`);
        console.log(`   用户业力: ${data.data.user.karma_count}`);
        console.log(`   可钥匙解锁: ${data.data.unlock_status.can_unlock_with_key}`);
        console.log(`   可业力购买: ${data.data.unlock_status.can_buy_with_karma}`);
      } else {
        console.log('   ❌ 解锁状态API失败:', data.message);
      }
    } catch (error) {
      console.log('   ❌ 解锁状态API错误:', error.message);
    }
    
    // 5. 跳过用户设置测试（user_settings表已删除）
    console.log('\n5. 跳过用户设置测试（user_settings表已删除）...');
    
    // 6. 模拟解锁操作
    console.log('\n6. 模拟解锁操作:');
    
    // 检查用户当前钥匙数量
    const user = await new Promise((resolve, reject) => {
      db.query('SELECT points, karma_count FROM user WHERE id = 1', (err, results) => {
        if (err) reject(err);
        else resolve(results[0]);
      });
    });
    
    console.log(`   用户当前钥匙: ${user.points}`);
    console.log(`   用户当前业力: ${user.karma_count}`);
    
    // 7. 创建测试章节
    console.log('\n7. 创建测试付费章节:');
    await new Promise((resolve, reject) => {
      db.query(`
        INSERT INTO chapter (novel_id, volume_id, title, content, chapter_number, is_premium, key_cost, unlock_price, unlock_priority)
        VALUES (1, 1, 'Test Premium Chapter', 'This is a premium chapter content...', 999, 1, 2, 50, 'key')
      `, (err, result) => {
        if (err && !err.message.includes('Duplicate entry')) {
          reject(err);
        } else {
          resolve(result);
        }
      });
    });
    console.log('   ✓ 测试付费章节创建完成');
    
    console.log('\n✅ 章节解锁系统测试完成！');
    
    // 8. 显示API端点
    console.log('\n📋 可用的API端点:');
    console.log('   GET  /api/chapter-unlock/status/:chapterId/:userId - 获取解锁状态');
    console.log('   POST /api/chapter-unlock/unlock-with-key/:chapterId/:userId - 钥匙解锁');
    console.log('   POST /api/chapter-unlock/buy-with-karma/:chapterId/:userId - 业力购买');
    console.log('   GET  /api/chapter-unlock/history/:userId - 获取解锁历史');
    
  } catch (error) {
    console.error('测试过程中出错:', error);
  } finally {
    db.end();
  }
}

// 开始测试
testChapterUnlockSystem();
