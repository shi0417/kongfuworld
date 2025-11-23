// 测试阅读时间追踪功能
const mysql = require('mysql2/promise');

// 数据库配置
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '123456',
  database: process.env.DB_NAME || 'kongfuworld',
  charset: 'utf8mb4'
};

async function testReadingTiming() {
  let db;
  try {
    db = await mysql.createConnection(dbConfig);
    
    console.log('\n🧪 测试阅读时间追踪功能\n');
    
    // 1. 检查表结构
    console.log('📊 检查reading_log表结构:');
    const [columns] = await db.execute(`DESCRIBE reading_log`);
    const timingFields = columns.filter(col => 
      ['page_enter_time', 'page_exit_time', 'stay_duration'].includes(col.Field)
    );
    
    if (timingFields.length === 3) {
      console.log('✅ 时间追踪字段已添加:');
      timingFields.forEach(field => {
        console.log(`   ${field.Field}: ${field.Type} ${field.Null === 'NO' ? 'NOT NULL' : 'NULL'}`);
      });
    } else {
      console.log('❌ 时间追踪字段未完全添加');
      return;
    }
    
    // 2. 测试插入带时间字段的记录
    console.log('\n📝 测试插入带时间字段的记录:');
    const testUserId = 1;
    const testChapterId = 1000;
    const enterTime = new Date();
    const exitTime = new Date(Date.now() + 300000); // 5分钟后
    const duration = 300; // 5分钟
    
    try {
      await db.execute(`
        INSERT INTO reading_log 
        (user_id, chapter_id, read_at, is_unlocked, unlock_time, page_enter_time, page_exit_time, stay_duration) 
        VALUES (?, ?, NOW(), 1, NOW(), ?, ?, ?)
      `, [testUserId, testChapterId, enterTime, exitTime, duration]);
      
      console.log('✅ 测试记录插入成功');
    } catch (error) {
      if (error.code === 'ER_DUP_ENTRY') {
        console.log('⚠️  测试记录已存在，更新现有记录');
        await db.execute(`
          UPDATE reading_log 
          SET page_enter_time = ?, page_exit_time = ?, stay_duration = ?
          WHERE user_id = ? AND chapter_id = ?
        `, [enterTime, exitTime, duration, testUserId, testChapterId]);
        console.log('✅ 测试记录更新成功');
      } else {
        throw error;
      }
    }
    
    // 3. 查询测试记录
    console.log('\n📖 查询测试记录:');
    const [testRecords] = await db.execute(`
      SELECT 
        user_id, 
        chapter_id, 
        read_at, 
        page_enter_time, 
        page_exit_time, 
        stay_duration,
        TIMESTAMPDIFF(SECOND, page_enter_time, page_exit_time) as calculated_duration
      FROM reading_log 
      WHERE user_id = ? AND chapter_id = ?
    `, [testUserId, testChapterId]);
    
    if (testRecords.length > 0) {
      const record = testRecords[0];
      console.log('✅ 测试记录查询成功:');
      console.log(`   用户ID: ${record.user_id}`);
      console.log(`   章节ID: ${record.chapter_id}`);
      console.log(`   阅读时间: ${record.read_at}`);
      console.log(`   进入时间: ${record.page_enter_time}`);
      console.log(`   离开时间: ${record.page_exit_time}`);
      console.log(`   停留时长: ${record.stay_duration} 秒`);
      console.log(`   计算时长: ${record.calculated_duration} 秒`);
    } else {
      console.log('❌ 未找到测试记录');
    }
    
    // 4. 测试时间统计查询
    console.log('\n📊 测试时间统计查询:');
    const [stats] = await db.execute(`
      SELECT 
        COUNT(*) as total_records,
        AVG(stay_duration) as avg_duration,
        SUM(stay_duration) as total_duration,
        MIN(page_enter_time) as earliest_enter,
        MAX(page_exit_time) as latest_exit
      FROM reading_log 
      WHERE stay_duration IS NOT NULL
    `);
    
    if (stats.length > 0) {
      const stat = stats[0];
      console.log('✅ 时间统计查询成功:');
      console.log(`   总记录数: ${stat.total_records}`);
      console.log(`   平均停留时长: ${Math.round(stat.avg_duration || 0)} 秒`);
      console.log(`   总停留时长: ${stat.total_duration || 0} 秒`);
      console.log(`   最早进入时间: ${stat.earliest_enter}`);
      console.log(`   最晚离开时间: ${stat.latest_exit}`);
    }
    
    console.log('\n🎉 阅读时间追踪功能测试完成！');
    console.log('📋 下一步: 启动前端和后端服务进行完整测试');
    
  } catch (error) {
    console.error('测试失败:', error);
  } finally {
    if (db) await db.end();
  }
}

// 运行测试
testReadingTiming();
