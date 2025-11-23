// 执行数据库迁移脚本
// 删除 chapter 表中的冗余字段

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
    const sqlPath = path.join(__dirname, 'remove_chapter_fields.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    console.log('📝 开始执行迁移脚本...');
    console.log('⚠️  警告：此操作将删除以下字段：');
    console.log('   - is_locked');
    console.log('   - is_premium');
    console.log('   - is_visible');
    console.log('   - is_vip_only');
    console.log('   - prev_chapter_id');
    
    // 执行SQL
    await connection.query(sql);
    
    console.log('✅ 迁移脚本执行成功！');
    console.log('📊 验证迁移结果...');
    
    // 验证字段是否已删除
    const [columns] = await connection.query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'chapter'
    `, [dbConfig.database]);
    
    const columnNames = columns.map(col => col.COLUMN_NAME);
    const deletedFields = ['is_locked', 'is_premium', 'is_visible', 'is_vip_only', 'prev_chapter_id'];
    const stillExists = deletedFields.filter(field => columnNames.includes(field));
    
    if (stillExists.length > 0) {
      console.log('❌ 以下字段仍然存在：', stillExists);
      throw new Error('迁移未完全成功');
    } else {
      console.log('✅ 所有字段已成功删除');
    }
    
    // 检查数据统计
    const [stats] = await connection.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN unlock_price > 0 THEN 1 END) as locked_count,
        COUNT(CASE WHEN review_status = 'approved' THEN 1 END) as approved_count
      FROM chapter
    `);
    
    console.log('📈 数据统计：');
    console.log(`   总章节数: ${stats[0].total}`);
    console.log(`   锁定章节数 (unlock_price > 0): ${stats[0].locked_count}`);
    console.log(`   已审核章节数 (review_status = 'approved'): ${stats[0].approved_count}`);
    
    console.log('\n🎉 迁移完成！');
    
  } catch (error) {
    console.error('❌ 迁移失败:', error.message);
    if (error.code === 'ER_CANT_DROP_FIELD_OR_KEY') {
      console.error('   提示：字段可能不存在或已被删除');
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

