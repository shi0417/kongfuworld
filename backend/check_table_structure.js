/**
 * 检查 editor_income_monthly 表的实际结构
 */

const mysql = require('mysql2/promise');

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '123456',
  database: process.env.DB_NAME || 'kongfuworld',
  charset: 'utf8mb4'
};

async function checkTableStructure() {
  const db = await mysql.createConnection(dbConfig);
  
  try {
    // 查询表结构
    const [columns] = await db.execute(
      `SELECT COLUMN_NAME, ORDINAL_POSITION, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT
       FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'editor_income_monthly'
       ORDER BY ORDINAL_POSITION`
    );
    
    console.log('【editor_income_monthly 表结构】');
    console.table(columns);
    console.log('');
    
    // 列出所有字段名（按顺序）
    const fieldNames = columns.map(c => c.COLUMN_NAME);
    console.log('字段顺序:');
    fieldNames.forEach((name, idx) => {
      console.log(`  ${idx + 1}. ${name}`);
    });
    console.log('');
    
    // 检查我们 INSERT 语句中的字段
    const insertFields = [
      'editor_admin_id',
      'role',
      'novel_id',
      'month',
      'source_spend_id',
      'source_type',
      'chapter_id',
      'chapter_count_total',
      'chapter_count_editor',
      'total_word_count',
      'editor_word_count',
      'gross_book_income_usd',
      'editor_share_percent',
      'contract_share_percent',
      'editor_income_usd'
    ];
    
    console.log('【INSERT 语句中的字段】');
    insertFields.forEach((name, idx) => {
      const actualPos = fieldNames.indexOf(name);
      if (actualPos === -1) {
        console.log(`  ${idx + 1}. ${name} - ❌ 表中不存在`);
      } else {
        console.log(`  ${idx + 1}. ${name} - ✅ 表中位置: ${actualPos + 1}`);
      }
    });
    console.log('');
    
    // 检查是否有字段缺失
    const missingFields = insertFields.filter(f => !fieldNames.includes(f));
    if (missingFields.length > 0) {
      console.log('❌ 缺失的字段:', missingFields);
    } else {
      console.log('✅ 所有字段都存在');
    }
    
  } catch (error) {
    console.error('查询失败:', error);
  } finally {
    await db.end();
  }
}

checkTableStructure().catch(console.error);

