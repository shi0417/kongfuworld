const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

// 数据库配置
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '123456',
  database: process.env.DB_NAME || 'kongfuworld',
  charset: 'utf8mb4',
  multipleStatements: true
};

async function runMigration() {
  let connection;
  try {
    console.log('🔄 开始执行数据库迁移：删除 payout_gateway_transaction 表中的旧字段...\n');
    
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ 数据库连接成功\n');
    
    // 读取SQL文件
    const sqlFile = path.join(__dirname, 'remove_gateway_transaction_fields.sql');
    const sql = fs.readFileSync(sqlFile, 'utf8');
    
    // 分割SQL语句
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => {
        const cleaned = s.replace(/--.*$/gm, '').trim();
        return cleaned.length > 0 && !cleaned.startsWith('--') && !cleaned.match(/^[\s\n]*$/);
      });
    
    console.log(`📝 找到 ${statements.length} 条SQL语句\n`);
    
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      
      try {
        await connection.execute(statement);
        console.log(`✅ [${i + 1}/${statements.length}] 执行成功`);
        
        if (statement.includes('DROP COLUMN')) {
          const columnMatch = statement.match(/DROP COLUMN `?(\w+)`?/i);
          if (columnMatch) {
            console.log(`   🗑️  删除字段: ${columnMatch[1]}`);
          }
        }
      } catch (error) {
        if (error.code === 'ER_CANT_DROP_FIELD_OR_KEY') {
          console.log(`⚠️  [${i + 1}/${statements.length}] 字段不存在，跳过: ${error.message.split('\n')[0]}`);
        } else {
          console.error(`❌ [${i + 1}/${statements.length}] 执行失败:`, error.message);
          console.error(`   SQL: ${statement.substring(0, 100)}...`);
        }
      }
    }
    
    console.log('\n✅ 迁移完成！');
    
  } catch (error) {
    console.error('❌ 迁移失败:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n数据库连接已关闭');
    }
  }
}

// 执行迁移
runMigration().catch(error => {
  console.error('❌ 执行迁移时发生错误:', error);
  process.exit(1);
});

