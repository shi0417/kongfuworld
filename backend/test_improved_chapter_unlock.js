// 测试改进后的章节解锁功能
const mysql = require('mysql2');

// 数据库连接配置
const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: '123456',
  database: 'kongfuworld',
  charset: 'utf8mb4'
});

async function testImprovedChapterUnlock() {
  try {
    console.log('🧪 测试改进后的章节解锁功能...\n');
    
    // 1. 测试章节解锁API
    console.log('1. 测试章节解锁API:');
    try {
      const response = await fetch('http://localhost:5000/api/chapter-unlock/status/844/1');
      if (response.ok) {
        const data = await response.json();
        console.log('✅ 章节解锁API响应正常');
        console.log('章节信息:', {
          title: data.data.chapter.title,
          is_premium: data.data.chapter.is_premium,
          key_cost: data.data.chapter.key_cost,
          unlock_price: data.data.chapter.unlock_price,
          free_unlock_time: data.data.chapter.free_unlock_time
        });
        console.log('用户信息:', {
          points: data.data.user.points,
          karma_count: data.data.user.karma_count,
          is_subscribed: data.data.user.is_subscribed
        });
        console.log('解锁状态:', {
          is_unlocked: data.data.unlock_status.is_unlocked,
          can_unlock_with_key: data.data.unlock_status.can_unlock_with_key,
          can_buy_with_karma: data.data.unlock_status.can_buy_with_karma,
          is_free: data.data.unlock_status.is_free,
          time_until_free: data.data.unlock_status.time_until_free
        });
      } else {
        console.log('❌ 章节解锁API响应异常:', response.status);
      }
    } catch (error) {
      console.log('❌ 章节解锁API连接失败:', error.message);
    }
    
    // 2. 检查章节数据
    console.log('\n2. 检查章节数据:');
    const chapters = await new Promise((resolve, reject) => {
      db.query(`
        SELECT 
          c.id, c.title, c.is_locked, c.is_premium, 
          c.key_cost, c.unlock_price, c.free_unlock_time,
          n.title as novel_title
        FROM chapter c
        LEFT JOIN novel n ON c.novel_id = n.id
        WHERE c.is_locked = 1 
        ORDER BY c.id DESC 
        LIMIT 3
      `, (err, results) => {
        if (err) reject(err);
        else resolve(results);
      });
    });
    
    console.log(`找到 ${chapters.length} 个锁定章节:`);
    chapters.forEach(chapter => {
      console.log(`- 章节 ${chapter.id}: ${chapter.title}`);
      console.log(`  小说: ${chapter.novel_title}`);
      console.log(`  锁定: ${chapter.is_locked}, 高级: ${chapter.is_premium}`);
      console.log(`  钥匙成本: ${chapter.key_cost}, 解锁价格: ${chapter.unlock_price}`);
      console.log(`  免费解锁时间: ${chapter.free_unlock_time || '无'}`);
      console.log('');
    });
    
    // 3. 检查用户数据
    console.log('3. 检查用户数据:');
    const users = await new Promise((resolve, reject) => {
      db.query(`
        SELECT id, username, points, karma_count, 
               subscription_status, subscription_end_date
        FROM user 
        LIMIT 3
      `, (err, results) => {
        if (err) reject(err);
        else resolve(results);
      });
    });
    
    console.log(`找到 ${users.length} 个用户:`);
    users.forEach(user => {
      console.log(`- 用户 ${user.id}: ${user.username}`);
      console.log(`  钥匙: ${user.points}, Golden Karma: ${user.karma_count}`);
      console.log(`  订阅状态: ${user.subscription_status}`);
      console.log(`  订阅结束时间: ${user.subscription_end_date || '无'}`);
      console.log('');
    });
    
    // 4. 测试时间解锁功能
    console.log('4. 测试时间解锁功能:');
    const now = new Date();
    const futureTime = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24小时后
    
    // 更新一个章节的免费解锁时间
    await new Promise((resolve, reject) => {
      db.query(`
        UPDATE chapter 
        SET free_unlock_time = ? 
        WHERE id = 844
      `, [futureTime.toISOString().slice(0, 19).replace('T', ' ')], (err, result) => {
        if (err) reject(err);
        else resolve(result);
      });
    });
    
    console.log('✅ 已设置章节844的免费解锁时间为24小时后');
    
    // 重新测试API
    try {
      const response = await fetch('http://localhost:5000/api/chapter-unlock/status/844/1');
      if (response.ok) {
        const data = await response.json();
        console.log('✅ 时间解锁功能测试:');
        console.log(`免费解锁时间: ${data.data.chapter.free_unlock_time}`);
        console.log(`倒计时: ${data.data.unlock_status.time_until_free}`);
        console.log(`是否免费: ${data.data.unlock_status.is_free}`);
      }
    } catch (error) {
      console.log('❌ 时间解锁功能测试失败:', error.message);
    }
    
    console.log('\n✅ 改进后的章节解锁功能测试完成！');
    
  } catch (error) {
    console.error('❌ 测试失败:', error);
  } finally {
    db.end();
  }
}

// 开始测试
testImprovedChapterUnlock();
