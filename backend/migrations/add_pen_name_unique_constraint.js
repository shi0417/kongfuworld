const mysql = require('mysql2/promise');

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '123456',
  database: process.env.DB_NAME || 'kongfuworld'
};

async function addPenNameUniqueConstraint() {
  let connection;
  try {
    console.log('🔍 开始为pen_name添加唯一约束...');
    
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ 数据库连接成功');
    
    // 检查是否已有唯一约束
    const [indexes] = await connection.execute(
      "SHOW INDEXES FROM user WHERE Column_name = 'pen_name'"
    );
    
    const hasUnique = indexes.some(idx => idx.Non_unique === 0);
    
    if (hasUnique) {
      console.log('✅ pen_name字段已有唯一约束，跳过');
      return;
    }
    
    // 检查是否有重复的笔名（非NULL值）
    const [duplicates] = await connection.execute(
      `SELECT pen_name, COUNT(*) as count 
       FROM user 
       WHERE pen_name IS NOT NULL 
       GROUP BY pen_name 
       HAVING count > 1`
    );
    
    if (duplicates.length > 0) {
      console.log('⚠️  发现重复的笔名，请先处理:');
      duplicates.forEach(dup => {
        console.log(`  - "${dup.pen_name}": ${dup.count}个用户`);
      });
      console.log('\n请先处理重复的笔名，然后再运行此脚本');
      return;
    }
    
    // 删除普通索引
    try {
      await connection.execute('ALTER TABLE `user` DROP INDEX `idx_pen_name`');
      console.log('✅ 已删除普通索引 idx_pen_name');
    } catch (error) {
      if (error.message.includes("Unknown key")) {
        console.log('ℹ️  普通索引不存在，跳过删除');
      } else {
        throw error;
      }
    }
    
    // 添加唯一索引
    await connection.execute('ALTER TABLE `user` ADD UNIQUE KEY `unique_pen_name` (`pen_name`)');
    console.log('✅ 已添加唯一约束 unique_pen_name');
    
    console.log('\n✅ 迁移完成！pen_name字段现在有唯一约束');
    
  } catch (error) {
    console.error('❌ 迁移失败:', error.message);
    if (error.code === 'ER_DUP_ENTRY' || error.message.includes('Duplicate')) {
      console.log('\n⚠️  检测到重复的笔名，请先处理重复数据');
    }
  } finally {
    if (connection) await connection.end();
    console.log('🔌 数据库连接已关闭');
  }
}

addPenNameUniqueConstraint();

