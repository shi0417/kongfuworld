const mysql = require('mysql2/promise');

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '123456',
  database: process.env.DB_NAME || 'kongfuworld'
};

async function checkPenNameConstraint() {
  let connection;
  try {
    connection = await mysql.createConnection(dbConfig);
    
    // 检查索引
    const [indexes] = await connection.execute(
      "SHOW INDEXES FROM user WHERE Column_name = 'pen_name'"
    );
    
    console.log('📊 pen_name字段的索引信息:');
    console.log(JSON.stringify(indexes, null, 2));
    
    // 检查是否有唯一约束
    const hasUnique = indexes.some(idx => idx.Non_unique === 0);
    
    if (hasUnique) {
      console.log('\n✅ pen_name字段已有唯一约束');
    } else {
      console.log('\n⚠️  pen_name字段没有唯一约束，需要添加');
      console.log('执行以下SQL添加唯一约束:');
      console.log('ALTER TABLE `user` ADD UNIQUE KEY `unique_pen_name` (`pen_name`);');
    }
    
  } catch (error) {
    console.error('检查失败:', error);
  } finally {
    if (connection) await connection.end();
  }
}

checkPenNameConstraint();

