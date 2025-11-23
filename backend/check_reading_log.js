// 检查reading_log记录情况
const mysql = require('mysql2/promise');

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '123456',
  database: process.env.DB_NAME || 'kongfuworld',
  charset: 'utf8mb4'
};

async function checkReadingLog() {
  let db;
  try {
    db = await mysql.createConnection(dbConfig);
    
    console.log('🔍 检查reading_log记录情况\n');
    
    // 1. 检查用户1000是否存在
    console.log('👤 检查用户1000:');
    const [users] = await db.execute('SELECT id, username FROM user WHERE id = 1000');
    if (users.length > 0) {
      console.log(`✅ 用户存在: ${users[0].username}`);
    } else {
      console.log('❌ 用户1000不存在');
      return;
    }
    
    // 2. 检查章节841,842是否存在
    console.log('\n📖 检查章节841,842:');
    const [chapters] = await db.execute('SELECT id, title FROM chapter WHERE id IN (841, 842)');
    if (chapters.length > 0) {
      console.log('✅ 章节存在:');
      chapters.forEach(chapter => {
        console.log(`   章节${chapter.id}: ${chapter.title}`);
      });
    } else {
      console.log('❌ 章节841,842不存在');
    }
    
    // 3. 检查reading_log表中的记录
    console.log('\n📊 检查reading_log记录:');
    const [records] = await db.execute(`
      SELECT 
        user_id, 
        chapter_id, 
        read_at, 
        page_enter_time,
        page_exit_time,
        stay_duration,
        is_unlocked,
        unlock_time
      FROM reading_log 
      WHERE user_id = 1000 AND chapter_id IN (841, 842)
      ORDER BY read_at DESC
    `);
    
    if (records.length > 0) {
      console.log(`✅ 找到 ${records.length} 条记录:`);
      records.forEach((record, index) => {
        console.log(`   ${index + 1}. 用户${record.user_id} 章节${record.chapter_id}`);
        console.log(`      阅读时间: ${record.read_at}`);
        console.log(`      进入时间: ${record.page_enter_time || '未记录'}`);
        console.log(`      离开时间: ${record.page_exit_time || '未记录'}`);
        console.log(`      停留时长: ${record.stay_duration || '未记录'} 秒`);
        console.log(`      解锁状态: ${record.is_unlocked ? '已解锁' : '未解锁'}`);
        console.log(`      解锁时间: ${record.unlock_time || '未记录'}`);
        console.log('');
      });
    } else {
      console.log('❌ 没有找到用户1000阅读章节841,842的记录');
    }
    
    // 4. 检查用户1000的所有阅读记录
    console.log('📋 用户1000的所有阅读记录:');
    const [allRecords] = await db.execute(`
      SELECT 
        user_id, 
        chapter_id, 
        read_at,
        page_enter_time,
        page_exit_time,
        stay_duration
      FROM reading_log 
      WHERE user_id = 1000
      ORDER BY read_at DESC
      LIMIT 10
    `);
    
    if (allRecords.length > 0) {
      console.log(`找到 ${allRecords.length} 条记录:`);
      allRecords.forEach((record, index) => {
        console.log(`   ${index + 1}. 章节${record.chapter_id} - ${record.read_at} (进入: ${record.page_enter_time || '无'}, 停留: ${record.stay_duration || '无'}秒)`);
      });
    } else {
      console.log('❌ 用户1000没有任何阅读记录');
    }
    
    // 5. 检查最近的reading_log记录
    console.log('\n🕒 最近的reading_log记录:');
    const [recentRecords] = await db.execute(`
      SELECT 
        user_id, 
        chapter_id, 
        read_at,
        page_enter_time,
        page_exit_time,
        stay_duration
      FROM reading_log 
      ORDER BY read_at DESC
      LIMIT 5
    `);
    
    if (recentRecords.length > 0) {
      console.log('最近的记录:');
      recentRecords.forEach((record, index) => {
        console.log(`   ${index + 1}. 用户${record.user_id} 章节${record.chapter_id} - ${record.read_at}`);
      });
    } else {
      console.log('❌ 没有任何reading_log记录');
    }
    
  } catch (error) {
    console.error('检查失败:', error);
  } finally {
    if (db) await db.end();
  }
}

checkReadingLog();
