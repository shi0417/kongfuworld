// 检查用户ID=1的notifications表数据
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

// 检查notifications表中的具体数据
const checkNotificationsData = () => {
  const sql = `SELECT * FROM notifications WHERE user_id = 1`;
  
  db.query(sql, (err, results) => {
    if (err) {
      console.error('查询notifications失败:', err);
    } else {
      console.log('用户ID=1的notifications数据:');
      results.forEach((notification, index) => {
        console.log(`${index + 1}. ID: ${notification.id}, Type: ${notification.type}, Title: ${notification.novel_title}, Message: ${notification.message}`);
        console.log(`   Created: ${notification.created_at}, Updated: ${notification.updated_at}`);
      });
    }
    
    // 关闭数据库连接
    db.end();
  });
};

checkNotificationsData();
