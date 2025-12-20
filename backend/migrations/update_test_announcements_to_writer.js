// 更新测试公告为作者端
const mysql = require('mysql2/promise');

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '123456',
  database: process.env.DB_NAME || 'kongfuworld',
  charset: 'utf8mb4'
};

(async () => {
  let db;
  try {
    db = await mysql.createConnection(dbConfig);
    const [result] = await db.execute(
      `UPDATE homepage_announcements 
       SET target_audience = 'writer' 
       WHERE title IN ('Writer Program Update', 'Copyright Operations Update', 'Writer Achievement System Launched')`
    );
    console.log(`已更新 ${result.affectedRows} 条公告为作者端`);
    
    // 验证
    const [rows] = await db.query(
      `SELECT id, title, target_audience FROM homepage_announcements 
       WHERE title IN ('Writer Program Update', 'Copyright Operations Update', 'Writer Achievement System Launched')`
    );
    console.log('\n更新后的数据：');
    rows.forEach(row => {
      console.log(`  - ID: ${row.id}, Title: "${row.title}", Audience: ${row.target_audience}`);
    });
  } catch (error) {
    console.error('更新失败:', error);
    process.exit(1);
  } finally {
    if (db) await db.end();
  }
})();

