/**
 * 执行迁移脚本：20251204_add_stripe_subscription_fields_to_user_champion_subscription.sql
 * 为 user_champion_subscription 表添加 Stripe 订阅相关字段
 * 
 * 使用方法：
 * node backend/migrations/execute_add_stripe_subscription_fields.js
 */

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
  charset: 'utf8mb4',
  multipleStatements: true
};

async function executeMigration() {
  let connection;
  
  try {
    console.log('🔌 正在连接数据库...');
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ 数据库连接成功\n');
    
    // 读取迁移SQL文件
    const sqlPath = path.join(__dirname, '20251204_add_stripe_subscription_fields_to_user_champion_subscription.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    console.log('📝 开始执行迁移脚本：20251204_add_stripe_subscription_fields_to_user_champion_subscription.sql\n');
    console.log('将执行以下操作：');
    console.log('  1. 添加 stripe_subscription_id 字段');
    console.log('  2. 添加 cancel_at_period_end 字段');
    console.log('  3. 添加 cancelled_at 字段');
    console.log('  4. 创建 idx_stripe_subscription_id 索引\n');
    
    // 检查字段是否已存在
    console.log('🔍 检查当前状态...');
    const [columns] = await connection.execute(
      `SELECT COLUMN_NAME, COLUMN_TYPE, COLUMN_DEFAULT, COLUMN_COMMENT
       FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = ? 
       AND TABLE_NAME = 'user_champion_subscription'
       AND COLUMN_NAME IN ('stripe_subscription_id', 'cancel_at_period_end', 'cancelled_at')`,
      [dbConfig.database]
    );
    
    const existingFields = columns.map(col => col.COLUMN_NAME);
    const allFields = ['stripe_subscription_id', 'cancel_at_period_end', 'cancelled_at'];
    const missingFields = allFields.filter(field => !existingFields.includes(field));
    
    if (existingFields.length > 0) {
      console.log(`⚠️  以下字段已存在: ${existingFields.join(', ')}`);
    }
    
    if (missingFields.length > 0) {
      console.log(`✓ 以下字段不存在，将添加: ${missingFields.join(', ')}`);
    } else {
      console.log('✅ 所有字段已存在，检查索引...');
      
      // 检查索引是否已存在
      const [indexes] = await connection.execute(
        `SELECT INDEX_NAME 
         FROM INFORMATION_SCHEMA.STATISTICS 
         WHERE TABLE_SCHEMA = ? 
         AND TABLE_NAME = 'user_champion_subscription'
         AND INDEX_NAME = 'idx_stripe_subscription_id'`,
        [dbConfig.database]
      );
      
      if (indexes.length > 0) {
        console.log('✅ 索引 idx_stripe_subscription_id 已存在');
        console.log('\n✅ 迁移已完成（所有字段和索引已存在）');
        return;
      } else {
        console.log('⚠️  索引不存在，将创建索引');
      }
    }
    
    console.log('\n⚙️  执行SQL语句...\n');
    
    // 执行SQL（使用 query 而不是 execute，因为可能包含多条语句）
    await connection.query(sql);
    
    console.log('✅ 迁移脚本执行成功！');
    console.log('📊 验证迁移结果...\n');
    
    // 验证字段是否已添加
    const [verifyColumns] = await connection.execute(
      `SELECT COLUMN_NAME, COLUMN_TYPE, COLUMN_DEFAULT, COLUMN_COMMENT
       FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = ? 
       AND TABLE_NAME = 'user_champion_subscription'
       AND COLUMN_NAME IN ('stripe_subscription_id', 'cancel_at_period_end', 'cancelled_at')
       ORDER BY COLUMN_NAME`,
      [dbConfig.database]
    );
    
    if (verifyColumns.length === 3) {
      console.log('✅ 所有字段已成功添加：');
      verifyColumns.forEach(col => {
        console.log(`   - ${col.COLUMN_NAME}: ${col.COLUMN_TYPE} (默认值: ${col.COLUMN_DEFAULT || 'NULL'})`);
        console.log(`     注释: ${col.COLUMN_COMMENT || '无'}`);
      });
      
      // 验证索引
      const [verifyIndexes] = await connection.execute(
        `SELECT INDEX_NAME, COLUMN_NAME
         FROM INFORMATION_SCHEMA.STATISTICS 
         WHERE TABLE_SCHEMA = ? 
         AND TABLE_NAME = 'user_champion_subscription'
         AND INDEX_NAME = 'idx_stripe_subscription_id'`,
        [dbConfig.database]
      );
      
      if (verifyIndexes.length > 0) {
        console.log(`\n✅ 索引 idx_stripe_subscription_id 已成功创建`);
        console.log(`   索引字段: ${verifyIndexes[0].COLUMN_NAME}`);
      }
      
      // 检查现有记录的数量
      const [count] = await connection.execute(
        `SELECT COUNT(*) as total FROM user_champion_subscription`
      );
      console.log(`\n📊 当前 user_champion_subscription 表共有 ${count[0].total} 条记录`);
      
      console.log('\n✅ 迁移完成！');
    } else {
      console.warn(`⚠️  只找到 ${verifyColumns.length}/3 个字段，请检查迁移结果`);
      verifyColumns.forEach(col => {
        console.log(`   - ${col.COLUMN_NAME}`);
      });
    }
    
  } catch (error) {
    console.error('\n❌ 迁移失败:', error.message);
    
    if (error.code === 'ER_DUP_FIELDNAME') {
      console.error('   错误：字段已存在');
    } else if (error.code === 'ER_DUP_KEYNAME') {
      console.error('   错误：索引已存在');
    } else if (error.code === 'ER_BAD_FIELD_ERROR') {
      console.error('   错误：表或字段不存在');
    } else {
      console.error('   错误详情:', error);
    }
    
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n🔌 数据库连接已关闭');
    }
  }
}

// 执行迁移
executeMigration();

