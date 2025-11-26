/**
 * 执行迁移脚本：016_add_chief_editor_role.sql
 * 添加 chief_editor 角色到 admin 表的 role 枚举
 * 
 * 使用方法：
 * node backend/migrations/execute_016_migration.js
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
    const sqlPath = path.join(__dirname, '016_add_chief_editor_role.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    console.log('📝 开始执行迁移脚本：016_add_chief_editor_role.sql\n');
    console.log('将执行以下操作：');
    console.log('  1. 修改 role 枚举，添加 chief_editor\n');
    
    // 检查 role 枚举是否已包含 chief_editor
    console.log('🔍 检查当前状态...');
    const [roleInfo] = await connection.execute(
      `SELECT COLUMN_TYPE 
       FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = ? 
       AND TABLE_NAME = 'admin' 
       AND COLUMN_NAME = 'role'`,
      [dbConfig.database]
    );
    
    if (roleInfo.length > 0) {
      const columnType = roleInfo[0].COLUMN_TYPE;
      console.log(`当前 role 枚举类型: ${columnType}`);
      if (columnType.includes('chief_editor')) {
        console.log('⚠️  role 枚举已包含 chief_editor，无需修改');
        console.log('\n✅ 迁移已完成（无需操作）');
        return;
      } else {
        console.log('✓ role 枚举不包含 chief_editor，将添加');
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
        await connection.query(statement + ';');
        const preview = statement.replace(/\s+/g, ' ').substring(0, 70);
        console.log(`✓ [${i + 1}/${statements.length}] 执行成功: ${preview}...`);
      } catch (error) {
        console.error(`❌ SQL语句执行失败:`);
        console.error(`   ${statement.substring(0, 100)}...`);
        throw error;
      }
    }
    
    console.log('\n✅ 迁移脚本执行成功！');
    console.log('📊 验证迁移结果...\n');
    
    // 验证 role 枚举
    const [newRoleInfo] = await connection.execute(
      `SELECT COLUMN_TYPE 
       FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = ? 
       AND TABLE_NAME = 'admin' 
       AND COLUMN_NAME = 'role'`,
      [dbConfig.database]
    );
    
    if (newRoleInfo.length > 0) {
      const roleType = newRoleInfo[0].COLUMN_TYPE;
      console.log('✅ role 枚举类型:');
      console.log(`   ${roleType}`);
      if (roleType.includes('chief_editor')) {
        console.log('   ✓ 已包含 chief_editor');
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

