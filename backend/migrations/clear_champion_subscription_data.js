/**
 * 清空 Champion 订阅相关表的数据
 * 用于重新测试
 * 
 * 使用方法：
 * node backend/migrations/clear_champion_subscription_data.js
 */

const mysql = require('mysql2/promise');

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '123456',
  database: process.env.DB_NAME || 'kongfuworld',
  charset: 'utf8mb4'
};

async function clearData() {
  let db;
  
  try {
    console.log('🔌 正在连接数据库...');
    db = await mysql.createConnection(dbConfig);
    console.log('✅ 数据库连接成功\n');
    
    const tables = [
      'user_champion_subscription_record',
      'user_champion_subscription'
    ];
    
    console.log('⚠️  警告：即将删除以下表的所有数据：');
    tables.forEach(table => console.log(`  - ${table}`));
    console.log('');
    
    // 先统计每张表的记录数
    console.log('📊 当前数据统计：');
    for (const table of tables) {
      try {
        const [result] = await db.execute(`SELECT COUNT(*) as count FROM ${table}`);
        console.log(`  ${table}: ${result[0].count} 条记录`);
      } catch (error) {
        console.log(`  ${table}: 查询失败 - ${error.message}`);
      }
    }
    console.log('');
    
    // 删除数据（按顺序，考虑外键约束）
    // 先删除有外键依赖的表
    console.log('🗑️  开始删除数据...\n');
    
    // 1. 先删除 user_champion_subscription_record（有外键依赖 payment_record）
    console.log('1. 清空 user_champion_subscription_record...');
    await db.execute('DELETE FROM user_champion_subscription_record');
    const [count1] = await db.execute('SELECT COUNT(*) as count FROM user_champion_subscription_record');
    console.log(`   ✅ user_champion_subscription_record 已清空，剩余记录数: ${count1[0].count}\n`);
    
    // 2. 删除 user_champion_subscription
    console.log('2. 清空 user_champion_subscription...');
    await db.execute('DELETE FROM user_champion_subscription');
    const [count2] = await db.execute('SELECT COUNT(*) as count FROM user_champion_subscription');
    console.log(`   ✅ user_champion_subscription 已清空，剩余记录数: ${count2[0].count}\n`);
    
    console.log('✅ 所有数据已清空！');
    
    // 最终验证
    console.log('\n📊 最终验证：');
    for (const table of tables) {
      try {
        const [result] = await db.execute(`SELECT COUNT(*) as count FROM ${table}`);
        console.log(`  ${table}: ${result[0].count} 条记录`);
      } catch (error) {
        console.log(`  ${table}: 查询失败 - ${error.message}`);
      }
    }
    
  } catch (error) {
    console.error('\n❌ 清空数据失败:', error);
    process.exit(1);
  } finally {
    if (db) {
      await db.end();
      console.log('\n🔌 数据库连接已关闭');
    }
  }
}

clearData();

