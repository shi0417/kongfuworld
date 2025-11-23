// 创建review_dislike表
const mysql = require('mysql2/promise');

(async () => {
  const conn = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '123456',
    database: 'kongfuworld'
  });

  try {
    // 创建review_dislike表
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS review_dislike (
        id INT NOT NULL AUTO_INCREMENT,
        review_id INT NOT NULL,
        user_id INT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY unique_dislike (review_id, user_id),
        FOREIGN KEY (review_id) REFERENCES review(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES user(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    
    console.log('✅ review_dislike表创建成功！');
  } catch (error) {
    console.error('❌ 创建表失败:', error);
  } finally {
    await conn.end();
  }
})();
