// 为review表添加dislikes字段
const mysql = require('mysql2/promise');

(async () => {
  const conn = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '123456',
    database: 'kongfuworld'
  });

  try {
    // 添加dislikes字段
    await conn.execute(`
      ALTER TABLE review 
      ADD COLUMN dislikes INT DEFAULT 0 AFTER likes
    `);
    
    console.log('✅ review表添加dislikes字段成功！');
  } catch (error) {
    if (error.code === 'ER_DUP_FIELDNAME') {
      console.log('✅ dislikes字段已存在');
    } else {
      console.error('❌ 添加字段失败:', error);
    }
  } finally {
    await conn.end();
  }
})();
