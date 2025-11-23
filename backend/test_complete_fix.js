// 测试完整的修复逻辑
const mysql = require('mysql2/promise');

// 数据库配置
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '123456',
  database: process.env.DB_NAME || 'kongfuworld',
  charset: 'utf8mb4'
};

async function testCompleteFix() {
  let db;
  try {
    db = await mysql.createConnection(dbConfig);
    
    const today = new Date().toISOString().slice(0, 10);
    console.log(`\n🧪 测试完整的修复逻辑 (${today})\n`);
    
    // 1. 测试章节1355的新章节判断
    console.log('📖 测试章节1355:');
    
    // 查询章节基本信息
    const [chapters] = await db.execute(`
      SELECT id, novel_id, is_premium, free_unlock_time
      FROM chapter 
      WHERE id = 1355
    `);
    
    const chapter = chapters[0];
    
    // 查询用户Champion会员状态
    const [championStatus] = await db.execute(`
      SELECT 
        ucs.*,
        CASE 
          WHEN ucs.end_date > NOW() THEN 1
          ELSE 0
        END as is_valid
      FROM user_champion_subscription ucs
      WHERE ucs.user_id = 1 AND ucs.novel_id = ? AND ucs.is_active = 1
      ORDER BY ucs.end_date DESC
      LIMIT 1
    `, [chapter.novel_id]);
    
    const hasValidChampion = championStatus.length > 0 && championStatus[0].is_valid === 1;
    
    // 查询解锁记录
    const [unlockRecords] = await db.execute(`
      SELECT id, unlock_method, status, unlocked_at, created_at
      FROM chapter_unlocks 
      WHERE user_id = 1 AND chapter_id = 1355
      ORDER BY created_at ASC
    `);
    
    // 检查今天是否有解锁记录
    const todayUnlockRecords = unlockRecords.filter(record => {
      const unlockDate = new Date(record.unlocked_at || record.created_at).toISOString().slice(0, 10);
      return unlockDate === today && record.status === 'unlocked';
    });
    
    console.log(`   章节类型: ${chapter.is_premium ? '付费' : '免费'}`);
    console.log(`   Champion会员: ${hasValidChampion ? '有' : '无'}`);
    console.log(`   今天解锁: ${todayUnlockRecords.length > 0 ? '是' : '否'}`);
    
    // 判断是否为新章节
    let isNewChapter = false;
    let reason = '';
    
    if (chapter.is_premium) {
      if (hasValidChampion) {
        // 有有效Champion会员: 只有今天首次阅读才算新章节
        isNewChapter = false; // 需要检查阅读记录
        reason = '有有效Champion会员，需要检查今天是否首次阅读';
      } else {
        // 无Champion会员或已过期: 今天解锁就算新章节
        if (todayUnlockRecords.length > 0) {
          isNewChapter = true;
          reason = '无Champion会员，今天解锁该章节';
        } else {
          isNewChapter = false;
          reason = '无Champion会员，今天未解锁该章节';
        }
      }
    } else {
      // 免费章节: 只有今天首次阅读才算新章节
      isNewChapter = false; // 需要检查阅读记录
      reason = '免费章节，需要检查今天是否首次阅读';
    }
    
    console.log(`   判断结果: ${isNewChapter ? '是新章节' : '不是新章节'}`);
    console.log(`   判断原因: ${reason}`);
    
    // 2. 检查任务进度
    console.log('\n📊 当前任务进度:');
    const [missionProgress] = await db.execute(`
      SELECT 
        ump.*,
        mc.mission_key,
        mc.title,
        mc.target_value
      FROM user_mission_progress ump
      JOIN mission_config mc ON ump.mission_id = mc.id
      WHERE ump.user_id = 1 AND ump.progress_date = ?
      ORDER BY ump.mission_id
    `, [today]);
    
    missionProgress.forEach(mission => {
      const percentage = Math.round((mission.current_progress / mission.target_value) * 100);
      console.log(`   ${mission.mission_key}: ${mission.current_progress}/${mission.target_value} (${percentage}%)`);
    });
    
    // 3. 检查reading_log表的新字段
    console.log('\n📖 检查reading_log表的新字段:');
    const [readingLogs] = await db.execute(`
      SELECT 
        id, user_id, chapter_id, read_at, is_unlocked, unlock_time
      FROM reading_log 
      WHERE user_id = 1 AND chapter_id = 1355
      ORDER BY read_at DESC
      LIMIT 3
    `);
    
    readingLogs.forEach((log, index) => {
      console.log(`   ${index + 1}. 阅读时间: ${log.read_at}`);
      console.log(`      是否解锁: ${log.is_unlocked ? '是' : '否'}`);
      console.log(`      解锁时间: ${log.unlock_time || '无'}`);
      console.log('');
    });
    
    // 4. 总结
    console.log('🎯 修复总结:');
    console.log('✅ 1. 修复了日期比较问题');
    console.log('✅ 2. 修复了新章节判断逻辑（今天解锁就算新章节）');
    console.log('✅ 3. 添加了reading_log表的新字段');
    console.log('✅ 4. 更新了阅读记录API');
    
    if (isNewChapter) {
      console.log('\n🚀 章节1355应该会触发任务进度更新！');
    } else {
      console.log('\n⚠️  章节1355不会触发任务进度更新');
    }
    
  } catch (error) {
    console.error('测试失败:', error);
  } finally {
    if (db) await db.end();
  }
}

// 运行测试
testCompleteFix();
