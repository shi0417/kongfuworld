// 检查章节1358的解锁和阅读记录情况
const mysql = require('mysql2/promise');

// 数据库配置
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '123456',
  database: process.env.DB_NAME || 'kongfuworld',
  charset: 'utf8mb4'
};

async function checkChapter1358() {
  let db;
  try {
    db = await mysql.createConnection(dbConfig);
    
    const today = new Date().toISOString().slice(0, 10);
    console.log(`\n🔍 检查章节1358的解锁和阅读记录情况 (${today})\n`);
    
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
      WHERE c.id = 1358
    `);
    
    if (chapters.length === 0) {
      console.log('❌ 章节1358不存在');
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
      WHERE cu.user_id = 1 AND cu.chapter_id = 1358
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
      WHERE rl.user_id = 1 AND rl.chapter_id = 1358
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
    
    // 5. 检查API逻辑
    console.log('\n🔧 API逻辑检查:');
    console.log('   根据代码，reading_log表写入时应该:');
    console.log('   1. 查询chapter_unlocks表获取解锁信息');
    console.log('   2. 记录is_unlocked字段');
    console.log('   3. 记录unlock_time字段');
    
    // 6. 手动查询解锁信息
    const [unlockInfo] = await db.execute(`
      SELECT 
        CASE 
          WHEN COUNT(*) > 0 THEN 1 
          ELSE 0 
        END as is_unlocked,
        MAX(unlocked_at) as unlock_time
      FROM chapter_unlocks 
      WHERE user_id = 1 AND chapter_id = 1358 AND status = 'unlocked'
    `);
    
    console.log('\n📊 手动查询解锁信息:');
    console.log(`   是否解锁: ${unlockInfo[0].is_unlocked ? '是' : '否'}`);
    console.log(`   解锁时间: ${unlockInfo[0].unlock_time || '无'}`);
    
    if (unlockInfo[0].is_unlocked === 1 && readingRecords.length > 0) {
      const latestReading = readingRecords[readingRecords.length - 1];
      if (latestReading.is_unlocked === 0) {
        console.log('\n⚠️  发现问题: API没有正确更新reading_log表的解锁信息！');
        console.log('   可能原因:');
        console.log('   1. API调用时没有执行解锁信息查询');
        console.log('   2. 解锁信息查询失败');
        console.log('   3. 数据库更新失败');
      }
    }
    
  } catch (error) {
    console.error('检查失败:', error);
  } finally {
    if (db) await db.end();
  }
}

// 运行检查
checkChapter1358();
