const mysql = require('mysql2');
require('dotenv').config();

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

// 执行SQL语句
const sql = `
  ALTER TABLE chapter_unlocks 
  ADD COLUMN readed TINYINT(1) DEFAULT 0 COMMENT '是否已阅读：0-未读，1-已读';
`;

db.query(sql, (err, result) => {
  if (err) {
    console.error('添加 readed 字段失败:', err);
  } else {
    console.log('成功添加 readed 字段到 chapter_unlocks 表');
  }
  
  // 为现有记录设置默认值
  const updateSql = `UPDATE chapter_unlocks SET readed = 0 WHERE readed IS NULL`;
  db.query(updateSql, (err, result) => {
    if (err) {
      console.error('设置默认值失败:', err);
    } else {
      console.log('成功为现有记录设置默认值');
    }
    
    // 关闭数据库连接
    db.end();
  });
});
