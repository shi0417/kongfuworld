// 修复comment表的target_type字段
const mysql = require('mysql2/promise');

async function fixCommentTable() {
  try {
    const connection = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: '123456',
      database: 'kongfuworld'
    });

    console.log('🔧 修复comment表的target_type字段...');

    // 修改target_type字段，添加'review'类型
    await connection.execute(`
      ALTER TABLE comment 
      MODIFY COLUMN target_type enum('novel','chapter','paragraph','review') NOT NULL
    `);

    console.log('✅ 成功添加review类型到target_type字段');

    // 验证修改结果
    const [columns] = await connection.execute('DESCRIBE comment');
    const targetTypeColumn = columns.find(col => col.Field === 'target_type');
    console.log('📋 修改后的target_type字段:', targetTypeColumn.Type);

    await connection.end();
    console.log('🎉 修复完成！');

  } catch (error) {
    console.error('❌ 修复失败:', error);
  }
}

fixCommentTable();
