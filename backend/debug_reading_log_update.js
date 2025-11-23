// 调试reading_log表更新问题
const mysql = require('mysql2/promise');

// 数据库配置
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '123456',
  database: process.env.DB_NAME || 'kongfuworld',
  charset: 'utf8mb4'
};

async function debugReadingLogUpdate() {
  let db;
  try {
    db = await mysql.createConnection(dbConfig);
    
    console.log('\n🔍 调试reading_log表更新问题\n');
    
    // 1. 模拟API调用时的解锁信息查询
    const userId = 1;
    const chapterId = 1358;
    
    console.log('📊 模拟API调用时的解锁信息查询:');
    const [unlockInfo] = await db.execute(`
      SELECT 
        CASE 
          WHEN COUNT(*) > 0 THEN 1 
          ELSE 0 
        END as is_unlocked,
        MAX(unlocked_at) as unlock_time
      FROM chapter_unlocks 
      WHERE user_id = ? AND chapter_id = ? AND status = 'unlocked'
    `, [userId, chapterId]);
    
    console.log(`   查询结果: is_unlocked = ${unlockInfo[0].is_unlocked}, unlock_time = ${unlockInfo[0].unlock_time}`);
    
    // 2. 检查时间顺序问题
    console.log('\n⏰ 时间顺序分析:');
    
    // 查询最新的阅读记录
    const [latestReading] = await db.execute(`
      SELECT * FROM reading_log 
      WHERE user_id = ? AND chapter_id = ?
      ORDER BY read_at DESC 
      LIMIT 1
    `, [userId, chapterId]);
    
    // 查询解锁记录
    const [unlockRecord] = await db.execute(`
      SELECT * FROM chapter_unlocks 
      WHERE user_id = ? AND chapter_id = ? AND status = 'unlocked'
      ORDER BY unlocked_at DESC 
      LIMIT 1
    `, [userId, chapterId]);
    
    if (latestReading.length > 0 && unlockRecord.length > 0) {
      const readingTime = new Date(latestReading[0].read_at);
      const unlockTime = new Date(unlockRecord[0].unlocked_at);
      
      console.log(`   阅读时间: ${readingTime.toISOString()}`);
      console.log(`   解锁时间: ${unlockTime.toISOString()}`);
      console.log(`   时间差: ${unlockTime.getTime() - readingTime.getTime()} 毫秒`);
      
      if (unlockTime > readingTime) {
        console.log('   ⚠️  问题: 解锁时间晚于阅读时间！');
        console.log('   这意味着用户阅读时章节还没有解锁');
      } else {
        console.log('   ✅ 解锁时间早于或等于阅读时间');
      }
    }
    
    // 3. 检查ON DUPLICATE KEY UPDATE逻辑
    console.log('\n🔧 检查ON DUPLICATE KEY UPDATE逻辑:');
    
    // 查看是否有重复记录
    const [duplicateCheck] = await db.execute(`
      SELECT 
        user_id, chapter_id, 
        COUNT(*) as count,
        GROUP_CONCAT(DATE(read_at)) as read_dates
      FROM reading_log 
      WHERE user_id = ? AND chapter_id = ?
      GROUP BY user_id, chapter_id
    `, [userId, chapterId]);
    
    if (duplicateCheck.length > 0) {
      console.log(`   用户${userId}章节${chapterId}的阅读记录数: ${duplicateCheck[0].count}`);
      console.log(`   阅读日期: ${duplicateCheck[0].read_dates}`);
      
      if (duplicateCheck[0].count > 1) {
        console.log('   ⚠️  问题: 存在重复记录，ON DUPLICATE KEY UPDATE可能没有正确工作');
      }
    }
    
    // 4. 手动测试更新
    console.log('\n🧪 手动测试更新:');
    
    const isUnlocked = unlockInfo[0].is_unlocked;
    const unlockTime = unlockInfo[0].unlock_time;
    
    console.log(`   准备更新: is_unlocked = ${isUnlocked}, unlock_time = ${unlockTime}`);
    
    // 手动执行更新
    const [updateResult] = await db.execute(`
      UPDATE reading_log 
      SET is_unlocked = ?, unlock_time = ?
      WHERE user_id = ? AND chapter_id = ?
      ORDER BY read_at DESC 
      LIMIT 1
    `, [isUnlocked, unlockTime, userId, chapterId]);
    
    console.log(`   更新结果: 影响行数 = ${updateResult.affectedRows}`);
    
    // 5. 验证更新结果
    const [updatedRecord] = await db.execute(`
      SELECT * FROM reading_log 
      WHERE user_id = ? AND chapter_id = ?
      ORDER BY read_at DESC 
      LIMIT 1
    `, [userId, chapterId]);
    
    if (updatedRecord.length > 0) {
      console.log('\n📊 更新后的记录:');
      console.log(`   阅读时间: ${updatedRecord[0].read_at}`);
      console.log(`   是否解锁: ${updatedRecord[0].is_unlocked ? '是' : '否'}`);
      console.log(`   解锁时间: ${updatedRecord[0].unlock_time || '无'}`);
    }
    
  } catch (error) {
    console.error('调试失败:', error);
  } finally {
    if (db) await db.end();
  }
}

// 运行调试
debugReadingLogUpdate();
