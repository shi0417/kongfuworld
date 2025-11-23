// 测试Champion会员首次阅读章节的逻辑
const mysql = require('mysql2/promise');

// 数据库连接配置
const dbConfig = {
  host: 'localhost',
  user: 'root',
  password: '123456',
  database: 'kongfuworld',
  charset: 'utf8mb4'
};

async function testChampionFirstRead() {
  console.log('🧪 测试Champion会员首次阅读章节的逻辑...\n');
  
  const userId = 1;
  const chapterId = 1321; // 使用一个新的章节ID进行测试
  
  let db;
  try {
    db = await mysql.createConnection(dbConfig);
    
    // 1. 检查章节信息
    const [chapters] = await db.execute('SELECT id, novel_id, is_premium FROM chapter WHERE id = ?', [chapterId]);
    if (chapters.length === 0) {
      console.log('❌ 章节不存在');
      return;
    }
    const chapter = chapters[0];
    console.log('1️⃣ 章节信息:', chapter);
    
    // 2. 检查是否有历史阅读记录
    const [existingRecords] = await db.execute(`
      SELECT COUNT(*) as count FROM reading_log 
      WHERE user_id = ? AND chapter_id = ?
    `, [userId, chapterId]);
    
    const hasHistoryRecords = existingRecords[0].count > 0;
    console.log('\n2️⃣ 历史阅读记录检查:');
    console.log(`   是否有历史记录: ${hasHistoryRecords}`);
    
    // 3. 检查Champion会员状态
    const [championSubs] = await db.execute(`
      SELECT * FROM user_champion_subscription 
      WHERE user_id = ? AND novel_id = ? AND is_active = 1 AND end_date > NOW()
    `, [userId, chapter.novel_id]);
    
    const hasValidChampion = championSubs.length > 0;
    console.log('\n3️⃣ Champion会员状态:');
    console.log(`   hasValidChampion: ${hasValidChampion}`);
    
    // 4. 检查chapter_unlocks表
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
    
    console.log('\n4️⃣ chapter_unlocks表状态:');
    console.log(`   is_unlocked: ${unlockInfo[0].is_unlocked}`);
    console.log(`   unlock_time: ${unlockInfo[0].unlock_time}`);
    
    // 5. 综合判断解锁状态
    const isUnlocked = unlockInfo[0].is_unlocked || hasValidChampion;
    const unlockTime = unlockInfo[0].unlock_time || (hasValidChampion ? new Date() : null);
    
    console.log('\n5️⃣ 综合解锁状态:');
    console.log(`   isUnlocked: ${isUnlocked}`);
    console.log(`   unlockTime: ${unlockTime}`);
    
    // 6. 模拟记录阅读日志
    if (hasHistoryRecords) {
      console.log('\n6️⃣ 有历史记录，更新今天的记录...');
      const [updateResult] = await db.execute(`
        UPDATE reading_log 
        SET read_at = NOW(), is_unlocked = ?, unlock_time = ?
        WHERE user_id = ? AND chapter_id = ? AND DATE(read_at) = CURDATE()
      `, [isUnlocked, unlockTime, userId, chapterId]);
      
      if (updateResult.affectedRows === 0) {
        console.log('   今天没有记录，插入新记录...');
        await db.execute(`
          INSERT INTO reading_log (user_id, chapter_id, read_at, is_unlocked, unlock_time) 
          VALUES (?, ?, NOW(), ?, ?)
        `, [userId, chapterId, isUnlocked, unlockTime]);
      } else {
        console.log('   更新了今天的记录');
      }
    } else {
      console.log('\n6️⃣ 没有历史记录，首次阅读，插入新记录...');
      await db.execute(`
        INSERT INTO reading_log (user_id, chapter_id, read_at, is_unlocked, unlock_time) 
        VALUES (?, ?, NOW(), ?, ?)
      `, [userId, chapterId, isUnlocked, unlockTime]);
      
      console.log(`[DEBUG] 用户 ${userId} 首次阅读章节 ${chapterId}，解锁状态: ${isUnlocked}, 解锁时间: ${unlockTime}`);
    }
    
    // 7. 检查记录结果
    const [newRecords] = await db.execute(`
      SELECT * FROM reading_log 
      WHERE user_id = ? AND chapter_id = ?
      ORDER BY read_at DESC
      LIMIT 1
    `, [userId, chapterId]);
    
    console.log('\n7️⃣ 记录结果:');
    if (newRecords.length > 0) {
      const record = newRecords[0];
      console.log(`   read_at: ${record.read_at}`);
      console.log(`   is_unlocked: ${record.is_unlocked}`);
      console.log(`   unlock_time: ${record.unlock_time}`);
    }
    
    console.log('\n✅ 测试完成！');
    
  } catch (error) {
    console.error('❌ 测试失败:', error);
  } finally {
    if (db) await db.end();
  }
}

testChampionFirstRead();
