const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

async function dropTables() {
  const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '123456',
    database: process.env.DB_NAME || 'kongfuworld',
    charset: 'utf8mb4',
    multipleStatements: true
  };

  let connection;
  try {
    connection = await mysql.createConnection(dbConfig);
    
    // 检查旧表是否存在以及数据量
    console.log('检查旧表数据...');
    const [authorIncomeMonthly] = await connection.query('SELECT COUNT(*) as count FROM author_income_monthly');
    const [authorPayout] = await connection.query('SELECT COUNT(*) as count FROM author_payout');
    const [authorPayoutItem] = await connection.query('SELECT COUNT(*) as count FROM author_payout_item');
    const [authorPayoutAccount] = await connection.query('SELECT COUNT(*) as count FROM author_payout_account');
    
    console.log('\n旧表数据统计:');
    console.log(`  author_income_monthly: ${authorIncomeMonthly[0].count} 条记录`);
    console.log(`  author_payout: ${authorPayout[0].count} 条记录`);
    console.log(`  author_payout_item: ${authorPayoutItem[0].count} 条记录`);
    console.log(`  author_payout_account: ${authorPayoutAccount[0].count} 条记录`);
    
    const totalRecords = authorIncomeMonthly[0].count + authorPayout[0].count + 
                         authorPayoutItem[0].count + authorPayoutAccount[0].count;
    
    if (totalRecords > 0) {
      console.log(`\n⚠️  警告：旧表中共有 ${totalRecords} 条记录！`);
      console.log('如果这些数据需要保留，请先运行 migrate_old_settlement_data.js 迁移数据。');
      console.log('继续删除旧表...\n');
    }
    
    // 读取SQL文件
    const sqlFile = path.join(__dirname, 'drop_old_settlement_tables.sql');
    const sql = fs.readFileSync(sqlFile, 'utf8');
    
    // 执行SQL
    await connection.query(sql);
    
    console.log('\n✅ 所有旧表删除成功！');
    
    // 验证表是否已删除
    const [tables] = await connection.query(`
      SELECT TABLE_NAME 
      FROM information_schema.TABLES 
      WHERE TABLE_SCHEMA = ? 
      AND TABLE_NAME IN (
        'author_income_monthly',
        'author_payout',
        'author_payout_item',
        'author_payout_account'
      )
    `, [dbConfig.database]);
    
    if (tables.length === 0) {
      console.log('\n✅ 确认：所有旧表已成功删除');
    } else {
      console.log('\n⚠️  以下表仍然存在:');
      tables.forEach(table => {
        console.log(`  - ${table.TABLE_NAME}`);
      });
    }
    
  } catch (error) {
    console.error('❌ 删除表失败:', error.message);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

dropTables();

