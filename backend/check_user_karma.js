const mysql = require('mysql2/promise');

const dbConfig = {
  host: 'localhost',
  user: 'root',
  password: '123456',
  database: 'kongfuworld'
};

async function checkUserKarma() {
  let db;
  try {
    db = await mysql.createConnection(dbConfig);
    const [users] = await db.execute('SELECT id, username, golden_karma FROM user WHERE id = 1000');
    console.log('用户1000的Karma余额:');
    if (users.length > 0) {
      const user = users[0];
      console.log(`用户ID: ${user.id}`);
      console.log(`用户名: ${user.username}`);
      console.log(`Golden Karma: ${user.golden_karma}`);
    } else {
      console.log('用户不存在');
    }
  } catch (error) {
    console.error('查询失败:', error);
  } finally {
    if (db) await db.end();
  }
}

checkUserKarma();
