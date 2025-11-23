// 调试阅读时间追踪功能
const mysql = require('mysql2/promise');

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '123456',
  database: process.env.DB_NAME || 'kongfuworld',
  charset: 'utf8mb4'
};

async function debugReadingTiming() {
  let db;
  try {
    db = await mysql.createConnection(dbConfig);
    
    console.log('🔍 调试阅读时间追踪功能\n');
    
    // 1. 检查用户1000的最新记录
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
      LIMIT 5
    `);
    
    latestRecords.forEach((record, index) => {
      console.log(`  ${index + 1}. ID:${record.id} 章节${record.chapter_id}`);
      console.log(`     阅读时间: ${record.read_at}`);
      console.log(`     进入时间: ${record.page_enter_time || 'NULL'}`);
      console.log(`     离开时间: ${record.page_exit_time || 'NULL'}`);
      console.log(`     停留时长: ${record.stay_duration || 'NULL'} 秒`);
      console.log('');
    });
    
    // 2. 检查时间追踪API路由是否注册
    console.log('🔧 检查可能的问题:');
    console.log('1. 前端是否正确调用了时间追踪API？');
    console.log('2. 后端时间追踪路由是否正确注册？');
    console.log('3. 用户离开页面时是否触发了stopTracking？');
    console.log('4. 网络请求是否成功发送？');
    
    // 3. 检查是否有时间追踪的更新记录
    console.log('\n📈 检查时间追踪更新记录:');
    const [updateRecords] = await db.execute(`
      SELECT 
        id,
        user_id,
        chapter_id,
        read_at,
        page_enter_time,
        page_exit_time,
        stay_duration,
        CASE 
          WHEN page_exit_time IS NOT NULL AND stay_duration IS NOT NULL THEN '已更新'
          WHEN page_enter_time IS NOT NULL AND page_exit_time IS NULL THEN '未完成'
          ELSE '未开始'
        END as status
      FROM reading_log 
      WHERE user_id = 1000 
      ORDER BY id DESC 
      LIMIT 10
    `);
    
    updateRecords.forEach(record => {
      console.log(`  ID:${record.id} 章节${record.chapter_id} - ${record.status}`);
    });
    
    // 4. 分析问题原因
    console.log('\n🤔 可能的问题原因:');
    console.log('1. 前端时间追踪Hook没有正确工作');
    console.log('2. 用户离开页面时没有触发stopTracking');
    console.log('3. 时间追踪API调用失败');
    console.log('4. 后端路由没有正确注册');
    console.log('5. 网络连接问题');
    
    console.log('\n💡 建议的调试步骤:');
    console.log('1. 检查浏览器控制台是否有错误');
    console.log('2. 检查网络请求是否发送成功');
    console.log('3. 检查后端日志是否有时间追踪API调用');
    console.log('4. 测试时间追踪API是否正常工作');
    
  } catch (error) {
    console.error('调试失败:', error);
  } finally {
    if (db) await db.end();
  }
}

debugReadingTiming();
