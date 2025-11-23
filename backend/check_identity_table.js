const mysql = require('mysql2/promise');

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '123456',
  database: process.env.DB_NAME || 'kongfuworld'
};

async function checkTable() {
  let connection;
  try {
    connection = await mysql.createConnection(dbConfig);
    
    // 检查表是否存在
    const [tables] = await connection.execute(
      "SHOW TABLES LIKE 'user_identity_verifications'"
    );
    
    console.log('表存在:', tables.length > 0);
    
    if (tables.length > 0) {
      const [cols] = await connection.execute('DESCRIBE user_identity_verifications');
      console.log('\n表结构:');
      cols.forEach(col => {
        console.log(`  ${col.Field}: ${col.Type} ${col.Null === 'YES' ? '(可空)' : '(非空)'}`);
      });
    } else {
      console.log('\n⚠️  表不存在，需要运行迁移脚本');
    }
    
  } catch (error) {
    console.error('检查失败:', error.message);
  } finally {
    if (connection) await connection.end();
  }
}

checkTable();

