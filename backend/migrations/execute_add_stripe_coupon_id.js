const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

// 加载环境变量
try {
  require('dotenv').config({ path: './kongfuworld.env' });
} catch (error) {
  console.log('dotenv not available, using default values');
}

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '123456',
  database: process.env.DB_NAME || 'kongfuworld',
  multipleStatements: true
};

async function executeMigration() {
  let connection;
  try {
    connection = await mysql.createConnection(dbConfig);
    console.log('数据库连接成功');

    const sqlFile = path.join(__dirname, '20251204_add_stripe_coupon_id_to_pricing_promotion.sql');
    const sql = fs.readFileSync(sqlFile, 'utf8');

    console.log('开始执行迁移...');
    await connection.query(sql);
    console.log('迁移执行成功！');

  } catch (error) {
    console.error('迁移执行失败:', error);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

executeMigration();

