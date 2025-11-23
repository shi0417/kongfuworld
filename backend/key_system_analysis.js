// Key系统数据库表分析
const mysql = require('mysql2/promise');

// 数据库配置
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '123456',
  database: process.env.DB_NAME || 'kongfuworld',
  charset: 'utf8mb4'
};

async function analyzeKeySystem() {
  let db;
  try {
    db = await mysql.createConnection(dbConfig);
    
    console.log('\n🔑 Key系统数据库表分析\n');
    
    // 1. 分析user表 - 存储用户key余额
    console.log('📊 1. user表 - 存储用户key余额:');
    const [userColumns] = await db.execute(`DESCRIBE user`);
    const keyRelatedColumns = userColumns.filter(col => 
      col.Field.includes('point') || col.Field.includes('key') || col.Field.includes('karma')
    );
    
    keyRelatedColumns.forEach(col => {
      console.log(`   ${col.Field}: ${col.Type} ${col.Null === 'NO' ? 'NOT NULL' : 'NULL'} ${col.Default ? `DEFAULT ${col.Default}` : ''}`);
    });
    
    // 查询用户当前key余额
    const [userData] = await db.execute(`SELECT id, username, points, golden_karma FROM user WHERE id = 1`);
    if (userData.length > 0) {
      console.log(`   用户1当前余额: points=${userData[0].points}, golden_karma=${userData[0].golden_karma}`);
    }
    
    // 2. 分析mission_config表 - 任务奖励配置
    console.log('\n📊 2. mission_config表 - 任务奖励配置:');
    const [missionColumns] = await db.execute(`DESCRIBE mission_config`);
    const rewardColumns = missionColumns.filter(col => 
      col.Field.includes('reward') || col.Field.includes('key')
    );
    
    rewardColumns.forEach(col => {
      console.log(`   ${col.Field}: ${col.Type} ${col.Null === 'NO' ? 'NOT NULL' : 'NULL'} ${col.Default ? `DEFAULT ${col.Default}` : ''}`);
    });
    
    // 查询任务奖励配置
    const [missionData] = await db.execute(`SELECT id, mission_key, title, reward_keys, reward_karma FROM mission_config WHERE is_active = 1`);
    console.log('   任务奖励配置:');
    missionData.forEach(mission => {
      console.log(`   ${mission.mission_key}: ${mission.reward_keys} keys, ${mission.reward_karma} karma`);
    });
    
    // 3. 分析mission_completion_log表 - 任务完成记录
    console.log('\n📊 3. mission_completion_log表 - 任务完成记录:');
    const [logColumns] = await db.execute(`DESCRIBE mission_completion_log`);
    const logRewardColumns = logColumns.filter(col => 
      col.Field.includes('reward') || col.Field.includes('key')
    );
    
    logRewardColumns.forEach(col => {
      console.log(`   ${col.Field}: ${col.Type} ${col.Null === 'NO' ? 'NOT NULL' : 'NULL'} ${col.Default ? `DEFAULT ${col.Default}` : ''}`);
    });
    
    // 查询最近的任务完成记录
    const [logData] = await db.execute(`
      SELECT mcl.*, mc.mission_key, mc.title 
      FROM mission_completion_log mcl
      JOIN mission_config mc ON mcl.mission_id = mc.id
      WHERE mcl.user_id = 1
      ORDER BY mcl.completed_at DESC
      LIMIT 5
    `);
    
    console.log('   最近的任务完成记录:');
    logData.forEach(log => {
      console.log(`   ${log.mission_key}: 获得${log.reward_keys} keys, 完成时间: ${log.completed_at}`);
    });
    
    // 4. 分析chapter_unlocks表 - 章节解锁记录
    console.log('\n📊 4. chapter_unlocks表 - 章节解锁记录:');
    const [unlockColumns] = await db.execute(`DESCRIBE chapter_unlocks`);
    const unlockKeyColumns = unlockColumns.filter(col => 
      col.Field.includes('unlock') || col.Field.includes('method') || col.Field.includes('cost')
    );
    
    unlockKeyColumns.forEach(col => {
      console.log(`   ${col.Field}: ${col.Type} ${col.Null === 'NO' ? 'NOT NULL' : 'NULL'} ${col.Default ? `DEFAULT ${col.Default}` : ''}`);
    });
    
    // 查询key解锁记录
    const [unlockData] = await db.execute(`
      SELECT cu.*, c.chapter_number, n.title as novel_title
      FROM chapter_unlocks cu
      JOIN chapter c ON cu.chapter_id = c.id
      JOIN novel n ON c.novel_id = n.id
      WHERE cu.user_id = 1 AND cu.unlock_method = 'key'
      ORDER BY cu.created_at DESC
      LIMIT 5
    `);
    
    console.log('   Key解锁记录:');
    unlockData.forEach(unlock => {
      console.log(`   ${unlock.novel_title} 第${unlock.chapter_number}章: 消耗${unlock.cost} keys, 解锁时间: ${unlock.unlocked_at}`);
    });
    
    // 5. 分析daily_checkin表 - 签到奖励
    console.log('\n📊 5. daily_checkin表 - 签到奖励:');
    try {
      const [checkinColumns] = await db.execute(`DESCRIBE daily_checkin`);
      const checkinKeyColumns = checkinColumns.filter(col => 
        col.Field.includes('key') || col.Field.includes('reward')
      );
      
      checkinKeyColumns.forEach(col => {
        console.log(`   ${col.Field}: ${col.Type} ${col.Null === 'NO' ? 'NOT NULL' : 'NULL'} ${col.Default ? `DEFAULT ${col.Default}` : ''}`);
      });
      
      // 查询签到记录
      const [checkinData] = await db.execute(`
        SELECT * FROM daily_checkin 
        WHERE user_id = 1 
        ORDER BY checkin_date DESC 
        LIMIT 5
      `);
      
      console.log('   签到记录:');
      checkinData.forEach(checkin => {
        console.log(`   签到日期: ${checkin.checkin_date}, 获得keys: ${checkin.keys_earned || 'N/A'}`);
      });
    } catch (error) {
      console.log('   daily_checkin表不存在或结构不同');
    }
    
    // 6. 分析key获取和消耗的完整流程
    console.log('\n🔄 Key获取和消耗的完整流程:');
    console.log('   📈 Key获取方式:');
    console.log('   1. 每日签到奖励');
    console.log('   2. 完成任务奖励');
    console.log('   3. 购买获得');
    console.log('   4. 其他活动奖励');
    
    console.log('\n   📉 Key消耗方式:');
    console.log('   1. 解锁付费章节');
    console.log('   2. 购买其他物品');
    console.log('   3. 其他消费');
    
    console.log('\n   💾 数据存储:');
    console.log('   1. user.points - 用户key余额');
    console.log('   2. mission_completion_log - 任务奖励记录');
    console.log('   3. chapter_unlocks - 解锁消费记录');
    console.log('   4. daily_checkin - 签到奖励记录');
    
    // 7. 统计用户key收支情况
    console.log('\n📊 用户key收支统计:');
    
    // 总收入
    const [totalEarned] = await db.execute(`
      SELECT SUM(reward_keys) as total_keys
      FROM mission_completion_log 
      WHERE user_id = 1 AND claimed_at IS NOT NULL
    `);
    
    // 总支出
    const [totalSpent] = await db.execute(`
      SELECT SUM(cost) as total_cost
      FROM chapter_unlocks 
      WHERE user_id = 1 AND unlock_method = 'key' AND status = 'unlocked'
    `);
    
    console.log(`   任务奖励总收入: ${totalEarned[0].total_keys || 0} keys`);
    console.log(`   解锁章节总支出: ${totalSpent[0].total_cost || 0} keys`);
    console.log(`   当前余额: ${userData[0].points} keys`);
    
  } catch (error) {
    console.error('分析失败:', error);
  } finally {
    if (db) await db.end();
  }
}

// 运行分析
analyzeKeySystem();
