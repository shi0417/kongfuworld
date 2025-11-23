const mysql = require('mysql2');

const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: '123456',
  database: 'kongfuworld'
});

console.log('检查通知数据...');

// 检查所有通知
db.query('SELECT * FROM notifications', (err, results) => {
  if (err) {
    console.error('查询通知失败:', err);
    return;
  }
  
  console.log('所有通知数据:');
  results.forEach((notification, index) => {
    console.log(`${index + 1}. ID: ${notification.id}, 用户ID: ${notification.user_id}, 标题: ${notification.title}, 类型: ${notification.type}`);
  });
  
  // 检查用户数据
  db.query('SELECT id, username FROM user', (err, users) => {
    if (err) {
      console.error('查询用户失败:', err);
      return;
    }
    
    console.log('\n用户数据:');
    users.forEach(user => {
      console.log(`用户ID: ${user.id}, 用户名: ${user.username}`);
    });
    
    db.end();
  });
}); 