/**
 * 验证迁移016：检查表是否创建成功
 */

const mysql = require('mysql2/promise');

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '123456',
  database: process.env.DB_NAME || 'kongfuworld',
  charset: 'utf8mb4',
};

async function verifyTables() {
  let connection;
  try {
    connection = await mysql.createConnection(dbConfig);
    
    // 检查表是否存在
    const [tables] = await connection.execute(
      "SHOW TABLES LIKE 'novel_import%'"
    );
    
    console.log('\n✅ 迁移验证结果：');
    console.log('已创建的表：');
    tables.forEach(table => {
      const tableName = Object.values(table)[0];
      console.log(`  - ${tableName}`);
    });
    
    if (tables.length === 2) {
      console.log('\n✅ 所有表创建成功！');
    } else {
      console.log(`\n⚠️  预期创建 2 张表，实际创建 ${tables.length} 张表`);
    }
    
    // 检查表结构
    if (tables.length > 0) {
      console.log('\n📋 表结构信息：');
      for (const table of tables) {
        const tableName = Object.values(table)[0];
        const [columns] = await connection.execute(
          `DESCRIBE ${tableName}`
        );
        console.log(`\n${tableName} (${columns.length} 个字段):`);
        columns.forEach(col => {
          console.log(`  - ${col.Field}: ${col.Type}`);
        });
      }
    }
    
  } catch (error) {
    console.error('❌ 验证失败:', error.message);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

verifyTables();

