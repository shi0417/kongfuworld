// 检查章节1358的解锁状态
const mysql = require('mysql2/promise');

// 数据库配置
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '123456',
  database: process.env.DB_NAME || 'kongfuworld',
  charset: 'utf8mb4'
};

async function checkChapter1358Status() {
  let db;
  try {
    db = await mysql.createConnection(dbConfig);
    
    console.log('\n🔍 检查章节1358的解锁状态\n');
    
    const userId = 1;
    const chapterId = 1358;
    
    // 1. 检查章节信息
    console.log('📊 1. 章节信息:');
    const [chapters] = await db.execute(`
      SELECT c.*, n.title as novel_title 
      FROM chapter c 
      JOIN novel n ON c.novel_id = n.id 
      WHERE c.id = ?
    `, [chapterId]);
    
    if (chapters.length === 0) {
      console.log('   ❌ 章节不存在');
      return;
    }
    
    const chapter = chapters[0];
    console.log(`   章节ID: ${chapter.id}`);
    console.log(`   章节号: ${chapter.chapter_number}`);
    console.log(`   小说标题: ${chapter.novel_title}`);
    console.log(`   是否付费: ${chapter.is_premium}`);
    console.log(`   Key消耗: ${chapter.key_cost}`);
    console.log(`   免费解锁时间: ${chapter.free_unlock_time}`);
    
    // 2. 检查用户信息
    console.log('\n📊 2. 用户信息:');
    const [users] = await db.execute('SELECT * FROM user WHERE id = ?', [userId]);
    if (users.length === 0) {
      console.log('   ❌ 用户不存在');
      return;
    }
    
    const user = users[0];
    console.log(`   用户ID: ${user.id}`);
    console.log(`   用户名: ${user.username}`);
    console.log(`   Key余额: ${user.points}`);
    console.log(`   金色Karma: ${user.golden_karma}`);
    
    // 3. 检查章节解锁记录
    console.log('\n📊 3. 章节解锁记录:');
    const [unlocks] = await db.execute(`
      SELECT * FROM chapter_unlocks 
      WHERE user_id = ? AND chapter_id = ?
    `, [userId, chapterId]);
    
    if (unlocks.length === 0) {
      console.log('   ❌ 没有解锁记录');
    } else {
      unlocks.forEach((unlock, index) => {
        console.log(`   记录${index + 1}:`);
        console.log(`     解锁方法: ${unlock.unlock_method}`);
        console.log(`     状态: ${unlock.status}`);
        console.log(`     消耗: ${unlock.cost}`);
        console.log(`     解锁时间: ${unlock.unlocked_at}`);
        console.log(`     创建时间: ${unlock.created_at}`);
      });
    }
    
    // 4. 检查Champion会员状态
    console.log('\n📊 4. Champion会员状态:');
    const [championSubs] = await db.execute(`
      SELECT * FROM user_champion_subscription 
      WHERE user_id = ? AND novel_id = ? AND is_active = 1 AND end_date > NOW()
    `, [userId, chapter.novel_id]);
    
    if (championSubs.length === 0) {
      console.log('   ❌ 没有有效的Champion会员');
    } else {
      championSubs.forEach((sub, index) => {
        console.log(`   会员${index + 1}:`);
        console.log(`     开始时间: ${sub.start_date}`);
        console.log(`     结束时间: ${sub.end_date}`);
        console.log(`     是否激活: ${sub.is_active}`);
      });
    }
    
    // 5. 检查时间解锁状态
    console.log('\n📊 5. 时间解锁状态:');
    const [timeUnlocks] = await db.execute(`
      SELECT * FROM chapter_unlocks 
      WHERE user_id = ? AND chapter_id = ? AND unlock_method = 'time_unlock'
    `, [userId, chapterId]);
    
    if (timeUnlocks.length === 0) {
      console.log('   ❌ 没有时间解锁记录');
    } else {
      timeUnlocks.forEach((timeUnlock, index) => {
        console.log(`   时间解锁${index + 1}:`);
        console.log(`     状态: ${timeUnlock.status}`);
        console.log(`     解锁时间: ${timeUnlock.unlock_at}`);
        console.log(`     当前时间: ${new Date().toISOString()}`);
        
        if (timeUnlock.unlock_at) {
          const unlockTime = new Date(timeUnlock.unlock_at);
          const now = new Date();
          const isExpired = now >= unlockTime;
          console.log(`     是否已到期: ${isExpired}`);
        }
      });
    }
    
    // 6. 综合判断解锁状态
    console.log('\n📊 6. 综合判断解锁状态:');
    
    // 检查是否免费章节
    const now = new Date();
    const isFree = !chapter.is_premium || 
                   (chapter.free_unlock_time && new Date(chapter.free_unlock_time) <= now);
    
    if (isFree) {
      console.log('   ✅ 免费章节，已解锁');
    } else if (championSubs.length > 0) {
      console.log('   ✅ Champion会员，已解锁');
    } else if (unlocks.some(u => u.status === 'unlocked')) {
      console.log('   ✅ 已付费解锁');
    } else if (timeUnlocks.length > 0) {
      const timeUnlock = timeUnlocks[0];
      if (timeUnlock.status === 'unlocked') {
        console.log('   ✅ 时间解锁已完成');
      } else if (timeUnlock.unlock_at && new Date(timeUnlock.unlock_at) <= now) {
        console.log('   ✅ 时间解锁已到期，应该自动解锁');
      } else {
        console.log('   ❌ 时间解锁等待中');
      }
    } else {
      console.log('   ❌ 章节未解锁');
    }
    
    // 7. 检查API应该返回的状态
    console.log('\n📊 7. API应该返回的状态:');
    const isUnlocked = isFree || 
                       championSubs.length > 0 || 
                       unlocks.some(u => u.status === 'unlocked') ||
                       (timeUnlocks.length > 0 && timeUnlocks[0].status === 'unlocked');
    
    console.log(`   isUnlocked: ${isUnlocked}`);
    console.log(`   canUnlockWithKey: ${user.points >= chapter.key_cost && chapter.key_cost > 0}`);
    console.log(`   hasChampionSubscription: ${championSubs.length > 0}`);
    
  } catch (error) {
    console.error('检查失败:', error);
  } finally {
    if (db) await db.end();
  }
}

// 运行检查
checkChapter1358Status();
