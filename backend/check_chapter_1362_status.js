// 检查章节1362的状态和时间解锁条件
const mysql = require('mysql2/promise');

// 数据库配置
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '123456',
  database: process.env.DB_NAME || 'kongfuworld',
  charset: 'utf8mb4'
};

async function checkChapter1362Status() {
  let db;
  try {
    db = await mysql.createConnection(dbConfig);
    
    console.log('\n🔍 检查章节1362的状态和时间解锁条件\n');
    
    // 1. 查询章节基本信息
    const [chapters] = await db.execute(`
      SELECT c.*, n.title as novel_title 
      FROM chapter c 
      JOIN novel n ON c.novel_id = n.id 
      WHERE c.id = 1362
    `);
    
    if (chapters.length === 0) {
      console.log('❌ 章节1362不存在');
      return;
    }
    
    const chapter = chapters[0];
    console.log('📖 章节信息:');
    console.log(`   ID: ${chapter.id}`);
    console.log(`   标题: ${chapter.title}`);
    console.log(`   小说: ${chapter.novel_title}`);
    console.log(`   是否付费: ${chapter.is_premium ? '是' : '否'}`);
    console.log(`   Key成本: ${chapter.key_cost}`);
    console.log(`   解锁价格: ${chapter.unlock_price}`);
    
    // 2. 查询用户1的解锁记录
    const [unlocks] = await db.execute(`
      SELECT * FROM chapter_unlocks 
      WHERE user_id = 1 AND chapter_id = 1362
      ORDER BY created_at DESC
    `);
    
    console.log('\n🔓 解锁记录:');
    if (unlocks.length === 0) {
      console.log('   无解锁记录');
    } else {
      unlocks.forEach((unlock, index) => {
        console.log(`   ${index + 1}. 解锁方法: ${unlock.unlock_method}`);
        console.log(`      状态: ${unlock.status}`);
        console.log(`      创建时间: ${unlock.created_at}`);
        console.log(`      解锁时间: ${unlock.unlock_at || '未设置'}`);
        console.log(`      解锁完成时间: ${unlock.unlocked_at || '未完成'}`);
      });
    }
    
    // 3. 查询用户1的Champion会员状态
    const [championSubs] = await db.execute(`
      SELECT * FROM user_champion_subscription 
      WHERE user_id = 1 AND novel_id = ? AND is_active = 1 AND end_date > NOW()
    `, [chapter.novel_id]);
    
    console.log('\n🏅 Champion会员状态:');
    if (championSubs.length === 0) {
      console.log('   无有效Champion会员');
    } else {
      championSubs.forEach((sub, index) => {
        console.log(`   ${index + 1}. 会员ID: ${sub.id}`);
        console.log(`      开始时间: ${sub.start_date}`);
        console.log(`      结束时间: ${sub.end_date}`);
        console.log(`      是否活跃: ${sub.is_active ? '是' : '否'}`);
      });
    }
    
    // 4. 判断是否符合时间解锁条件
    console.log('\n⏰ 时间解锁条件分析:');
    
    const isUnlocked = unlocks.some(u => u.status === 'unlocked') || championSubs.length > 0;
    console.log(`   章节是否已解锁: ${isUnlocked ? '是' : '否'}`);
    
    if (isUnlocked) {
      console.log('   ✅ 章节已解锁，无需时间解锁');
    } else {
      console.log('   ❌ 章节未解锁，需要时间解锁');
      
      // 检查是否有进行中的时间解锁
      const pendingTimeUnlocks = unlocks.filter(u => u.unlock_method === 'time_unlock' && u.status === 'pending');
      if (pendingTimeUnlocks.length > 0) {
        console.log('   ⏳ 已有进行中的时间解锁:');
        pendingTimeUnlocks.forEach((unlock, index) => {
          console.log(`      ${index + 1}. 解锁时间: ${unlock.unlock_at}`);
          const unlockAt = new Date(unlock.unlock_at);
          const now = new Date();
          const timeRemaining = unlockAt.getTime() - now.getTime();
          console.log(`         剩余时间: ${Math.floor(timeRemaining / (1000 * 60 * 60))}小时${Math.floor((timeRemaining % (1000 * 60 * 60)) / (1000 * 60))}分钟`);
        });
      } else {
        console.log('   🚀 可以启动新的时间解锁');
      }
    }
    
  } catch (error) {
    console.error('检查失败:', error);
  } finally {
    if (db) await db.end();
  }
}

// 运行检查
checkChapter1362Status();
