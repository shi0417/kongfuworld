// 检查用户ID=1的数据
const mysql = require('mysql2');
require('dotenv').config({ path: './kongfuworld.env' });

// 创建数据库连接
const db = mysql.createConnection({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '123456',
  database: process.env.DB_NAME || 'kongfuworld',
  charset: 'utf8mb4'
});

// 连接数据库
db.connect((err) => {
  if (err) {
    console.error('数据库连接失败:', err);
    return;
  }
  console.log('数据库连接成功');
});

// 检查用户ID=1的设置
const checkUserSettings = () => {
  const sql = `SELECT id, settings_json FROM user WHERE id = 1`;
  
  db.query(sql, (err, results) => {
    if (err) {
      console.error('查询用户设置失败:', err);
    } else {
      console.log('用户ID=1的设置:');
      if (results.length > 0) {
        const user = results[0];
        console.log('用户ID:', user.id);
        console.log('设置JSON:', user.settings_json);
        
        if (user.settings_json) {
          try {
            const settings = typeof user.settings_json === 'string' 
              ? JSON.parse(user.settings_json) 
              : user.settings_json;
            console.log('解析后的设置:', settings);
            console.log('notify_unlock_updates:', settings.notify_unlock_updates);
          } catch (e) {
            console.error('解析设置失败:', e);
          }
        }
      } else {
        console.log('用户ID=1不存在');
      }
    }
    
    // 检查notifications表中的数据
    checkNotifications();
  });
};

// 检查notifications表中的数据
const checkNotifications = () => {
  const sql = `SELECT COUNT(*) as count FROM notifications WHERE user_id = 1`;
  
  db.query(sql, (err, results) => {
    if (err) {
      console.error('查询notifications失败:', err);
    } else {
      console.log('用户ID=1的notifications数量:', results[0].count);
    }
    
    // 检查chapter_unlocks表中的数据
    checkChapterUnlocks();
  });
};

// 检查chapter_unlocks表中的数据
const checkChapterUnlocks = () => {
  const sql = `SELECT COUNT(*) as count FROM chapter_unlocks WHERE user_id = 1`;
  
  db.query(sql, (err, results) => {
    if (err) {
      console.error('查询chapter_unlocks失败:', err);
    } else {
      console.log('用户ID=1的chapter_unlocks数量:', results[0].count);
    }
    
    // 关闭数据库连接
    db.end();
  });
};

checkUserSettings();
