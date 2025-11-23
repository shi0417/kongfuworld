const mysql = require('mysql2/promise');

async function createReviewLikeTable() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '123456',
    database: 'kongfuworld'
  });

  try {
    // 创建评论点赞表
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS \`review_like\` (
        \`id\` int NOT NULL AUTO_INCREMENT,
        \`review_id\` int NOT NULL,
        \`user_id\` int NOT NULL,
        \`created_at\` datetime DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`unique_like\` (\`review_id\`, \`user_id\`),
        KEY \`review_id\` (\`review_id\`),
        KEY \`user_id\` (\`user_id\`),
        CONSTRAINT \`review_like_ibfk_1\` FOREIGN KEY (\`review_id\`) REFERENCES \`review\` (\`id\`) ON DELETE CASCADE,
        CONSTRAINT \`review_like_ibfk_2\` FOREIGN KEY (\`user_id\`) REFERENCES \`user\` (\`id\`) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    console.log('✅ review_like 表创建成功');
  } catch (error) {
    console.error('❌ 创建表失败:', error);
  } finally {
    await connection.end();
  }
}

createReviewLikeTable();
