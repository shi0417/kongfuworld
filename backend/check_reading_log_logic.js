// 检查reading_log的数据写入逻辑
const mysql = require('mysql2/promise');

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '123456',
  database: process.env.DB_NAME || 'kongfuworld',
  charset: 'utf8mb4'
};

async function checkReadingLogLogic() {
  let db;
  try {
    db = await mysql.createConnection(dbConfig);
    
    console.log('🔍 分析reading_log数据写入逻辑\n');
    
    // 1. 检查用户1000的章节841,842记录
    console.log('📊 用户1000的章节841,842记录:');
    const [records] = await db.execute(`
      SELECT 
        id,
        user_id, 
        chapter_id, 
        read_at,
        is_unlocked,
        unlock_time,
        page_enter_time,
        page_exit_time,
        stay_duration
      FROM reading_log 
      WHERE user_id = 1000 AND chapter_id IN (841, 842)
      ORDER BY read_at DESC
    `);
    
    console.log(`找到 ${records.length} 条记录:`);
    records.forEach((record, index) => {
      console.log(`  ${index + 1}. ID:${record.id} 章节${record.chapter_id}`);
      console.log(`     阅读时间: ${record.read_at}`);
      console.log(`     解锁状态: ${record.is_unlocked ? '已解锁' : '未解锁'}`);
      console.log(`     进入时间: ${record.page_enter_time || '未记录'}`);
      console.log(`     离开时间: ${record.page_exit_time || '未记录'}`);
      console.log(`     停留时长: ${record.stay_duration || '未记录'} 秒`);
      console.log('');
    });
    
    // 2. 分析今天的记录
    console.log('📅 今天的记录分析:');
    const [todayRecords] = await db.execute(`
      SELECT 
        chapter_id,
        COUNT(*) as count
      FROM reading_log 
      WHERE user_id = 1000 AND chapter_id IN (841, 842) AND DATE(read_at) = CURDATE()
      GROUP BY chapter_id
    `);
    
    console.log(`今天有 ${todayRecords.length} 个章节的记录:`);
    todayRecords.forEach(record => {
      console.log(`  章节${record.chapter_id}: ${record.count} 条记录`);
    });
    
    // 3. 检查历史记录逻辑
    console.log('\n🔍 历史记录检查逻辑:');
    for (const chapterId of [841, 842]) {
      const [historyCheck] = await db.execute(`
        SELECT COUNT(*) as count
        FROM reading_log 
        WHERE user_id = 1000 AND chapter_id = ?
      `, [chapterId]);
      
      const hasHistory = historyCheck[0].count > 0;
      console.log(`  章节${chapterId}: ${hasHistory ? '有历史记录' : '无历史记录'} (${historyCheck[0].count}条)`);
    }
    
    // 4. 分析为什么是更新而不是插入
    console.log('\n🤔 为什么是更新而不是插入？');
    console.log('根据代码逻辑:');
    console.log('1. 检查是否有历史记录');
    console.log('2. 如果有历史记录 → 先尝试更新今天的记录');
    console.log('3. 如果更新影响行数为0 → 插入新记录');
    console.log('4. 如果没有历史记录 → 直接插入新记录');
    
    console.log('\n💡 可能的原因:');
    console.log('- 用户1000之前已经阅读过章节841,842');
    console.log('- 系统检测到有历史记录，所以先尝试更新');
    console.log('- 更新成功，所以没有插入新记录');
    
  } catch (error) {
    console.error('检查失败:', error);
  } finally {
    if (db) await db.end();
  }
}

checkReadingLogLogic();
