/**
 * 测试 mysql2 的 IN 查询
 */

const mysql = require('mysql2/promise');

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '123456',
  database: process.env.DB_NAME || 'kongfuworld',
  charset: 'utf8mb4'
};

async function testInQuery() {
  const db = await mysql.createConnection(dbConfig);
  const settlementMonth = '2025-10-01';
  
  try {
    const novelIds = [13, 11, 7, 10, 1];
    
    console.log('测试 1: 使用 IN (?) 和数组');
    const [result1] = await db.execute(
      `SELECT COUNT(*) as cnt FROM novel_editor_contract
       WHERE novel_id IN (?)
         AND share_type = 'percent_of_book'
         AND status = 'active'
         AND (start_date IS NULL OR start_date <= ?)
         AND (end_date IS NULL OR end_date >= ?)`,
      [novelIds, settlementMonth, settlementMonth]
    );
    console.log('结果:', result1);
    console.log('');
    
    console.log('测试 2: 使用 IN (?, ?, ?, ?, ?)');
    const placeholders = novelIds.map(() => '?').join(',');
    const [result2] = await db.execute(
      `SELECT COUNT(*) as cnt FROM novel_editor_contract
       WHERE novel_id IN (${placeholders})
         AND share_type = 'percent_of_book'
         AND status = 'active'
         AND (start_date IS NULL OR start_date <= ?)
         AND (end_date IS NULL OR end_date >= ?)`,
      [...novelIds, settlementMonth, settlementMonth]
    );
    console.log('结果:', result2);
    console.log('');
    
    console.log('测试 3: 检查 novelIds 的类型');
    console.log('novelIds:', novelIds);
    console.log('novelIds 类型:', novelIds.map(id => typeof id));
    console.log('');
    
  } catch (error) {
    console.error('测试失败:', error);
    console.error(error.stack);
  } finally {
    await db.end();
  }
}

testInQuery().catch(console.error);

