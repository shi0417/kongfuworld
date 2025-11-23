// 查询今天完成的任务进度情况
const mysql = require('mysql2/promise');

// 数据库配置
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '123456',
  database: process.env.DB_NAME || 'kongfuworld',
  charset: 'utf8mb4'
};

async function checkTodayMissionProgress() {
  let db;
  try {
    db = await mysql.createConnection(dbConfig);
    
    const today = new Date().toISOString().slice(0, 10);
    console.log(`\n🔍 查询今天 (${today}) 的任务进度情况...\n`);
    
    // 1. 查询今天完成的任务
    console.log('📊 今天完成的任务：');
    const [completedMissions] = await db.execute(`
      SELECT 
        ump.user_id,
        ump.mission_id,
        mc.mission_key,
        mc.title,
        mc.target_value,
        ump.current_progress,
        ump.is_completed,
        ump.is_claimed,
        ump.progress_date,
        ump.created_at,
        ump.updated_at
      FROM user_mission_progress ump
      JOIN mission_config mc ON ump.mission_id = mc.id
      WHERE ump.progress_date = ? AND ump.is_completed = 1
      ORDER BY ump.user_id, ump.mission_id
    `, [today]);
    
    if (completedMissions.length === 0) {
      console.log('❌ 今天没有完成的任务');
    } else {
      completedMissions.forEach(mission => {
        console.log(`✅ 用户 ${mission.user_id}: ${mission.title} (${mission.mission_key})`);
        console.log(`   进度: ${mission.current_progress}/${mission.target_value}`);
        console.log(`   状态: ${mission.is_claimed ? '已领取奖励' : '未领取奖励'}`);
        console.log(`   完成时间: ${mission.updated_at}`);
        console.log('');
      });
    }
    
    // 2. 查询今天进行中的任务
    console.log('📈 今天进行中的任务：');
    const [inProgressMissions] = await db.execute(`
      SELECT 
        ump.user_id,
        ump.mission_id,
        mc.mission_key,
        mc.title,
        mc.target_value,
        ump.current_progress,
        ump.is_completed,
        ump.is_claimed,
        ump.progress_date,
        ump.created_at,
        ump.updated_at
      FROM user_mission_progress ump
      JOIN mission_config mc ON ump.mission_id = mc.id
      WHERE ump.progress_date = ? AND ump.is_completed = 0
      ORDER BY ump.user_id, ump.mission_id
    `, [today]);
    
    if (inProgressMissions.length === 0) {
      console.log('❌ 今天没有进行中的任务');
    } else {
      inProgressMissions.forEach(mission => {
        const percentage = Math.round((mission.current_progress / mission.target_value) * 100);
        console.log(`🔄 用户 ${mission.user_id}: ${mission.title} (${mission.mission_key})`);
        console.log(`   进度: ${mission.current_progress}/${mission.target_value} (${percentage}%)`);
        console.log(`   状态: 进行中`);
        console.log(`   更新时间: ${mission.updated_at}`);
        console.log('');
      });
    }
    
    // 3. 查询今天阅读的章节记录
    console.log('📖 今天阅读的章节记录：');
    const [todayReadingLogs] = await db.execute(`
      SELECT 
        rl.user_id,
        rl.chapter_id,
        rl.read_at,
        c.chapter_number,
        c.title as chapter_title,
        n.title as novel_title
      FROM reading_log rl
      JOIN chapter c ON rl.chapter_id = c.id
      JOIN novel n ON c.novel_id = n.id
      WHERE DATE(rl.read_at) = ?
      ORDER BY rl.user_id, rl.read_at
    `, [today]);
    
    if (todayReadingLogs.length === 0) {
      console.log('❌ 今天没有阅读记录');
    } else {
      console.log(`📚 今天共有 ${todayReadingLogs.length} 条阅读记录：`);
      todayReadingLogs.forEach(log => {
        console.log(`👤 用户 ${log.user_id}: ${log.novel_title} 第${log.chapter_number}章 - ${log.chapter_title}`);
        console.log(`   阅读时间: ${log.read_at}`);
        console.log('');
      });
    }
    
    // 4. 查询任务完成日志
    console.log('🎯 任务完成日志：');
    const [completionLogs] = await db.execute(`
      SELECT 
        mcl.user_id,
        mcl.mission_id,
        mc.mission_key,
        mc.title,
        mcl.reward_keys,
        mcl.reward_karma,
        mcl.completed_at,
        mcl.claimed_at
      FROM mission_completion_log mcl
      JOIN mission_config mc ON mcl.mission_id = mc.id
      WHERE DATE(mcl.completed_at) = ?
      ORDER BY mcl.user_id, mcl.completed_at
    `, [today]);
    
    if (completionLogs.length === 0) {
      console.log('❌ 今天没有任务完成日志');
    } else {
      completionLogs.forEach(log => {
        console.log(`🏆 用户 ${log.user_id}: ${log.title} (${log.mission_key})`);
        console.log(`   奖励: ${log.reward_keys} 钥匙, ${log.reward_karma} Karma`);
        console.log(`   完成时间: ${log.completed_at}`);
        console.log(`   领取时间: ${log.claimed_at || '未领取'}`);
        console.log('');
      });
    }
    
    // 5. 查询用户今天的钥匙和Karma变化
    console.log('💰 用户奖励统计：');
    const [userRewards] = await db.execute(`
      SELECT 
        u.id as user_id,
        u.username,
        u.points as current_points,
        u.golden_karma as current_karma,
        COALESCE(SUM(mcl.reward_keys), 0) as earned_keys,
        COALESCE(SUM(mcl.reward_karma), 0) as earned_karma
      FROM user u
      LEFT JOIN mission_completion_log mcl ON u.id = mcl.user_id 
        AND DATE(mcl.completed_at) = ? AND mcl.claimed_at IS NOT NULL
      GROUP BY u.id, u.username, u.points, u.golden_karma
      HAVING earned_keys > 0 OR earned_karma > 0
      ORDER BY u.id
    `, [today]);
    
    if (userRewards.length === 0) {
      console.log('❌ 今天没有用户获得奖励');
    } else {
      userRewards.forEach(user => {
        console.log(`👤 用户 ${user.user_id} (${user.username}):`);
        console.log(`   当前余额: ${user.current_points} 钥匙, ${user.current_karma} Karma`);
        console.log(`   今天获得: ${user.earned_keys} 钥匙, ${user.earned_karma} Karma`);
        console.log('');
      });
    }
    
    // 6. 总结统计
    console.log('📊 今日任务统计总结：');
    console.log(`✅ 完成的任务: ${completedMissions.length} 个`);
    console.log(`🔄 进行中的任务: ${inProgressMissions.length} 个`);
    console.log(`📖 阅读记录: ${todayReadingLogs.length} 条`);
    console.log(`🏆 任务完成日志: ${completionLogs.length} 条`);
    console.log(`💰 获得奖励的用户: ${userRewards.length} 个`);
    
  } catch (error) {
    console.error('查询失败:', error);
  } finally {
    if (db) await db.end();
  }
}

// 运行查询
checkTodayMissionProgress();
