// 测试回复功能修复
const mysql = require('mysql2/promise');

async function testReplyFix() {
  try {
    const connection = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: '123456',
      database: 'kongfuworld'
    });

    console.log('🔧 测试回复功能修复...\n');

    // 1. 检查comment表结构
    const [columns] = await connection.execute('DESCRIBE comment');
    const targetTypeColumn = columns.find(col => col.Field === 'target_type');
    console.log('📋 comment表target_type字段:', targetTypeColumn.Type);

    // 2. 检查是否有review类型的评论
    const [reviewComments] = await connection.execute(`
      SELECT COUNT(*) as count 
      FROM comment 
      WHERE target_type = 'review'
    `);
    console.log('📊 review类型评论数量:', reviewComments[0].count);

    // 3. 检查review表
    const [reviews] = await connection.execute('SELECT id, content FROM review LIMIT 3');
    console.log('📝 现有评论:');
    reviews.forEach(review => {
      console.log(`  ID: ${review.id}, 内容: ${review.content.substring(0, 50)}...`);
    });

    // 4. 测试插入review类型评论
    console.log('\n🧪 测试插入review类型评论...');
    try {
      const [result] = await connection.execute(`
        INSERT INTO comment (user_id, target_type, target_id, content) 
        VALUES (1, 'review', 1, 'Test reply to review')
      `);
      console.log('✅ 成功插入review类型评论，ID:', result.insertId);

      // 清理测试数据
      await connection.execute('DELETE FROM comment WHERE id = ?', [result.insertId]);
      console.log('🧹 已清理测试数据');
    } catch (error) {
      console.error('❌ 插入测试失败:', error.message);
    }

    await connection.end();
    console.log('\n🎉 测试完成！');

  } catch (error) {
    console.error('❌ 测试失败:', error);
  }
}

testReplyFix();
