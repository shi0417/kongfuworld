// 创建comment_like表
const mysql = require('mysql2/promise');

(async () => {
  const conn = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '123456',
    database: 'kongfuworld'
  });

  try {
    // 创建comment_like表
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS comment_like (
        id INT NOT NULL AUTO_INCREMENT,
        comment_id INT NOT NULL,
        user_id INT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY unique_like (comment_id, user_id),
        FOREIGN KEY (comment_id) REFERENCES comment(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES user(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    
    console.log('✅ comment_like表创建成功！');
  } catch (error) {
    console.error('❌ 创建表失败:', error);
  } finally {
    await conn.end();
  }
})();
