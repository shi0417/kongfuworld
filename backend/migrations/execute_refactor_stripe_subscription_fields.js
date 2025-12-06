const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

async function executeMigration() {
  let connection;
  try {
    // 读取 SQL 文件
    const sqlFile = path.join(__dirname, '20251205_refactor_stripe_subscription_fields.sql');
    const sql = fs.readFileSync(sqlFile, 'utf8');

    // 创建数据库连接
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '123456',
      database: process.env.DB_NAME || 'kongfuworld',
      multipleStatements: true // 允许执行多条 SQL 语句
    });

    console.log('开始执行 Stripe Champion 订阅系统重构迁移...\n');

    // 执行 SQL
    await connection.query(sql);

    console.log('✅ 迁移执行成功！');
    console.log('\n迁移内容：');
    console.log('1. user_champion_subscription_record: transaction_id → stripe_subscription_id');
    console.log('2. user_champion_subscription: 新增 stripe_customer_id');
    console.log('3. payment_record: 新增 stripe_subscription_id, stripe_payment_intent_id, stripe_customer_id');
    console.log('4. 创建相关索引');

  } catch (error) {
    console.error('❌ 迁移执行失败:', error);
    throw error;
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  executeMigration()
    .then(() => {
      console.log('\n迁移完成！');
      process.exit(0);
    })
    .catch((error) => {
      console.error('迁移失败:', error);
      process.exit(1);
    });
}

module.exports = executeMigration;

