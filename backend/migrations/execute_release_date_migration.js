// 执行添加 release_date 字段的迁移脚本
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
    console.log('✅ 数据库连接成功');
    
    // 读取迁移SQL文件
    const sqlPath = path.join(__dirname, 'add_release_date_to_chapter.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    console.log('📝 开始执行迁移脚本...');
    console.log('⚠️  此操作将为 chapter 表添加 release_date 字段');
    
    // 执行SQL
    await connection.query(sql);
    
    console.log('✅ 迁移脚本执行成功！');
    console.log('📊 验证迁移结果...');
    
    // 验证字段是否已添加
    const [columns] = await connection.query(`
      SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT, COLUMN_COMMENT
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'chapter' AND COLUMN_NAME = 'release_date'
    `, [dbConfig.database]);
    
    if (columns.length > 0) {
      console.log('✅ chapter.release_date 字段已成功添加');
      console.log(`   类型: ${columns[0].COLUMN_TYPE}`);
      console.log(`   可空: ${columns[0].IS_NULLABLE}`);
      console.log(`   默认值: ${columns[0].COLUMN_DEFAULT || 'NULL'}`);
      console.log(`   说明: ${columns[0].COLUMN_COMMENT || '无'}`);
    } else {
      throw new Error('chapter.release_date 字段未找到');
    }
    
    console.log('\n🎉 迁移完成！');
    
  } catch (error) {
    console.error('❌ 迁移失败:', error.message);
    if (error.code === 'ER_DUP_FIELDNAME') {
      console.error('   提示：字段可能已存在');
    }
    throw error;
  } finally {
    if (connection) {
      await connection.end();
      console.log('🔌 数据库连接已关闭');
    }
  }
}

// 执行迁移
if (require.main === module) {
  executeMigration()
    .then(() => {
      console.log('✅ 迁移脚本执行完成');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ 迁移脚本执行失败:', error);
      process.exit(1);
    });
}

module.exports = { executeMigration };

