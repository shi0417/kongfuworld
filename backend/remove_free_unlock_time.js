// 删除chapter表中的free_unlock_time字段
const mysql = require('mysql2/promise');

// 数据库配置
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '123456',
  database: process.env.DB_NAME || 'kongfuworld',
  charset: 'utf8mb4'
};

async function removeFreeUnlockTimeField() {
  let db;
  try {
    db = await mysql.createConnection(dbConfig);
    
    console.log('\n🗑️ 删除chapter表中的free_unlock_time字段\n');
    
    // 1. 查看当前表结构
    console.log('📊 1. 查看当前chapter表结构:');
    const [columns] = await db.execute(`DESCRIBE chapter`);
    columns.forEach(column => {
      console.log(`   ${column.Field}: ${column.Type} ${column.Null === 'NO' ? 'NOT NULL' : 'NULL'} ${column.Default ? `DEFAULT ${column.Default}` : ''}`);
    });
    
    // 2. 检查是否有free_unlock_time字段
    const hasFreeUnlockTime = columns.some(col => col.Field === 'free_unlock_time');
    console.log(`\n📋 2. 是否有free_unlock_time字段: ${hasFreeUnlockTime}`);
    
    if (hasFreeUnlockTime) {
      // 3. 删除free_unlock_time字段
      console.log('\n🗑️ 3. 删除free_unlock_time字段:');
      await db.execute(`ALTER TABLE chapter DROP COLUMN free_unlock_time`);
      console.log('   ✅ free_unlock_time字段已删除');
    } else {
      console.log('\nℹ️ 3. free_unlock_time字段不存在，无需删除');
    }
    
    // 4. 查看删除后的表结构
    console.log('\n📊 4. 删除后的chapter表结构:');
    const [newColumns] = await db.execute(`DESCRIBE chapter`);
    newColumns.forEach(column => {
      console.log(`   ${column.Field}: ${column.Type} ${column.Null === 'NO' ? 'NOT NULL' : 'NULL'} ${column.Default ? `DEFAULT ${column.Default}` : ''}`);
    });
    
    console.log('\n✅ free_unlock_time字段删除完成');
    
  } catch (error) {
    console.error('删除失败:', error);
  } finally {
    if (db) await db.end();
  }
}

// 运行删除
removeFreeUnlockTimeField();
