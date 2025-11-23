// 测试通知功能
const mysql = require('mysql2');

// 数据库连接配置
const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: '123456',
  database: 'kongfuworld',
  charset: 'utf8mb4'
});

async function testNotificationsAPI() {
  try {
    console.log('🧪 测试通知API功能...\n');
    
    // 1. 检查用户设置
    console.log('1. 检查用户设置:');
    const [users] = await new Promise((resolve, reject) => {
      db.query('SELECT id, settings_json FROM user WHERE id = 1', (err, results) => {
        if (err) reject(err);
        else resolve(results);
      });
    });
    
    if (users.length > 0) {
      const user = users[0];
      let settings = {};
      if (user.settings_json) {
        try {
          settings = typeof user.settings_json === 'string' 
            ? JSON.parse(user.settings_json) 
            : user.settings_json;
        } catch (e) {
          console.log('解析设置失败:', e.message);
        }
      }
      console.log('用户设置:', settings);
      console.log('解锁更新通知:', settings.notify_unlock_updates);
    }
    
    // 2. 检查时间解锁记录
    console.log('\n2. 检查时间解锁记录:');
    const timeUnlocks = await new Promise((resolve, reject) => {
      db.query(`
        SELECT 
          cu.id,
          cu.user_id,
          cu.chapter_id,
          cu.unlock_at,
          cu.status,
          cu.created_at,
          n.title as novel_title,
          c.chapter_number,
          c.title as chapter_title,
          c.novel_id
        FROM chapter_unlocks cu
        JOIN chapter c ON cu.chapter_id = c.id
        JOIN novel n ON c.novel_id = n.id
        WHERE cu.user_id = 1 
          AND cu.unlock_method = 'time_unlock'
          AND cu.status IN ('pending', 'unlocked')
        ORDER BY cu.created_at DESC
        LIMIT 5
      `, (err, results) => {
        if (err) reject(err);
        else resolve(results);
      });
    });
    
    console.log('时间解锁记录数量:', timeUnlocks.length);
    timeUnlocks.forEach((record, index) => {
      console.log(`${index + 1}. ${record.novel_title} - Chapter ${record.chapter_number}: ${record.chapter_title}`);
      console.log(`   状态: ${record.status}, 解锁时间: ${record.unlock_at}`);
    });
    
    // 3. 检查普通通知
    console.log('\n3. 检查普通通知:');
    const notifications = await new Promise((resolve, reject) => {
      db.query(`
        SELECT 
          n.id,
          n.novel_id,
          n.chapter_id,
          n.novel_title,
          n.chapter_title,
          n.message,
          n.type,
          n.link,
          n.is_read,
          n.created_at,
          n.unlock_at
        FROM notifications n 
        WHERE n.user_id = 1
        ORDER BY n.created_at DESC 
        LIMIT 5
      `, (err, results) => {
        if (err) reject(err);
        else resolve(results);
      });
    });
    
    console.log('普通通知数量:', notifications.length);
    notifications.forEach((notification, index) => {
      console.log(`${index + 1}. ${notification.novel_title} - ${notification.type}`);
      console.log(`   消息: ${notification.message}`);
    });
    
    // 4. 模拟API请求
    console.log('\n4. 模拟API请求:');
    try {
      const response = await fetch('http://localhost:5000/api/user/1/notifications?page=1&type=all&limit=10');
      const data = await response.json();
      
      if (data.success) {
        console.log('API请求成功');
        console.log('通知总数:', data.data.notifications.length);
        console.log('分页信息:', data.data.pagination);
        
        data.data.notifications.forEach((notification, index) => {
          console.log(`${index + 1}. ${notification.novel_title}`);
          if (notification.chapter_title) {
            console.log(`   章节: ${notification.chapter_title}`);
          }
          console.log(`   类型: ${notification.type}`);
          console.log(`   消息: ${notification.message}`);
          console.log(`   时间: ${notification.timeAgo}`);
          if (notification.isTimeUnlock) {
            console.log(`   时间解锁: ${notification.isUnlocked ? '已解锁' : '待解锁'}`);
          }
          console.log('');
        });
      } else {
        console.log('API请求失败:', data.message);
      }
    } catch (error) {
      console.log('API请求错误:', error.message);
    }
    
    console.log('\n✅ 通知功能测试完成！');
    
  } catch (error) {
    console.error('测试过程中出错:', error);
  } finally {
    db.end();
  }
}

// 开始测试
testNotificationsAPI();
