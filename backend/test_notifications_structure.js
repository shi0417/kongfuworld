// 测试 notifications 表结构修改
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

// 检查 notifications 表结构
const checkTableStructure = () => {
  const sql = `DESCRIBE notifications`;
  
  db.query(sql, (err, results) => {
    if (err) {
      console.error('检查表结构失败:', err);
    } else {
      console.log('notifications 表结构:');
      results.forEach(field => {
        console.log(`- ${field.Field}: ${field.Type} ${field.Null === 'YES' ? '(可空)' : '(不可空)'} ${field.Default ? `默认值: ${field.Default}` : ''}`);
      });
      
      // 检查是否还有 unlock_at 字段
      const hasUnlockAt = results.some(field => field.Field === 'unlock_at');
      const hasUpdatedAt = results.some(field => field.Field === 'updated_at');
      
      console.log(`\n字段检查:`);
      console.log(`- unlock_at 字段: ${hasUnlockAt ? '存在' : '已删除'}`);
      console.log(`- updated_at 字段: ${hasUpdatedAt ? '已添加' : '不存在'}`);
    }
    
    // 关闭数据库连接
    db.end();
  });
};

checkTableStructure();
