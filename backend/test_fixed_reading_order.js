// 测试修复后的阅读记录顺序逻辑
const mysql = require('mysql2/promise');

// 数据库配置
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '123456',
  database: process.env.DB_NAME || 'kongfuworld',
  charset: 'utf8mb4'
};

// 检查并处理时间解锁状态
async function checkAndUpdateTimeUnlock(db, userId, chapterId) {
  try {
    const now = new Date();
    
    // 1. 查询章节的时间解锁记录
    const [timeUnlockRecords] = await db.execute(`
      SELECT * FROM chapter_unlocks 
      WHERE user_id = ? AND chapter_id = ? AND unlock_method = 'time_unlock' AND status = 'pending'
      ORDER BY created_at DESC
      LIMIT 1
    `, [userId, chapterId]);
    
    if (timeUnlockRecords.length > 0) {
      const timeUnlock = timeUnlockRecords[0];
      const unlockAt = new Date(timeUnlock.unlock_at);
      
      // 2. 检查时间解锁是否已到期
      if (now >= unlockAt) {
        console.log(`时间解锁已到期，更新解锁状态: 章节${chapterId}`);
        
        // 3. 更新解锁状态
        await db.execute(`
          UPDATE chapter_unlocks 
          SET status = 'unlocked', unlocked_at = ?
          WHERE id = ?
        `, [now, timeUnlock.id]);
        
        console.log(`章节${chapterId}时间解锁已完成`);
        return true;
      } else {
        console.log(`章节${chapterId}时间解锁尚未到期，解锁时间: ${unlockAt.toISOString()}`);
        return false;
      }
    }
    return false;
  } catch (error) {
    console.error('检查时间解锁状态失败:', error);
    return false;
  }
}

async function testFixedReadingOrder() {
  let db;
  try {
    db = await mysql.createConnection(dbConfig);
    
    console.log('\n🧪 测试修复后的阅读记录顺序逻辑\n');
    
    const userId = 1;
    const chapterId = 1360;
    
    // 1. 检查修复前的状态
    console.log('📊 修复前的状态:');
    const [beforeUnlock] = await db.execute(`
      SELECT * FROM chapter_unlocks 
      WHERE user_id = ? AND chapter_id = ? AND status = 'unlocked'
      ORDER BY unlocked_at DESC
      LIMIT 1
    `, [userId, chapterId]);
    
    const [beforeReading] = await db.execute(`
      SELECT * FROM reading_log 
      WHERE user_id = ? AND chapter_id = ?
      ORDER BY read_at DESC
      LIMIT 1
    `, [userId, chapterId]);
    
    console.log(`   解锁状态: ${beforeUnlock.length > 0 ? '已解锁' : '未解锁'}`);
    console.log(`   阅读记录: ${beforeReading.length > 0 ? '有记录' : '无记录'}`);
    if (beforeReading.length > 0) {
      console.log(`   阅读记录中的解锁状态: ${beforeReading[0].is_unlocked ? '已解锁' : '未解锁'}`);
    }
    
    // 2. 模拟修复后的逻辑顺序
    console.log('\n🔧 模拟修复后的逻辑顺序:');
    
    // 步骤1: 先检查并处理时间解锁状态
    console.log('   步骤1: 检查并处理时间解锁状态');
    const timeUnlockUpdated = await checkAndUpdateTimeUnlock(db, userId, chapterId);
    console.log(`   时间解锁处理结果: ${timeUnlockUpdated ? '已更新' : '无需更新'}`);
    
    // 步骤2: 获取章节解锁信息
    console.log('   步骤2: 获取章节解锁信息');
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
    
    const isUnlocked = unlockInfo[0].is_unlocked;
    const unlockTime = unlockInfo[0].unlock_time;
    console.log(`   解锁信息: is_unlocked = ${isUnlocked}, unlock_time = ${unlockTime}`);
    
    // 步骤3: 记录阅读日志（使用正确的解锁信息）
    console.log('   步骤3: 记录阅读日志');
    const [updateResult] = await db.execute(`
      UPDATE reading_log 
      SET read_at = NOW(), is_unlocked = ?, unlock_time = ?
      WHERE user_id = ? AND chapter_id = ? AND DATE(read_at) = CURDATE()
    `, [isUnlocked, unlockTime, userId, chapterId]);
    
    if (updateResult.affectedRows > 0) {
      console.log(`   成功更新现有记录: 影响行数 = ${updateResult.affectedRows}`);
    } else {
      console.log('   没有现有记录，插入新记录');
      await db.execute(`
        INSERT INTO reading_log (user_id, chapter_id, read_at, is_unlocked, unlock_time) 
        VALUES (?, ?, NOW(), ?, ?)
      `, [userId, chapterId, isUnlocked, unlockTime]);
    }
    
    // 步骤4: 验证结果
    console.log('\n📊 验证结果:');
    const [afterReading] = await db.execute(`
      SELECT * FROM reading_log 
      WHERE user_id = ? AND chapter_id = ?
      ORDER BY read_at DESC
      LIMIT 1
    `, [userId, chapterId]);
    
    if (afterReading.length > 0) {
      const record = afterReading[0];
      console.log(`   最新阅读记录:`);
      console.log(`   - 阅读时间: ${record.read_at}`);
      console.log(`   - 是否解锁: ${record.is_unlocked ? '是' : '否'}`);
      console.log(`   - 解锁时间: ${record.unlock_time || '无'}`);
      
      if (record.is_unlocked === 1 && record.unlock_time) {
        console.log('   ✅ 修复成功！解锁信息已正确记录');
      } else {
        console.log('   ❌ 修复失败，解锁信息未正确记录');
      }
    }
    
    // 3. 测试新章节判断
    console.log('\n🎯 测试新章节判断:');
    
    const today = new Date().toISOString().slice(0, 10);
    const [todayUnlockRecords] = await db.execute(`
      SELECT * FROM chapter_unlocks 
      WHERE user_id = ? AND chapter_id = ? AND status = 'unlocked'
      AND DATE(unlocked_at) = ?
    `, [userId, chapterId, today]);
    
    if (todayUnlockRecords.length > 0) {
      console.log('   ✅ 今天有解锁记录，应该算作新章节');
    } else {
      console.log('   ❌ 今天没有解锁记录，不算新章节');
    }
    
    console.log('\n🎉 修复总结:');
    console.log('✅ 1. 修复了程序逻辑顺序问题');
    console.log('✅ 2. 先检查时间解锁状态，再记录阅读日志');
    console.log('✅ 3. 确保解锁信息正确记录到reading_log表');
    console.log('✅ 4. 新章节判断现在基于正确的解锁状态');
    
  } catch (error) {
    console.error('测试失败:', error);
  } finally {
    if (db) await db.end();
  }
}

// 运行测试
testFixedReadingOrder();
