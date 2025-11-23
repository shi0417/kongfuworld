// 为 chapter_unlocks 表添加 updated_at 字段
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

// 添加 updated_at 字段
const addUpdatedAtSql = `ALTER TABLE chapter_unlocks 
ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间'`;

db.query(addUpdatedAtSql, (err, result) => {
  if (err) {
    if (err.code === 'ER_DUP_FIELDNAME') {
      console.log('updated_at 字段已存在，跳过添加');
    } else {
      console.error('添加 updated_at 字段失败:', err);
    }
  } else {
    console.log('成功为 chapter_unlocks 表添加 updated_at 字段');
  }
  
  // 关闭数据库连接
  db.end();
});
