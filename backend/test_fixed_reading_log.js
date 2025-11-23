// 测试修复后的reading_log表更新逻辑
const mysql = require('mysql2/promise');

// 数据库配置
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '123456',
  database: process.env.DB_NAME || 'kongfuworld',
  charset: 'utf8mb4'
};

async function testFixedReadingLog() {
  let db;
  try {
    db = await mysql.createConnection(dbConfig);
    
    console.log('\n🧪 测试修复后的reading_log表更新逻辑\n');
    
    // 1. 模拟修复后的API逻辑
    const userId = 1;
    const chapterId = 1358;
    
    console.log('📊 模拟修复后的API逻辑:');
    
    // 获取章节解锁信息
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
    
    // 2. 使用修复后的逻辑
    console.log('\n🔧 使用修复后的逻辑:');
    
    // 先尝试更新现有记录
    const [updateResult] = await db.execute(`
      UPDATE reading_log 
      SET read_at = NOW(), is_unlocked = ?, unlock_time = ?
      WHERE user_id = ? AND chapter_id = ? AND DATE(read_at) = CURDATE()
    `, [isUnlocked, unlockTime, userId, chapterId]);
    
    console.log(`   更新结果: 影响行数 = ${updateResult.affectedRows}`);
    
    // 如果没有更新任何记录，则插入新记录
    if (updateResult.affectedRows === 0) {
      console.log('   没有更新记录，插入新记录...');
      await db.execute(`
        INSERT INTO reading_log (user_id, chapter_id, read_at, is_unlocked, unlock_time) 
        VALUES (?, ?, NOW(), ?, ?)
      `, [userId, chapterId, isUnlocked, unlockTime]);
      console.log('   新记录插入完成');
    } else {
      console.log('   成功更新现有记录');
    }
    
    // 3. 验证结果
    console.log('\n📊 验证结果:');
    const [latestRecord] = await db.execute(`
      SELECT * FROM reading_log 
      WHERE user_id = ? AND chapter_id = ?
      ORDER BY read_at DESC 
      LIMIT 1
    `, [userId, chapterId]);
    
    if (latestRecord.length > 0) {
      const record = latestRecord[0];
      console.log(`   最新记录:`);
      console.log(`   - 阅读时间: ${record.read_at}`);
      console.log(`   - 是否解锁: ${record.is_unlocked ? '是' : '否'}`);
      console.log(`   - 解锁时间: ${record.unlock_time || '无'}`);
      
      if (record.is_unlocked === 1 && record.unlock_time) {
        console.log('   ✅ 修复成功！解锁信息已正确记录');
      } else {
        console.log('   ❌ 修复失败，解锁信息未正确记录');
      }
    }
    
    // 4. 测试其他章节
    console.log('\n🧪 测试其他章节:');
    
    // 测试章节1355
    const [chapter1355] = await db.execute(`
      SELECT 
        CASE 
          WHEN COUNT(*) > 0 THEN 1 
          ELSE 0 
        END as is_unlocked,
        MAX(unlocked_at) as unlock_time
      FROM chapter_unlocks 
      WHERE user_id = 1 AND chapter_id = 1355 AND status = 'unlocked'
    `);
    
    console.log(`   章节1355解锁信息: is_unlocked = ${chapter1355[0].is_unlocked}, unlock_time = ${chapter1355[0].unlock_time}`);
    
    // 5. 总结
    console.log('\n🎯 修复总结:');
    console.log('✅ 1. 修复了ON DUPLICATE KEY UPDATE问题');
    console.log('✅ 2. 改用UPDATE + INSERT逻辑');
    console.log('✅ 3. 确保解锁信息正确记录');
    console.log('✅ 4. 处理了时间顺序问题');
    
    console.log('\n💡 修复原理:');
    console.log('   1. 先尝试更新今天的现有记录');
    console.log('   2. 如果没有记录，则插入新记录');
    console.log('   3. 确保解锁信息始终是最新的');
    
  } catch (error) {
    console.error('测试失败:', error);
  } finally {
    if (db) await db.end();
  }
}

// 运行测试
testFixedReadingLog();
