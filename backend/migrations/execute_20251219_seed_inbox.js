// 执行站内信系统 Seed 数据
// 执行方式: node backend/migrations/execute_20251219_seed_inbox.js

const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '123456',
  database: process.env.DB_NAME || 'kongfuworld',
  charset: 'utf8mb4',
  multipleStatements: true
};

async function executeSeed() {
  let connection;
  try {
    console.log('🔍 开始执行站内信系统 Seed 数据...');
    
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ 数据库连接成功');
    
    // 检查是否存在用户和管理员
    const [users] = await connection.execute('SELECT id FROM user LIMIT 1');
    const [admins] = await connection.execute('SELECT id FROM admin LIMIT 1');
    const [novels] = await connection.execute('SELECT id FROM novel LIMIT 1');
    
    if (users.length === 0) {
      console.log('⚠️  警告：未找到用户，请先创建至少一个用户');
    }
    if (admins.length === 0) {
      console.log('⚠️  警告：未找到管理员，请先创建至少一个管理员');
    }
    if (novels.length === 0) {
      console.log('⚠️  警告：未找到小说，seed数据中的related_novel_id将设为NULL');
    }
    
    const sqlPath = path.join(__dirname, '20251219_seed_inbox_data.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    console.log('\n📝 执行SQL Seed数据...');
    await connection.query(sql);
    
    console.log('✅ Seed数据执行成功！');
    console.log('📊 创建了3个会话和15条消息（含内部备注）');
    
  } catch (error) {
    console.error('❌ Seed数据执行失败:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n🔌 数据库连接已关闭');
    }
  }
}

executeSeed();

