/**
 * 执行迁移脚本：011_add_pending_chief_status.sql
 * Phase 3: 添加章节审核状态 - pending_chief（等待主编终审）
 * 
 * 使用方法：
 * node backend/migrations/execute_011_migration.js
 */

const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

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
    const sqlPath = path.join(__dirname, '011_add_pending_chief_status.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    console.log('📝 开始执行迁移脚本：011_add_pending_chief_status.sql\n');
    console.log('将执行以下操作：');
    console.log('  1. 修改 review_status 枚举，添加 pending_chief 状态\n');
    
    // 检查当前枚举值
    console.log('🔍 检查当前状态...');
    
    const [columnInfo] = await connection.execute(
      `SELECT COLUMN_TYPE 
       FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = ? 
       AND TABLE_NAME = 'chapter' 
       AND COLUMN_NAME = 'review_status'`,
      [dbConfig.database]
    );
    
    if (columnInfo.length > 0) {
      const currentType = columnInfo[0].COLUMN_TYPE;
      console.log(`当前 review_status 类型: ${currentType}`);
      
      if (currentType.includes('pending_chief')) {
        console.log('⚠️  review_status 枚举已包含 pending_chief');
      } else {
        console.log('✓ review_status 枚举不包含 pending_chief，将添加');
      }
    }
    
    console.log('\n⚙️  执行SQL语句...\n');
    
    // 移除注释行，然后按分号分割SQL语句
    const cleanSql = sql
      .split('\n')
      .filter(line => !line.trim().startsWith('--') || line.trim() === '')
      .join('\n');
    
    // 分割SQL语句（按分号分割）
    const statements = cleanSql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);
    
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      try {
        // 检查是否是修改枚举的语句
        if (statement.includes('MODIFY COLUMN') && statement.includes('review_status')) {
          if (columnInfo.length > 0) {
            const currentType = columnInfo[0].COLUMN_TYPE;
            if (currentType.includes('pending_chief')) {
              console.log(`⏭️  [${i + 1}/${statements.length}] 跳过：review_status 枚举已包含 pending_chief`);
              continue;
            }
          }
        }
        
        await connection.query(statement + ';');
        const preview = statement.replace(/\s+/g, ' ').substring(0, 100);
        console.log(`✓ [${i + 1}/${statements.length}] 执行成功: ${preview}...`);
      } catch (error) {
        console.error(`❌ SQL语句执行失败:`);
        console.error(`   ${statement.substring(0, 150)}...`);
        console.error(`   错误: ${error.message}`);
        throw error;
      }
    }
    
    console.log('\n✅ 迁移脚本执行成功！');
    console.log('📊 验证迁移结果...\n');
    
    // 验证 review_status 枚举
    const [newColumnInfo] = await connection.execute(
      `SELECT COLUMN_TYPE, COLUMN_DEFAULT, COLUMN_COMMENT
       FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = ? 
       AND TABLE_NAME = 'chapter' 
       AND COLUMN_NAME = 'review_status'`,
      [dbConfig.database]
    );
    
    if (newColumnInfo.length > 0) {
      console.log('✅ review_status 枚举类型:');
      console.log(`   ${newColumnInfo[0].COLUMN_TYPE}`);
      console.log(`   默认值: ${newColumnInfo[0].COLUMN_DEFAULT}`);
      if (newColumnInfo[0].COLUMN_COMMENT) {
        console.log(`   注释: ${newColumnInfo[0].COLUMN_COMMENT}`);
      }
      if (newColumnInfo[0].COLUMN_TYPE.includes('pending_chief')) {
        console.log('   ✓ 已包含 pending_chief');
      }
    }
    
    console.log('\n🎉 迁移完成！');
    
  } catch (error) {
    console.error('\n❌ 迁移失败:', error.message);
    if (error.code) {
      console.error('   错误代码:', error.code);
    }
    if (error.sql) {
      console.error('   SQL:', error.sql.substring(0, 200));
    }
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n🔌 数据库连接已关闭。');
    }
  }
}

// 执行迁移
executeMigration();

