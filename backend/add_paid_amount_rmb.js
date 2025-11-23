// 为 user_income_monthly 表添加 paid_amount_rmb 字段
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

// 加载环境变量
try {
  require('dotenv').config({ path: './kongfuworld.env' });
} catch (error) {
  try {
    require('dotenv').config({ path: '../kongfuworld.env' });
  } catch (error2) {
    console.log('dotenv not available, using default values');
  }
}

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'kongfuworld',
  multipleStatements: true
};

async function addPaidAmountRmbField() {
  let connection;
  try {
    console.log('正在连接数据库...');
    connection = await mysql.createConnection(dbConfig);
    console.log('数据库连接成功');

    // 检查字段是否已存在
    const [columns] = await connection.query(
      `SELECT COLUMN_NAME 
       FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = ? 
       AND TABLE_NAME = 'user_income_monthly' 
       AND COLUMN_NAME = 'paid_amount_rmb'`,
      [dbConfig.database]
    );

    if (columns.length > 0) {
      console.log('字段 paid_amount_rmb 已存在，跳过添加');
      return;
    }

    // 添加字段
    console.log('正在添加 paid_amount_rmb 字段...');
    await connection.query(`
      ALTER TABLE user_income_monthly 
      ADD COLUMN paid_amount_rmb DECIMAL(10, 6) DEFAULT 0.000000 COMMENT '已支付金额（人民币）' AFTER paid_amount_usd
    `);
    
    console.log('✓ 字段 paid_amount_rmb 添加成功');

    // 更新现有数据：如果有支付记录且币种是CNY，更新paid_amount_rmb
    console.log('正在更新现有数据...');
    const [updateResult] = await connection.query(`
      UPDATE user_income_monthly uim
      INNER JOIN user_payout up ON uim.payout_id = up.id
      SET uim.paid_amount_rmb = up.payout_amount,
          uim.paid_amount_usd = 0
      WHERE up.payout_currency = 'CNY' 
        AND uim.payout_status = 'paid'
        AND uim.paid_amount_rmb = 0
    `);
    
    console.log(`✓ 已更新 ${updateResult.affectedRows} 条记录`);

    console.log('数据库迁移完成！');
  } catch (error) {
    console.error('数据库迁移失败:', error);
    throw error;
  } finally {
    if (connection) {
      await connection.end();
      console.log('数据库连接已关闭');
    }
  }
}

// 执行迁移
addPaidAmountRmbField()
  .then(() => {
    console.log('迁移脚本执行完成');
    process.exit(0);
  })
  .catch((error) => {
    console.error('迁移脚本执行失败:', error);
    process.exit(1);
  });

