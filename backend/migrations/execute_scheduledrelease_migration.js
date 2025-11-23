// 执行定时发布表和字段创建的迁移脚本
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
    const sqlPath = path.join(__dirname, 'create_scheduledrelease_table.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    console.log('📝 开始执行迁移脚本...');
    console.log('⚠️  此操作将：');
    console.log('   1. 为 chapter 表添加 is_released 字段');
    console.log('   2. 创建 scheduledrelease 表');
    console.log('   3. 初始化现有章节的 is_released 字段');
    
    // 执行SQL
    await connection.query(sql);
    
    console.log('✅ 迁移脚本执行成功！');
    console.log('📊 验证迁移结果...');
    
    // 验证字段是否已添加
    const [columns] = await connection.query(`
      SELECT COLUMN_NAME, COLUMN_TYPE, COLUMN_DEFAULT, COLUMN_COMMENT
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'chapter' AND COLUMN_NAME = 'is_released'
    `, [dbConfig.database]);
    
    if (columns.length > 0) {
      console.log('✅ chapter.is_released 字段已成功添加');
      console.log(`   类型: ${columns[0].COLUMN_TYPE}`);
      console.log(`   默认值: ${columns[0].COLUMN_DEFAULT}`);
    } else {
      throw new Error('chapter.is_released 字段未找到');
    }
    
    // 验证表是否已创建
    const [tables] = await connection.query(`
      SELECT TABLE_NAME 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'scheduledrelease'
    `, [dbConfig.database]);
    
    if (tables.length > 0) {
      console.log('✅ scheduledrelease 表已成功创建');
      
      // 检查表结构
      const [tableColumns] = await connection.query(`
        SELECT COLUMN_NAME, COLUMN_TYPE, COLUMN_DEFAULT
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'scheduledrelease'
        ORDER BY ORDINAL_POSITION
      `, [dbConfig.database]);
      
      console.log('   表结构:');
      tableColumns.forEach(col => {
        console.log(`     - ${col.COLUMN_NAME}: ${col.COLUMN_TYPE} (默认: ${col.COLUMN_DEFAULT || 'NULL'})`);
      });
    } else {
      throw new Error('scheduledrelease 表未找到');
    }
    
    // 检查数据统计
    const [chapterStats] = await connection.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN is_released = 1 THEN 1 END) as released_count,
        COUNT(CASE WHEN is_released = 0 THEN 1 END) as unreleased_count
      FROM chapter
    `);
    
    console.log('📈 章节发布状态统计：');
    console.log(`   总章节数: ${chapterStats[0].total}`);
    console.log(`   已发布章节数: ${chapterStats[0].released_count}`);
    console.log(`   未发布章节数: ${chapterStats[0].unreleased_count}`);
    
    console.log('\n🎉 迁移完成！');
    
  } catch (error) {
    console.error('❌ 迁移失败:', error.message);
    if (error.code === 'ER_DUP_FIELDNAME') {
      console.error('   提示：字段可能已存在');
    } else if (error.code === 'ER_TABLE_EXISTS_ERROR') {
      console.error('   提示：表可能已存在');
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

