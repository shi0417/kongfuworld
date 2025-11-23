// 为reading_log表添加时间追踪字段
const mysql = require('mysql2/promise');

// 数据库配置
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '123456',
  database: process.env.DB_NAME || 'kongfuworld',
  charset: 'utf8mb4'
};

async function addReadingTimingFields() {
  let db;
  try {
    db = await mysql.createConnection(dbConfig);
    
    console.log('\n🔧 为reading_log表添加时间追踪字段\n');
    
    // 1. 添加页面进入时间字段
    console.log('📝 添加字段: page_enter_time (进入页面的时间)');
    try {
      await db.execute(`
        ALTER TABLE reading_log 
        ADD COLUMN page_enter_time DATETIME NULL COMMENT '进入页面的时间'
      `);
      console.log('✅ 字段 page_enter_time 添加成功');
    } catch (error) {
      if (error.code === 'ER_DUP_FIELDNAME') {
        console.log('⚠️  字段 page_enter_time 已存在');
      } else {
        console.error('❌ 添加字段 page_enter_time 失败:', error.message);
      }
    }
    
    // 2. 添加页面离开时间字段
    console.log('\n📝 添加字段: page_exit_time (离开页面的时间)');
    try {
      await db.execute(`
        ALTER TABLE reading_log 
        ADD COLUMN page_exit_time DATETIME NULL COMMENT '离开页面的时间'
      `);
      console.log('✅ 字段 page_exit_time 添加成功');
    } catch (error) {
      if (error.code === 'ER_DUP_FIELDNAME') {
        console.log('⚠️  字段 page_exit_time 已存在');
      } else {
        console.error('❌ 添加字段 page_exit_time 失败:', error.message);
      }
    }
    
    // 3. 添加停留时间字段
    console.log('\n📝 添加字段: stay_duration (停留时间，秒)');
    try {
      await db.execute(`
        ALTER TABLE reading_log 
        ADD COLUMN stay_duration INT NULL COMMENT '停留时间（秒）'
      `);
      console.log('✅ 字段 stay_duration 添加成功');
    } catch (error) {
      if (error.code === 'ER_DUP_FIELDNAME') {
        console.log('⚠️  字段 stay_duration 已存在');
      } else {
        console.error('❌ 添加字段 stay_duration 失败:', error.message);
      }
    }
    
    // 4. 添加索引优化查询性能
    console.log('\n📝 添加索引优化查询性能');
    try {
      await db.execute(`
        CREATE INDEX idx_reading_log_timing ON reading_log(user_id, page_enter_time)
      `);
      console.log('✅ 索引 idx_reading_log_timing 添加成功');
    } catch (error) {
      if (error.code === 'ER_DUP_KEYNAME') {
        console.log('⚠️  索引 idx_reading_log_timing 已存在');
      } else {
        console.error('❌ 添加索引失败:', error.message);
      }
    }
    
    // 5. 查看更新后的表结构
    console.log('\n📊 更新后的表结构:');
    const [columns] = await db.execute(`
      DESCRIBE reading_log
    `);
    
    columns.forEach(column => {
      console.log(`   ${column.Field}: ${column.Type} ${column.Null === 'NO' ? 'NOT NULL' : 'NULL'} ${column.Key ? `(${column.Key})` : ''} ${column.Default ? `DEFAULT ${column.Default}` : ''} ${column.Comment ? `COMMENT '${column.Comment}'` : ''}`);
    });
    
    console.log('\n🎯 字段说明:');
    console.log('   page_enter_time: 记录用户进入章节阅读页面的时间');
    console.log('   page_exit_time: 记录用户离开章节阅读页面的时间');
    console.log('   stay_duration: 记录用户在页面停留的总时长（秒）');
    
    console.log('\n✅ 时间追踪字段添加完成！');
    console.log('📋 下一步: 需要更新前端代码和后端API来使用这些新字段');
    
  } catch (error) {
    console.error('操作失败:', error);
  } finally {
    if (db) await db.end();
  }
}

// 运行添加字段操作
addReadingTimingFields();
