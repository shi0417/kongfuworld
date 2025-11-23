// 调试用户订阅状态
const mysql = require('mysql2');

// 数据库连接配置
const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: '123456',
  database: 'kongfuworld',
  charset: 'utf8mb4'
});

async function debugUserSubscription() {
  try {
    console.log('开始调试用户订阅状态...\n');
    
    const userId = 1;
    const novelId = 10;
    
    // 1. 检查用户基本信息
    console.log('1. 检查用户基本信息:');
    const user = await new Promise((resolve, reject) => {
      db.query(`
        SELECT id, username, subscription_status, subscription_end_date
        FROM user 
        WHERE id = ?
      `, [userId], (err, results) => {
        if (err) reject(err);
        else resolve(results[0]);
      });
    });
    
    if (user) {
      console.log(`用户ID: ${user.id}`);
      console.log(`用户名: ${user.username}`);
      console.log(`全局订阅状态: ${user.subscription_status}`);
      console.log(`订阅结束时间: ${user.subscription_end_date}`);
    } else {
      console.log('❌ 用户不存在');
      return;
    }
    
    // 2. 检查用户对该小说的Champion订阅
    console.log('\n2. 检查用户对小说10的Champion订阅:');
    const championSubscription = await new Promise((resolve, reject) => {
      db.query(`
        SELECT * FROM user_champion_subscription 
        WHERE user_id = ? AND novel_id = ?
      `, [userId, novelId], (err, results) => {
        if (err) reject(err);
        else resolve(results);
      });
    });
    
    console.log(`找到 ${championSubscription.length} 条Champion订阅记录:`);
    championSubscription.forEach((sub, index) => {
      console.log(`订阅 ${index + 1}:`);
      console.log(`- 订阅ID: ${sub.id}`);
      console.log(`- 用户ID: ${sub.user_id}`);
      console.log(`- 小说ID: ${sub.novel_id}`);
      console.log(`- 等级: ${sub.tier_level}`);
      console.log(`- 是否激活: ${sub.is_active}`);
      console.log(`- 开始时间: ${sub.start_date}`);
      console.log(`- 结束时间: ${sub.end_date}`);
      console.log(`- 创建时间: ${sub.created_at}`);
    });
    
    // 3. 检查小说10的章节锁定情况
    console.log('\n3. 检查小说10的章节锁定情况:');
    const chapters = await new Promise((resolve, reject) => {
      db.query(`
        SELECT id, title, is_locked, is_premium, free_unlock_time
        FROM chapter 
        WHERE novel_id = ?
        ORDER BY chapter_number
        LIMIT 5
      `, [novelId], (err, results) => {
        if (err) reject(err);
        else resolve(results);
      });
    });
    
    console.log(`小说10有 ${chapters.length} 个章节:`);
    chapters.forEach((chapter, index) => {
      console.log(`章节 ${index + 1}:`);
      console.log(`- 章节ID: ${chapter.id}`);
      console.log(`- 标题: ${chapter.title}`);
      console.log(`- 是否锁定: ${chapter.is_locked}`);
      console.log(`- 是否付费: ${chapter.is_premium}`);
      console.log(`- 免费解锁时间: ${chapter.free_unlock_time}`);
    });
    
    // 4. 检查用户对小说10章节的解锁记录
    console.log('\n4. 检查用户对小说10章节的解锁记录:');
    const unlockRecords = await new Promise((resolve, reject) => {
      db.query(`
        SELECT cu.*, c.title as chapter_title
        FROM chapter_unlocks cu
        JOIN chapter c ON cu.chapter_id = c.id
        WHERE cu.user_id = ? AND c.novel_id = ?
        ORDER BY cu.unlocked_at DESC
        LIMIT 5
      `, [userId, novelId], (err, results) => {
        if (err) reject(err);
        else resolve(results);
      });
    });
    
    console.log(`用户对小说10有 ${unlockRecords.length} 条解锁记录:`);
    unlockRecords.forEach((record, index) => {
      console.log(`解锁记录 ${index + 1}:`);
      console.log(`- 章节ID: ${record.chapter_id}`);
      console.log(`- 章节标题: ${record.chapter_title}`);
      console.log(`- 解锁方式: ${record.unlock_method}`);
      console.log(`- 解锁时间: ${record.unlocked_at}`);
    });
    
    // 5. 检查当前时间
    console.log('\n5. 当前时间检查:');
    const now = new Date();
    console.log(`当前时间: ${now.toLocaleString()}`);
    
    // 6. 检查Champion订阅是否有效
    if (championSubscription.length > 0) {
      console.log('\n6. Champion订阅有效性检查:');
      championSubscription.forEach((sub, index) => {
        const endDate = new Date(sub.end_date);
        const isActive = sub.is_active === 1;
        const isNotExpired = endDate > now;
        const isValid = isActive && isNotExpired;
        
        console.log(`订阅 ${index + 1} 有效性:`);
        console.log(`- 是否激活: ${isActive}`);
        console.log(`- 是否未过期: ${isNotExpired} (结束时间: ${sub.end_date})`);
        console.log(`- 订阅是否有效: ${isValid}`);
      });
    }
    
  } catch (error) {
    console.error('调试失败:', error);
  } finally {
    db.end();
  }
}

// 开始调试
debugUserSubscription();
