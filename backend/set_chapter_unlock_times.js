// 为现有章节设置免费解锁时间
const mysql = require('mysql2');

// 数据库连接配置
const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: '123456',
  database: 'kongfuworld',
  charset: 'utf8mb4'
});

async function setChapterUnlockTimes() {
  try {
    console.log('开始为章节设置免费解锁时间...\n');
    
    // 1. 获取所有付费章节
    console.log('1. 查询付费章节...');
    const chapters = await new Promise((resolve, reject) => {
      db.query(`
        SELECT id, title, is_premium, free_unlock_time, created_at 
        FROM chapter 
        WHERE is_premium = 1 OR is_premium IS NULL
        ORDER BY id DESC
        LIMIT 10
      `, (err, results) => {
        if (err) reject(err);
        else resolve(results);
      });
    });
    
    console.log(`找到 ${chapters.length} 个章节`);
    
    // 2. 为每个章节设置免费解锁时间（发布后24小时）
    for (let i = 0; i < chapters.length; i++) {
      const chapter = chapters[i];
      const now = new Date();
      
      // 如果章节没有免费解锁时间，设置为创建时间后24小时
      let freeUnlockTime;
      if (chapter.free_unlock_time) {
        console.log(`章节 ${chapter.id} 已有解锁时间: ${chapter.free_unlock_time}`);
        continue;
      }
      
      // 设置解锁时间为创建时间后24小时，或者如果创建时间太早，设置为现在后24小时
      const createdTime = new Date(chapter.created_at);
      const unlockTime = new Date(Math.max(createdTime.getTime(), now.getTime() - 12 * 60 * 60 * 1000));
      freeUnlockTime = new Date(unlockTime.getTime() + 24 * 60 * 60 * 1000); // 24小时后
      
      // 更新章节
      await new Promise((resolve, reject) => {
        db.query(`
          UPDATE chapter 
          SET is_premium = 1, 
              free_unlock_time = ?,
              key_cost = 1,
              unlock_price = 13
          WHERE id = ?
        `, [freeUnlockTime, chapter.id], (err, result) => {
          if (err) reject(err);
          else resolve(result);
        });
      });
      
      console.log(`✓ 章节 ${chapter.id} (${chapter.title}) 设置解锁时间: ${freeUnlockTime.toLocaleString()}`);
    }
    
    // 3. 验证设置结果
    console.log('\n3. 验证设置结果...');
    const updatedChapters = await new Promise((resolve, reject) => {
      db.query(`
        SELECT id, title, is_premium, free_unlock_time, key_cost, unlock_price
        FROM chapter 
        WHERE is_premium = 1
        ORDER BY id DESC
        LIMIT 5
      `, (err, results) => {
        if (err) reject(err);
        else resolve(results);
      });
    });
    
    console.log('\n更新后的章节信息:');
    updatedChapters.forEach(chapter => {
      const unlockTime = new Date(chapter.free_unlock_time);
      const now = new Date();
      const diff = unlockTime.getTime() - now.getTime();
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      
      console.log(`- 章节 ${chapter.id}: ${chapter.title}`);
      console.log(`  解锁时间: ${unlockTime.toLocaleString()}`);
      console.log(`  剩余时间: ${hours}小时${minutes}分钟`);
      console.log(`  Key成本: ${chapter.key_cost}, 解锁价格: ${chapter.unlock_price}`);
      console.log('');
    });
    
    console.log('✅ 章节解锁时间设置完成！');
    
  } catch (error) {
    console.error('设置解锁时间时出错:', error);
  } finally {
    db.end();
  }
}

// 开始设置
setChapterUnlockTimes();
