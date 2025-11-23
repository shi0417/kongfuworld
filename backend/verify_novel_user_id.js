const mysql = require('mysql2/promise');
require('dotenv').config({ path: require('path').join(__dirname, 'kongfuworld.env') });

(async () => {
  let connection;
  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'wuxiaworld'
    });

    const [rows] = await connection.execute('DESCRIBE novel');
    console.log('novel 表结构:');
    console.log('字段名\t\t类型\t\t可空\t键\t默认值\t\t额外');
    console.log('─'.repeat(80));
    rows.forEach(r => {
      console.log(`${r.Field.padEnd(15)}\t${r.Type.padEnd(15)}\t${r.Null.padEnd(5)}\t${r.Key.padEnd(10)}\t${(r.Default || 'NULL').toString().padEnd(10)}\t${r.Extra || ''}`);
    });

    await connection.end();
  } catch (error) {
    console.error('错误:', error.message);
    if (connection) await connection.end();
  }
})();

