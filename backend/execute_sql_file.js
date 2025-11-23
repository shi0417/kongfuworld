// 执行SQL文件
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

// 数据库连接配置
const dbConfig = {
  host: 'localhost',
  user: 'root',
  password: '123456',
  database: 'kongfuworld',
  charset: 'utf8mb4',
  multipleStatements: true // 允许执行多条SQL语句
};

async function executeSqlFile() {
  let db;
  try {
    console.log('开始执行SQL脚本...\n');
    
    // 读取SQL文件
    const sqlFile = path.join(__dirname, 'create_random_notes_table.sql');
    const sql = fs.readFileSync(sqlFile, 'utf8');
    
    console.log('✅ SQL文件读取成功');
    
    // 创建数据库连接
    db = await mysql.createConnection(dbConfig);
    console.log('✅ 数据库连接成功');
    
    // 执行SQL语句
    console.log('\n执行SQL语句...');
    await db.query(sql);
    
    console.log('✅ SQL脚本执行成功');
    
    // 验证表是否创建成功
    const [tables] = await db.execute(`
      SELECT TABLE_NAME 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_SCHEMA = 'kongfuworld' 
      AND TABLE_NAME = 'randomNotes'
    `);
    
    if (tables.length > 0) {
      console.log('\n✅ randomNotes表已成功创建！');
      
      // 显示表结构
      const [columns] = await db.execute(`
        SELECT 
          COLUMN_NAME, 
          DATA_TYPE, 
          IS_NULLABLE, 
          COLUMN_DEFAULT, 
          COLUMN_COMMENT
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = 'kongfuworld' 
        AND TABLE_NAME = 'randomNotes'
        ORDER BY ORDINAL_POSITION
      `);
      
      console.log('\n表结构:');
      console.log('字段名\t\t\t类型\t\t\t可空\t注释');
      console.log('─'.repeat(70));
      columns.forEach(col => {
        const type = col.DATA_TYPE;
        const nullable = col.IS_NULLABLE === 'YES' ? '是' : '否';
        const defaultValue = col.COLUMN_DEFAULT || 'NULL';
        console.log(`${col.COLUMN_NAME.padEnd(20)}\t${type.padEnd(20)}\t${nullable}\t${col.COLUMN_COMMENT || ''}`);
      });
    } else {
      console.log('⚠️  表创建可能失败，请检查');
    }
    
    console.log('\n✅ 所有操作完成！');
  } catch (error) {
    console.error('❌ 操作失败:', error.message);
    throw error;
  } finally {
    if (db) {
      await db.end();
      console.log('\n数据库连接已关闭');
    }
  }
}

// 执行函数
executeSqlFile()
  .then(() => {
    console.log('\n脚本执行完成');
    process.exit(0);
  })
  .catch((error) => {
    console.error('脚本执行失败:', error);
    process.exit(1);
  });

