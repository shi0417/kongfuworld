/**
 * 执行迁移脚本：20251204_add_stripe_price_fields_to_novel_champion_tiers.sql
 * 为 novel_champion_tiers 表添加 Stripe Price 相关字段
 * 
 * 使用方法：
 * node backend/migrations/execute_add_stripe_price_fields.js
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
    
    console.log('📝 开始检查并添加字段到 novel_champion_tiers 表\n');
    console.log('将执行以下操作：');
    console.log('  1. 添加 stripe_price_id 字段（如果不存在）');
    console.log('  2. 添加 currency 字段（如果不存在）');
    console.log('  3. 创建 idx_stripe_price_id 索引（如果不存在）\n');
    
    // 检查字段是否已存在
    console.log('🔍 检查当前状态...');
    const [columns] = await connection.execute(
      `SELECT COLUMN_NAME, COLUMN_TYPE, COLUMN_DEFAULT, COLUMN_COMMENT
       FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = ? 
       AND TABLE_NAME = 'novel_champion_tiers'
       AND COLUMN_NAME IN ('stripe_price_id', 'currency')`,
      [dbConfig.database]
    );
    
    const existingFields = columns.map(col => col.COLUMN_NAME);
    const allFields = ['stripe_price_id', 'currency'];
    const missingFields = allFields.filter(field => !existingFields.includes(field));
    
    if (existingFields.length > 0) {
      console.log(`⚠️  以下字段已存在: ${existingFields.join(', ')}`);
      existingFields.forEach(field => {
        const col = columns.find(c => c.COLUMN_NAME === field);
        console.log(`   - ${field}: ${col.COLUMN_TYPE} (默认值: ${col.COLUMN_DEFAULT || 'NULL'})`);
      });
    }
    
    if (missingFields.length > 0) {
      console.log(`✓ 以下字段不存在，将添加: ${missingFields.join(', ')}`);
    } else {
      console.log('✅ 所有字段已存在');
    }
    
    // 执行 SQL（分别执行，因为 MySQL 不支持 IF NOT EXISTS 在 ALTER TABLE 中）
    console.log('\n⚙️  执行SQL语句...\n');
    
    // 添加 stripe_price_id 字段
    if (missingFields.includes('stripe_price_id')) {
      try {
        await connection.execute(
          `ALTER TABLE novel_champion_tiers 
           ADD COLUMN stripe_price_id VARCHAR(128) NULL COMMENT '对应 Stripe Price ID' AFTER monthly_price`
        );
        console.log('✅ stripe_price_id 字段已添加');
      } catch (error) {
        if (error.code === 'ER_DUP_FIELDNAME') {
          console.log('⚠️  stripe_price_id 字段已存在，跳过');
        } else {
          throw error;
        }
      }
    }
    
    // 添加 currency 字段
    if (missingFields.includes('currency')) {
      try {
        await connection.execute(
          `ALTER TABLE novel_champion_tiers 
           ADD COLUMN currency VARCHAR(10) NOT NULL DEFAULT 'USD' COMMENT '币种，默认 USD' AFTER stripe_price_id`
        );
        console.log('✅ currency 字段已添加');
      } catch (error) {
        if (error.code === 'ER_DUP_FIELDNAME') {
          console.log('⚠️  currency 字段已存在，跳过');
        } else {
          throw error;
        }
      }
    }
    
    // 检查并创建索引
    console.log('\n🔍 检查索引...');
    const [indexes] = await connection.execute(
      `SELECT INDEX_NAME 
       FROM INFORMATION_SCHEMA.STATISTICS 
       WHERE TABLE_SCHEMA = ? 
       AND TABLE_NAME = 'novel_champion_tiers'
       AND INDEX_NAME = 'idx_stripe_price_id'`,
      [dbConfig.database]
    );
    
    if (indexes.length === 0) {
      try {
        await connection.execute(
          `CREATE INDEX idx_stripe_price_id ON novel_champion_tiers (stripe_price_id)`
        );
        console.log('✅ 索引 idx_stripe_price_id 已创建');
      } catch (error) {
        if (error.code === 'ER_DUP_KEYNAME') {
          console.log('⚠️  索引 idx_stripe_price_id 已存在，跳过');
        } else {
          throw error;
        }
      }
    } else {
      console.log('✅ 索引 idx_stripe_price_id 已存在');
    }
    
    console.log('\n📊 验证迁移结果...\n');
    
    // 验证字段
    const [verifyColumns] = await connection.execute(
      `SELECT COLUMN_NAME, COLUMN_TYPE, COLUMN_DEFAULT, COLUMN_COMMENT
       FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = ? 
       AND TABLE_NAME = 'novel_champion_tiers'
       AND COLUMN_NAME IN ('stripe_price_id', 'currency')
       ORDER BY COLUMN_NAME`,
      [dbConfig.database]
    );
    
    if (verifyColumns.length === 2) {
      console.log('✅ 所有字段已成功添加：');
      verifyColumns.forEach(col => {
        console.log(`   - ${col.COLUMN_NAME}: ${col.COLUMN_TYPE} (默认值: ${col.COLUMN_DEFAULT || 'NULL'})`);
        console.log(`     注释: ${col.COLUMN_COMMENT || '无'}`);
      });
    }
    
    // 检查现有记录数量
    const [count] = await connection.execute(
      `SELECT COUNT(*) as total FROM novel_champion_tiers`
    );
    console.log(`\n📊 当前 novel_champion_tiers 表共有 ${count[0].total} 条记录`);
    
    // 检查有多少记录的 stripe_price_id 为 NULL
    const [nullCount] = await connection.execute(
      `SELECT COUNT(*) as null_count FROM novel_champion_tiers WHERE stripe_price_id IS NULL`
    );
    console.log(`   其中 ${nullCount[0].null_count} 条记录的 stripe_price_id 为 NULL（将在首次使用时动态创建）`);
    
    console.log('\n✅ 迁移完成！');
    
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

