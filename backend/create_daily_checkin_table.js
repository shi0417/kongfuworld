// 创建每日签到记录表
const mysql = require('mysql2');

// 数据库连接配置
const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: '123456',
  database: 'kongfuworld',
  charset: 'utf8mb4'
});

async function createDailyCheckinTable() {
  try {
    console.log('开始创建每日签到记录表...\n');
    
    // 创建每日签到记录表
    console.log('1. 创建 daily_checkin 表...');
    await executeQuery(`
      CREATE TABLE IF NOT EXISTS \`daily_checkin\` (
        \`id\` int NOT NULL AUTO_INCREMENT,
        \`user_id\` int NOT NULL COMMENT '用户ID',
        \`checkin_date\` date NOT NULL COMMENT '签到日期',
        \`keys_earned\` int NOT NULL DEFAULT 0 COMMENT '获得的钥匙数量',
        \`streak_days\` int NOT NULL DEFAULT 1 COMMENT '连续签到天数',
        \`total_keys\` int NOT NULL DEFAULT 0 COMMENT '累计钥匙总数',
        \`created_at\` datetime DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`unique_user_date\` (\`user_id\`, \`checkin_date\`),
        KEY \`user_id\` (\`user_id\`),
        KEY \`checkin_date\` (\`checkin_date\`),
        CONSTRAINT \`daily_checkin_ibfk_1\` FOREIGN KEY (\`user_id\`) REFERENCES \`user\` (\`id\`) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    
    // 创建签到奖励配置表
    console.log('2. 创建 daily_checkin_rewards 表...');
    await executeQuery(`
      CREATE TABLE IF NOT EXISTS \`daily_checkin_rewards\` (
        \`id\` int NOT NULL AUTO_INCREMENT,
        \`day_number\` int NOT NULL COMMENT '签到天数（1-7）',
        \`keys_reward\` int NOT NULL COMMENT '奖励钥匙数量',
        \`is_active\` tinyint(1) DEFAULT 1 COMMENT '是否启用',
        \`created_at\` datetime DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`day_number\` (\`day_number\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    
    // 插入默认奖励配置
    console.log('3. 插入默认奖励配置...');
    await executeQuery(`
      INSERT IGNORE INTO \`daily_checkin_rewards\` (\`day_number\`, \`keys_reward\`, \`is_active\`) VALUES
      (1, 3, 1),
      (2, 3, 1),
      (3, 3, 1),
      (4, 5, 1),
      (5, 3, 1),
      (6, 3, 1),
      (7, 6, 1)
    `);
    
    console.log('\n✅ 每日签到相关表创建完成！');
    
    // 验证表创建结果
    console.log('\n验证表创建结果...');
    await verifyTables();
    
  } catch (error) {
    console.error('创建表时出错:', error);
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

async function verifyTables() {
  const tables = ['daily_checkin', 'daily_checkin_rewards'];
  
  for (const table of tables) {
    try {
      const result = await new Promise((resolve, reject) => {
        db.query(`SHOW TABLES LIKE '${table}'`, (err, results) => {
          if (err) reject(err);
          else resolve(results);
        });
      });
      
      if (result.length > 0) {
        console.log(`✓ ${table} 表存在`);
      } else {
        console.log(`✗ ${table} 表不存在`);
      }
    } catch (error) {
      console.log(`✗ 检查 ${table} 表时出错: ${error.message}`);
    }
  }
}

// 开始创建表
createDailyCheckinTable();
