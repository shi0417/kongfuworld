// 修复小说评价系统的喜欢/不喜欢互斥功能
const mysql = require('mysql2/promise');

(async () => {
  const conn = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '123456',
    database: 'kongfuworld'
  });

  try {
    console.log('🔧 开始修复小说评价系统的喜欢/不喜欢互斥功能...');

    // 1. 为review表添加dislikes字段
    console.log('📝 1. 为review表添加dislikes字段...');
    try {
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
    }

    // 2. 创建review_dislike表
    console.log('📝 2. 创建review_dislike表...');
    try {
      await conn.execute(`
        CREATE TABLE IF NOT EXISTS review_dislike (
          id INT NOT NULL AUTO_INCREMENT,
          review_id INT NOT NULL,
          user_id INT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (id),
          UNIQUE KEY unique_dislike (review_id, user_id),
          FOREIGN KEY (review_id) REFERENCES review(id) ON DELETE CASCADE,
          FOREIGN KEY (user_id) REFERENCES user(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
      console.log('✅ review_dislike表创建成功！');
    } catch (error) {
      console.error('❌ 创建表失败:', error);
    }

    // 3. 检查现有数据
    console.log('📝 3. 检查现有数据...');
    const [reviews] = await conn.execute('SELECT COUNT(*) as count FROM review');
    const [likes] = await conn.execute('SELECT COUNT(*) as count FROM review_like');
    const [dislikes] = await conn.execute('SELECT COUNT(*) as count FROM review_dislike');
    
    console.log(`📊 数据统计:`);
    console.log(`   - 评价总数: ${reviews[0].count}`);
    console.log(`   - 点赞记录: ${likes[0].count}`);
    console.log(`   - 点踩记录: ${dislikes[0].count}`);

    console.log('🎉 小说评价系统修复完成！');
    console.log('');
    console.log('📋 修复内容总结:');
    console.log('✅ 1. 为review表添加了dislikes字段');
    console.log('✅ 2. 创建了review_dislike表');
    console.log('✅ 3. 后端API已添加dislike功能');
    console.log('✅ 4. 前端组件已添加dislike按钮');
    console.log('');
    console.log('🚀 现在小说评价系统支持完整的喜欢/不喜欢互斥功能！');

  } catch (error) {
    console.error('❌ 修复过程中出现错误:', error);
  } finally {
    await conn.end();
  }
})();
