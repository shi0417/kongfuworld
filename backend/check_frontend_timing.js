// 检查前端时间追踪问题
const mysql = require('mysql2/promise');

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '123456',
  database: process.env.DB_NAME || 'kongfuworld',
  charset: 'utf8mb4'
};

async function checkFrontendTiming() {
  let db;
  try {
    db = await mysql.createConnection(dbConfig);
    
    console.log('🔍 检查前端时间追踪问题\n');
    
    // 1. 检查用户1000的最新记录，看是否有recordId
    console.log('📊 用户1000的最新记录:');
    const [latestRecords] = await db.execute(`
      SELECT 
        id,
        user_id,
        chapter_id,
        read_at,
        page_enter_time,
        page_exit_time,
        stay_duration
      FROM reading_log 
      WHERE user_id = 1000 
      ORDER BY id DESC 
      LIMIT 3
    `);
    
    latestRecords.forEach((record, index) => {
      console.log(`  ${index + 1}. ID:${record.id} 章节${record.chapter_id}`);
      console.log(`     阅读时间: ${record.read_at}`);
      console.log(`     进入时间: ${record.page_enter_time || 'NULL'}`);
      console.log(`     离开时间: ${record.page_exit_time || 'NULL'}`);
      console.log(`     停留时长: ${record.stay_duration || 'NULL'} 秒`);
      console.log('');
    });
    
    // 2. 分析问题
    console.log('🤔 问题分析:');
    console.log('1. 记录已创建，说明前端调用了recordReading API');
    console.log('2. page_enter_time已记录，说明进入时间追踪工作正常');
    console.log('3. page_exit_time为NULL，说明离开时间追踪没有工作');
    console.log('4. stay_duration为NULL，说明停留时长没有计算');
    
    console.log('\n💡 可能的原因:');
    console.log('1. 前端useReadingTiming Hook没有正确工作');
    console.log('2. 用户离开页面时没有触发stopTracking');
    console.log('3. onTimingUpdate回调没有执行');
    console.log('4. readingTimingService.updateReadingTiming调用失败');
    
    console.log('\n🔧 调试建议:');
    console.log('1. 在浏览器控制台查看是否有相关日志');
    console.log('2. 检查网络请求是否发送了时间追踪API');
    console.log('3. 检查前端代码中的console.log输出');
    console.log('4. 测试用户离开页面时是否触发了stopTracking');
    
    // 3. 手动更新一条记录来测试
    console.log('\n🧪 手动更新测试:');
    const testRecordId = latestRecords[0].id;
    const now = new Date();
    const enterTime = new Date(latestRecords[0].page_enter_time);
    const duration = Math.floor((now.getTime() - enterTime.getTime()) / 1000);
    
    console.log(`测试记录ID: ${testRecordId}`);
    console.log(`进入时间: ${enterTime}`);
    console.log(`当前时间: ${now}`);
    console.log(`计算停留时长: ${duration} 秒`);
    
    // 手动更新数据库
    await db.execute(`
      UPDATE reading_log 
      SET page_exit_time = ?, stay_duration = ?
      WHERE id = ?
    `, [now, duration, testRecordId]);
    
    console.log('✅ 手动更新完成');
    
    // 验证更新结果
    const [updatedRecord] = await db.execute(`
      SELECT id, page_enter_time, page_exit_time, stay_duration 
      FROM reading_log 
      WHERE id = ?
    `, [testRecordId]);
    
    console.log('📊 更新结果:');
    console.log(`  ID: ${updatedRecord[0].id}`);
    console.log(`  进入时间: ${updatedRecord[0].page_enter_time}`);
    console.log(`  离开时间: ${updatedRecord[0].page_exit_time}`);
    console.log(`  停留时长: ${updatedRecord[0].stay_duration} 秒`);
    
  } catch (error) {
    console.error('检查失败:', error);
  } finally {
    if (db) await db.end();
  }
}

checkFrontendTiming();
