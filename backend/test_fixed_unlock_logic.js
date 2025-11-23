// 测试修复后的解锁逻辑
const mysql = require('mysql2/promise');

// 数据库连接配置
const dbConfig = {
  host: 'localhost',
  user: 'root',
  password: '123456',
  database: 'kongfuworld',
  charset: 'utf8mb4'
};

async function testFixedUnlockLogic() {
  console.log('🧪 测试修复后的解锁逻辑...\n');
  
  const userId = 1;
  const chapterId = 1320;
  
  let db;
  try {
    db = await mysql.createConnection(dbConfig);
    
    // 1. 获取章节信息
    const [chapters] = await db.execute('SELECT id, novel_id, is_premium FROM chapter WHERE id = ?', [chapterId]);
    const chapter = chapters[0];
    
    // 2. 检查chapter_unlocks表中的解锁记录
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
    
    console.log('1️⃣ chapter_unlocks表解锁状态:');
    console.log(`   is_unlocked: ${unlockInfo[0].is_unlocked}`);
    console.log(`   unlock_time: ${unlockInfo[0].unlock_time}`);
    
    // 3. 检查Champion会员状态
    const [championSubs] = await db.execute(`
      SELECT * FROM user_champion_subscription 
      WHERE user_id = ? AND novel_id = ? AND is_active = 1 AND end_date > NOW()
    `, [userId, chapter.novel_id]);
    
    const hasValidChampion = championSubs.length > 0;
    console.log('\n2️⃣ Champion会员状态:');
    console.log(`   hasValidChampion: ${hasValidChampion}`);
    if (championSubs.length > 0) {
      console.log(`   会员详情: ${championSubs[0].tier_name} (${championSubs[0].end_date})`);
    }
    
    // 4. 综合判断解锁状态
    const isUnlocked = unlockInfo[0].is_unlocked || hasValidChampion;
    const unlockTime = unlockInfo[0].unlock_time || (hasValidChampion ? new Date() : null);
    
    console.log('\n3️⃣ 综合解锁状态:');
    console.log(`   isUnlocked: ${isUnlocked}`);
    console.log(`   unlockTime: ${unlockTime}`);
    
    // 5. 检查当前阅读记录
    const [readingRecords] = await db.execute(`
      SELECT * FROM reading_log 
      WHERE user_id = ? AND chapter_id = ?
      ORDER BY read_at DESC
      LIMIT 1
    `, [userId, chapterId]);
    
    console.log('\n4️⃣ 当前阅读记录:');
    if (readingRecords.length > 0) {
      const record = readingRecords[0];
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

testFixedUnlockLogic();
