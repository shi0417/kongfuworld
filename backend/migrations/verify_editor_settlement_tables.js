/**
 * 验证 editor_settlement_monthly 和 editor_payout 表是否创建成功
 */

const mysql = require('mysql2/promise');

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '123456',
  database: process.env.DB_NAME || 'kongfuworld',
  charset: 'utf8mb4'
};

async function verifyTables() {
  let db;
  
  try {
    db = await mysql.createConnection(dbConfig);
    
    // 检查表是否存在
    const [tables] = await db.execute(
      `SELECT TABLE_NAME 
       FROM INFORMATION_SCHEMA.TABLES 
       WHERE TABLE_SCHEMA = ? 
       AND TABLE_NAME IN ('editor_settlement_monthly', 'editor_payout')`,
      [dbConfig.database]
    );
    
    console.log('✅ 表检查结果:');
    tables.forEach(t => {
      console.log(`   - ${t.TABLE_NAME}: 存在`);
    });
    
    if (tables.length === 2) {
      console.log('\n✅ 两个表都已成功创建！');
    } else {
      console.log(`\n⚠️  只找到 ${tables.length} 个表，预期 2 个`);
    }
    
    // 检查外键约束
    const [fk] = await db.execute(
      `SELECT CONSTRAINT_NAME, TABLE_NAME, REFERENCED_TABLE_NAME 
       FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
       WHERE TABLE_SCHEMA = ? 
       AND TABLE_NAME IN ('editor_settlement_monthly', 'editor_payout') 
       AND REFERENCED_TABLE_NAME IS NOT NULL`,
      [dbConfig.database]
    );
    
    console.log('\n📋 外键约束:');
    if (fk.length > 0) {
      fk.forEach(f => {
        console.log(`   ${f.TABLE_NAME}.${f.CONSTRAINT_NAME} -> ${f.REFERENCED_TABLE_NAME}`);
      });
    } else {
      console.log('   未找到外键约束');
    }
    
  } catch (error) {
    console.error('❌ 验证失败:', error.message);
    process.exit(1);
  } finally {
    if (db) await db.end();
  }
}

verifyTables();

