// 检查reading_log表的约束和索引
const mysql = require('mysql2/promise');

// 数据库配置
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '123456',
  database: process.env.DB_NAME || 'kongfuworld',
  charset: 'utf8mb4'
};

async function checkReadingLogConstraints() {
  let db;
  try {
    db = await mysql.createConnection(dbConfig);
    
    console.log('\n🔍 检查reading_log表的约束和索引\n');
    
    // 1. 查看表结构
    const [columns] = await db.execute(`
      DESCRIBE reading_log
    `);
    
    console.log('📊 表结构:');
    columns.forEach(column => {
      console.log(`   ${column.Field}: ${column.Type} ${column.Null === 'NO' ? 'NOT NULL' : 'NULL'} ${column.Key ? `(${column.Key})` : ''} ${column.Default ? `DEFAULT ${column.Default}` : ''}`);
    });
    
    // 2. 查看索引
    const [indexes] = await db.execute(`
      SHOW INDEX FROM reading_log
    `);
    
    console.log('\n📋 索引信息:');
    indexes.forEach(index => {
      console.log(`   ${index.Key_name}: ${index.Column_name} (${index.Non_unique === 0 ? 'UNIQUE' : 'NON-UNIQUE'})`);
    });
    
    // 3. 检查重复记录
    const [duplicates] = await db.execute(`
      SELECT 
        user_id, chapter_id, DATE(read_at) as read_date,
        COUNT(*) as count
      FROM reading_log 
      WHERE user_id = 1 AND chapter_id = 1358
      GROUP BY user_id, chapter_id, DATE(read_at)
      HAVING COUNT(*) > 1
    `);
    
    console.log('\n🔄 重复记录检查:');
    if (duplicates.length > 0) {
      duplicates.forEach(dup => {
        console.log(`   用户${dup.user_id}章节${dup.chapter_id}在${dup.read_date}有${dup.count}条记录`);
      });
    } else {
      console.log('   无重复记录');
    }
    
    // 4. 分析ON DUPLICATE KEY UPDATE问题
    console.log('\n🔧 ON DUPLICATE KEY UPDATE分析:');
    
    if (indexes.some(idx => idx.Key_name === 'PRIMARY')) {
      console.log('   ✅ 有主键约束');
    } else {
      console.log('   ❌ 没有主键约束');
    }
    
    const uniqueIndexes = indexes.filter(idx => idx.Non_unique === 0);
    if (uniqueIndexes.length > 0) {
      console.log('   ✅ 有唯一索引:');
      uniqueIndexes.forEach(idx => {
        console.log(`      ${idx.Key_name}: ${idx.Column_name}`);
      });
    } else {
      console.log('   ❌ 没有唯一索引');
    }
    
    // 5. 建议解决方案
    console.log('\n💡 建议解决方案:');
    console.log('   1. 添加唯一约束: (user_id, chapter_id, DATE(read_at))');
    console.log('   2. 或者修改API逻辑，使用UPDATE而不是INSERT');
    console.log('   3. 或者先删除旧记录再插入新记录');
    
    // 6. 测试修复方案
    console.log('\n🧪 测试修复方案:');
    
    // 方案1: 使用UPDATE语句
    const [updateResult] = await db.execute(`
      UPDATE reading_log 
      SET is_unlocked = 1, unlock_time = '2025-10-18 09:41:31'
      WHERE user_id = 1 AND chapter_id = 1358 
      AND DATE(read_at) = '2025-10-18'
      ORDER BY read_at DESC 
      LIMIT 1
    `);
    
    console.log(`   方案1 (UPDATE): 影响行数 = ${updateResult.affectedRows}`);
    
    // 验证结果
    const [verifyResult] = await db.execute(`
      SELECT * FROM reading_log 
      WHERE user_id = 1 AND chapter_id = 1358 
      AND DATE(read_at) = '2025-10-18'
      ORDER BY read_at DESC 
      LIMIT 1
    `);
    
    if (verifyResult.length > 0) {
      console.log(`   验证结果: is_unlocked = ${verifyResult[0].is_unlocked}, unlock_time = ${verifyResult[0].unlock_time}`);
    }
    
  } catch (error) {
    console.error('检查失败:', error);
  } finally {
    if (db) await db.end();
  }
}

// 运行检查
checkReadingLogConstraints();
