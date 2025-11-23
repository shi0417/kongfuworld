// 检查章节1361的解锁和阅读记录情况
const mysql = require('mysql2/promise');

// 数据库配置
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '123456',
  database: process.env.DB_NAME || 'kongfuworld',
  charset: 'utf8mb4'
};

async function checkChapter1361() {
  let db;
  try {
    db = await mysql.createConnection(dbConfig);
    
    const today = new Date().toISOString().slice(0, 10);
    console.log(`\n🔍 检查章节1361的解锁和阅读记录情况 (${today})\n`);
    
    // 1. 查询章节基本信息
    const [chapters] = await db.execute(`
      SELECT 
        c.id,
        c.chapter_number,
        c.title as chapter_title,
        c.is_premium,
        c.free_unlock_time,
        n.id as novel_id,
        n.title as novel_title
      FROM chapter c
      JOIN novel n ON c.novel_id = n.id
      WHERE c.id = 1361
    `);
    
    if (chapters.length === 0) {
      console.log('❌ 章节1361不存在');
      return;
    }
    
    const chapter = chapters[0];
    console.log(`📚 小说: ${chapter.novel_title}`);
    console.log(`📄 章节: 第${chapter.chapter_number}章 - ${chapter.chapter_title}`);
    console.log(`💰 是否付费: ${chapter.is_premium ? '是' : '否'}`);
    
    // 2. 查询章节解锁记录
    const [unlockRecords] = await db.execute(`
      SELECT 
        cu.*,
        DATE(cu.unlocked_at) as unlock_date,
        DATE(cu.created_at) as create_date
      FROM chapter_unlocks cu
      WHERE cu.user_id = 1 AND cu.chapter_id = 1361
      ORDER BY cu.created_at ASC
    `);
    
    if (unlockRecords.length > 0) {
      console.log(`🔓 解锁记录 (${unlockRecords.length} 条):`);
      unlockRecords.forEach((record, index) => {
        console.log(`   ${index + 1}. 解锁方式: ${record.unlock_method}`);
        console.log(`      状态: ${record.status}`);
        console.log(`      解锁时间: ${record.unlocked_at || '未解锁'}`);
        console.log(`      创建时间: ${record.created_at}`);
        console.log(`      解锁日期: ${record.unlock_date || record.create_date}`);
      });
    } else {
      console.log(`🔓 解锁记录: 无解锁记录`);
    }
    
    // 3. 查询阅读记录
    const [readingRecords] = await db.execute(`
      SELECT 
        rl.*,
        DATE(rl.read_at) as read_date
      FROM reading_log rl
      WHERE rl.user_id = 1 AND rl.chapter_id = 1361
      ORDER BY rl.read_at ASC
    `);
    
    if (readingRecords.length > 0) {
      console.log(`📖 阅读记录 (${readingRecords.length} 条):`);
      readingRecords.forEach((record, index) => {
        console.log(`   ${index + 1}. 阅读时间: ${record.read_at}`);
        console.log(`      阅读日期: ${record.read_date}`);
        console.log(`      是否解锁: ${record.is_unlocked ? '是' : '否'}`);
        console.log(`      解锁时间: ${record.unlock_time || '无'}`);
        console.log('');
      });
    } else {
      console.log(`📖 阅读记录: 无阅读记录`);
    }
    
    // 4. 分析问题
    console.log('🔍 问题分析:');
    
    if (unlockRecords.length > 0 && readingRecords.length > 0) {
      const latestReading = readingRecords[readingRecords.length - 1];
      const latestUnlock = unlockRecords[unlockRecords.length - 1];
      
      console.log(`   最新阅读时间: ${latestReading.read_at}`);
      console.log(`   最新解锁时间: ${latestUnlock.unlocked_at}`);
      console.log(`   阅读记录中的解锁状态: ${latestReading.is_unlocked ? '已解锁' : '未解锁'}`);
      console.log(`   阅读记录中的解锁时间: ${latestReading.unlock_time || '无'}`);
      
      if (latestReading.is_unlocked === 0) {
        console.log('   ❌ 问题: 阅读记录中显示未解锁，但实际有解锁记录');
      }
      
      if (!latestReading.unlock_time) {
        console.log('   ❌ 问题: 阅读记录中没有解锁时间');
      }
    }
    
    // 5. 检查API是否被调用
    console.log('\n🔧 检查API调用情况:');
    console.log('   1. 检查后端服务器是否正在运行');
    console.log('   2. 检查API端点是否正确');
    console.log('   3. 检查数据库连接是否正常');
    
    // 6. 手动测试修复逻辑
    console.log('\n🧪 手动测试修复逻辑:');
    
    // 模拟API调用
    const userId = 1;
    const chapterId = 1361;
    
    // 步骤1: 检查时间解锁状态
    console.log('   步骤1: 检查时间解锁状态');
    const [timeUnlockRecords] = await db.execute(`
      SELECT * FROM chapter_unlocks 
      WHERE user_id = ? AND chapter_id = ? AND unlock_method = 'time_unlock' AND status = 'pending'
      ORDER BY created_at DESC
      LIMIT 1
    `, [userId, chapterId]);
    
    if (timeUnlockRecords.length > 0) {
      const timeUnlock = timeUnlockRecords[0];
      const unlockAt = new Date(timeUnlock.unlock_at);
      const now = new Date();
      
      console.log(`   时间解锁记录: 解锁时间 = ${unlockAt.toISOString()}, 当前时间 = ${now.toISOString()}`);
      
      if (now >= unlockAt) {
        console.log('   时间解锁已到期，更新解锁状态');
        await db.execute(`
          UPDATE chapter_unlocks 
          SET status = 'unlocked', unlocked_at = ?
          WHERE id = ?
        `, [now, timeUnlock.id]);
        console.log('   解锁状态已更新');
      } else {
        console.log('   时间解锁尚未到期');
      }
    } else {
      console.log('   没有待处理的时间解锁记录');
    }
    
    // 步骤2: 获取解锁信息
    console.log('   步骤2: 获取解锁信息');
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
    
    // 步骤3: 更新阅读记录
    console.log('   步骤3: 更新阅读记录');
    const [updateResult] = await db.execute(`
      UPDATE reading_log 
      SET read_at = NOW(), is_unlocked = ?, unlock_time = ?
      WHERE user_id = ? AND chapter_id = ? AND DATE(read_at) = CURDATE()
    `, [isUnlocked, unlockTime, userId, chapterId]);
    
    console.log(`   更新结果: 影响行数 = ${updateResult.affectedRows}`);
    
    if (updateResult.affectedRows === 0) {
      console.log('   没有现有记录，插入新记录');
      await db.execute(`
        INSERT INTO reading_log (user_id, chapter_id, read_at, is_unlocked, unlock_time) 
        VALUES (?, ?, NOW(), ?, ?)
      `, [userId, chapterId, isUnlocked, unlockTime]);
    }
    
    // 步骤4: 验证结果
    console.log('\n📊 验证结果:');
    const [finalReading] = await db.execute(`
      SELECT * FROM reading_log 
      WHERE user_id = ? AND chapter_id = ?
      ORDER BY read_at DESC
      LIMIT 1
    `, [userId, chapterId]);
    
    if (finalReading.length > 0) {
      const record = finalReading[0];
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
    
  } catch (error) {
    console.error('检查失败:', error);
  } finally {
    if (db) await db.end();
  }
}

// 运行检查
checkChapter1361();
