// 创建章节解锁系统相关表
const mysql = require('mysql2');

// 数据库连接配置
const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: '123456',
  database: 'kongfuworld',
  charset: 'utf8mb4'
});

async function createChapterUnlockTables() {
  try {
    console.log('开始创建章节解锁系统相关表...\n');
    
    // 1. 修改chapter表，添加解锁相关字段
    console.log('1. 修改chapter表，添加解锁相关字段...');
    await new Promise((resolve, reject) => {
      db.query(`
        ALTER TABLE chapter 
        ADD COLUMN is_premium BOOLEAN DEFAULT 1 COMMENT '是否为付费章节',
        ADD COLUMN free_unlock_time DATETIME NULL COMMENT '免费解锁时间',
        ADD COLUMN key_cost INT DEFAULT 1 COMMENT '钥匙解锁成本',
        ADD COLUMN karma_cost INT DEFAULT 32 COMMENT '业力购买成本',
        ADD COLUMN unlock_priority ENUM('free', 'key', 'karma', 'subscription') DEFAULT 'free' COMMENT '解锁优先级'
      `, (err, result) => {
        if (err && !err.message.includes('Duplicate column name')) {
          reject(err);
        } else {
          resolve(result);
        }
      });
    });
    console.log('✓ chapter表修改完成');
    
    // 2. 修改user表，添加货币和订阅字段
    console.log('2. 修改user表，添加货币和订阅字段...');
    await new Promise((resolve, reject) => {
      db.query(`
        ALTER TABLE user 
        ADD COLUMN karma_count INT DEFAULT 0 COMMENT '业力数量',
        ADD COLUMN subscription_status ENUM('none', 'champion', 'premium') DEFAULT 'none' COMMENT '订阅状态',
        ADD COLUMN subscription_end_date DATETIME NULL COMMENT '订阅结束日期'
      `, (err, result) => {
        if (err && !err.message.includes('Duplicate column name')) {
          reject(err);
        } else {
          resolve(result);
        }
      });
    });
    console.log('✓ user表修改完成');
    
    // 3. 创建chapter_unlocks表
    console.log('3. 创建chapter_unlocks表...');
    await new Promise((resolve, reject) => {
      db.query(`
        CREATE TABLE IF NOT EXISTS chapter_unlocks (
          id INT PRIMARY KEY AUTO_INCREMENT,
          user_id INT NOT NULL,
          chapter_id INT NOT NULL,
          unlock_method ENUM('free', 'key', 'karma', 'subscription', 'auto_unlock') NOT NULL,
          cost INT DEFAULT 0 COMMENT '实际花费的钥匙或业力数量',
          unlocked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES user(id) ON DELETE CASCADE,
          FOREIGN KEY (chapter_id) REFERENCES chapter(id) ON DELETE CASCADE,
          UNIQUE KEY unique_user_chapter (user_id, chapter_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `, (err, result) => {
        if (err) reject(err);
        else resolve(result);
      });
    });
    console.log('✓ chapter_unlocks表创建完成');
    
    // 4. user_settings表已删除，使用user.settings_json字段存储设置
    console.log('4. 跳过user_settings表创建（已删除，使用user.settings_json）...');
    
    // 5. 创建chapter_access_log表（记录用户永久拥有的章节）
    console.log('5. 创建chapter_access_log表...');
    await new Promise((resolve, reject) => {
      db.query(`
        CREATE TABLE IF NOT EXISTS chapter_access_log (
          id INT PRIMARY KEY AUTO_INCREMENT,
          user_id INT NOT NULL,
          chapter_id INT NOT NULL,
          unlock_method ENUM('key', 'karma', 'time_unlock', 'free') NOT NULL COMMENT '解锁方式',
          unlock_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '解锁时间',
          cost INT DEFAULT 0 COMMENT '解锁成本（钥匙或业力数量）',
          is_permanent BOOLEAN DEFAULT TRUE COMMENT '是否永久拥有',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES user(id) ON DELETE CASCADE,
          FOREIGN KEY (chapter_id) REFERENCES chapter(id) ON DELETE CASCADE,
          UNIQUE KEY unique_user_chapter (user_id, chapter_id) COMMENT '防止重复解锁'
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `, (err, result) => {
        if (err) reject(err);
        else resolve(result);
      });
    });
    console.log('✓ chapter_access_log表创建完成');
    
    // 6. 创建chapter_time_unlock表（记录时间解锁状态）
    console.log('6. 创建chapter_time_unlock表...');
    await new Promise((resolve, reject) => {
      db.query(`
        CREATE TABLE IF NOT EXISTS chapter_time_unlock (
          id INT PRIMARY KEY AUTO_INCREMENT,
          user_id INT NOT NULL,
          chapter_id INT NOT NULL,
          countdown_start_time DATETIME NOT NULL COMMENT '倒计时开始时间',
          countdown_end_time DATETIME NOT NULL COMMENT '倒计时结束时间',
          is_active BOOLEAN DEFAULT TRUE COMMENT '倒计时是否激活',
          is_completed BOOLEAN DEFAULT FALSE COMMENT '倒计时是否完成',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES user(id) ON DELETE CASCADE,
          FOREIGN KEY (chapter_id) REFERENCES chapter(id) ON DELETE CASCADE,
          UNIQUE KEY unique_user_chapter (user_id, chapter_id) COMMENT '每个用户每个章节只能有一个倒计时'
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `, (err, result) => {
        if (err) reject(err);
        else resolve(result);
      });
    });
    console.log('✓ chapter_time_unlock表创建完成');
    
    // 7. 跳过user_settings表默认设置插入（表已删除）
    console.log('7. 跳过user_settings默认设置插入（表已删除）...');
    
    // 7. 更新现有章节为免费章节（测试用）
    console.log('7. 更新现有章节设置...');
    await new Promise((resolve, reject) => {
      db.query(`
        UPDATE chapter 
        SET is_premium = 0, 
            free_unlock_time = NULL,
            key_cost = 1,
            karma_cost = 32,
            unlock_priority = 'free'
        WHERE id IN (1, 2, 3, 4, 5)
      `, (err, result) => {
        if (err) reject(err);
        else resolve(result);
      });
    });
    console.log('✓ 现有章节设置更新完成');
    
    console.log('\n✅ 章节解锁系统表创建完成！');
    
    // 8. 验证表创建结果
    console.log('\n验证表创建结果...');
    const tables = ['chapter_unlocks', 'chapter_access_log', 'chapter_time_unlock'];
    
    for (const table of tables) {
      const exists = await new Promise((resolve, reject) => {
        db.query(`SHOW TABLES LIKE '${table}'`, (err, results) => {
          if (err) reject(err);
          else resolve(results.length > 0);
        });
      });
      
      if (exists) {
        console.log(`✓ ${table} 表存在`);
      } else {
        console.log(`❌ ${table} 表不存在`);
      }
    }
    
  } catch (error) {
    console.error('创建表时出错:', error);
  } finally {
    db.end();
  }
}

// 开始创建表
createChapterUnlockTables();
