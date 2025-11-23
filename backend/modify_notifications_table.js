// 修改 notifications 表结构
const mysql = require('mysql2');

// 数据库连接配置
const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: '123456',
  database: 'kongfuworld',
  charset: 'utf8mb4'
});

async function modifyNotificationsTable() {
  try {
    console.log('开始修改 notifications 表结构...\n');
    
    // 1. 重命名 title 字段为 novel_title
    console.log('1. 重命名 title 字段为 novel_title...');
    await executeQuery(`
      ALTER TABLE notifications 
      CHANGE COLUMN title novel_title VARCHAR(255) NOT NULL COMMENT '小说标题'
    `);
    
    // 2. 添加 chapter_title 字段
    console.log('2. 添加 chapter_title 字段...');
    await executeQuery(`
      ALTER TABLE notifications 
      ADD COLUMN chapter_title VARCHAR(255) NULL COMMENT '章节标题' AFTER novel_title
    `);
    
    // 3. 添加 unlock_at 字段
    console.log('3. 添加 unlock_at 字段...');
    await executeQuery(`
      ALTER TABLE notifications 
      ADD COLUMN unlock_at DATETIME NULL COMMENT '解锁时间' AFTER created_at
    `);
    
    // 4. 更新 type 枚举值
    console.log('4. 更新 type 枚举值...');
    
    // 先临时添加新的枚举值
    await executeQuery(`
      ALTER TABLE notifications 
      MODIFY COLUMN type ENUM('news','unlock','chapter','comment','system','accept_marketing','notify_unlock_updates','notify_chapter_updates') NOT NULL COMMENT '通知类型'
    `);
    
    // 更新现有数据
    await executeQuery(`
      UPDATE notifications 
      SET type = 'notify_chapter_updates' 
      WHERE type = 'chapter'
    `);
    
    // 移除旧的枚举值，只保留新的三个值
    await executeQuery(`
      ALTER TABLE notifications 
      MODIFY COLUMN type ENUM('accept_marketing','notify_unlock_updates','notify_chapter_updates') NOT NULL COMMENT '通知类型'
    `);
    
    console.log('\n✅ notifications 表结构修改完成！');
    
    // 验证表结构
    console.log('\n验证表结构...');
    await showTableStructure();
    
    // 显示示例数据
    console.log('\n显示示例数据...');
    await showSampleData();
    
  } catch (error) {
    console.error('修改表结构时出错:', error);
  } finally {
    db.end();
  }
}

async function executeQuery(sql) {
  return new Promise((resolve, reject) => {
    db.query(sql, (err, results) => {
      if (err) {
        console.error('SQL执行失败:', err.message);
        reject(err);
      } else {
        console.log('✓ 执行成功');
        resolve(results);
      }
    });
  });
}

async function showTableStructure() {
  try {
    const result = await new Promise((resolve, reject) => {
      db.query(`DESCRIBE notifications`, (err, results) => {
        if (err) reject(err);
        else resolve(results);
      });
    });
    
    console.log('\n表结构:');
    console.table(result);
  } catch (error) {
    console.log('✗ 显示表结构时出错:', error.message);
  }
}

async function showSampleData() {
  try {
    const result = await new Promise((resolve, reject) => {
      db.query(`SELECT id, novel_title, chapter_title, type, created_at, unlock_at FROM notifications LIMIT 3`, (err, results) => {
        if (err) reject(err);
        else resolve(results);
      });
    });
    
    console.log('\n示例数据:');
    console.table(result);
  } catch (error) {
    console.log('✗ 显示示例数据时出错:', error.message);
  }
}

// 开始修改表结构
modifyNotificationsTable();
