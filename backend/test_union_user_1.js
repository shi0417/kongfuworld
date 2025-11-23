// 测试用户ID=1的UNION查询
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

// 测试UNION查询
const testUnionQuery = () => {
  const userId = 1;
  const unionQuery = `
    (
      SELECT 
        CONCAT('time_unlock_', cu.id) as id,
        cu.user_id,
        cu.chapter_id,
        cu.unlock_at,
        cu.status,
        cu.created_at,
        cu.updated_at,
        cu.readed,
        n.title as novel_title,
        c.chapter_number,
        c.title as chapter_title,
        c.novel_id,
        'notify_unlock_updates' as type,
        CONCAT('/novel/', c.novel_id, '/chapter/', cu.chapter_id) as link,
        cu.readed as is_read,
        CONCAT('Chapter ', c.chapter_number, ': "', c.title, '" ', 
               CASE 
                 WHEN cu.status = 'unlocked' OR cu.unlock_at <= NOW() 
                 THEN CONCAT('has been released at ', DATE_FORMAT(cu.unlock_at, '%Y/%m/%d %H:%i:%s'))
                 ELSE CONCAT('will be released at ', DATE_FORMAT(cu.unlock_at, '%Y/%m/%d %H:%i:%s'))
               END) as message,
        TIMESTAMPDIFF(HOUR, cu.created_at, NOW()) as hours_ago,
        TIMESTAMPDIFF(DAY, cu.created_at, NOW()) as days_ago,
        1 as isTimeUnlock,
        CASE WHEN cu.status = 'unlocked' OR cu.unlock_at <= NOW() THEN 1 ELSE 0 END as isUnlocked
      FROM chapter_unlocks cu
      JOIN chapter c ON cu.chapter_id = c.id
      JOIN novel n ON c.novel_id = n.id
      WHERE cu.user_id = ? 
        AND cu.unlock_method = 'time_unlock'
        AND cu.status IN ('pending', 'unlocked')
    )
    UNION ALL
    (
      SELECT 
        n.id,
        n.user_id,
        n.chapter_id,
        NULL as unlock_at,
        NULL as status,
        n.created_at,
        n.updated_at,
        NULL as readed,
        n.novel_title,
        NULL as chapter_number,
        n.chapter_title,
        n.novel_id,
        n.type,
        n.link,
        n.is_read,
        n.message,
        TIMESTAMPDIFF(HOUR, n.created_at, NOW()) as hours_ago,
        TIMESTAMPDIFF(DAY, n.created_at, NOW()) as days_ago,
        0 as isTimeUnlock,
        NULL as isUnlocked
      FROM notifications n
      WHERE n.user_id = ?
    )
    ORDER BY updated_at DESC
    LIMIT 10
  `;

  db.query(unionQuery, [userId, userId], (err, results) => {
    if (err) {
      console.error('UNION查询失败:', err);
    } else {
      console.log('UNION查询成功，结果数量:', results.length);
      console.log('前5条结果:');
      results.slice(0, 5).forEach((result, index) => {
        console.log(`${index + 1}. ID: ${result.id}, Type: ${result.type}, Title: ${result.novel_title}`);
        console.log(`   Message: ${result.message}`);
        console.log(`   Updated: ${result.updated_at}, isTimeUnlock: ${result.isTimeUnlock}`);
        console.log('---');
      });
    }
    
    // 关闭数据库连接
    db.end();
  });
};

testUnionQuery();
