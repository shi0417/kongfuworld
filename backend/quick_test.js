// 快速测试阅读时间追踪功能
const mysql = require('mysql2/promise');

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '123456',
  database: process.env.DB_NAME || 'kongfuworld',
  charset: 'utf8mb4'
};

async function quickTest() {
  let db;
  try {
    db = await mysql.createConnection(dbConfig);
    
    console.log('🧪 快速测试阅读时间追踪功能\n');
    
    // 检查表结构
    const [columns] = await db.execute(`DESCRIBE reading_log`);
    const timingFields = columns.filter(col => 
      ['page_enter_time', 'page_exit_time', 'stay_duration'].includes(col.Field)
    );
    
    console.log(`✅ 时间追踪字段数量: ${timingFields.length}/3`);
    timingFields.forEach(field => {
      console.log(`   ${field.Field}: ${field.Type}`);
    });
    
    if (timingFields.length === 3) {
      console.log('\n🎉 所有时间追踪字段已成功添加！');
      console.log('📋 下一步: 启动服务进行完整测试');
    } else {
      console.log('\n❌ 时间追踪字段未完全添加');
    }
    
  } catch (error) {
    console.error('测试失败:', error.message);
  } finally {
    if (db) await db.end();
  }
}

quickTest();
