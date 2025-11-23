// 创建任务系统相关表
const mysql = require('mysql2');

// 数据库连接配置
const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: '123456',
  database: 'kongfuworld',
  charset: 'utf8mb4'
});

async function createMissionSystemTables() {
  try {
    console.log('开始创建任务系统相关表...\n');
    
    // 1. 创建任务配置表
    console.log('1. 创建 mission_config 表...');
    await executeQuery(`
      CREATE TABLE IF NOT EXISTS \`mission_config\` (
        \`id\` int NOT NULL AUTO_INCREMENT,
        \`mission_type\` enum('daily', 'weekly', 'monthly') NOT NULL DEFAULT 'daily' COMMENT '任务类型',
        \`mission_key\` varchar(50) NOT NULL COMMENT '任务标识符',
        \`title\` varchar(100) NOT NULL COMMENT '任务标题',
        \`description\` text COMMENT '任务描述',
        \`target_value\` int NOT NULL COMMENT '目标值',
        \`reward_keys\` int NOT NULL DEFAULT 0 COMMENT '奖励钥匙数量',
        \`reward_karma\` int NOT NULL DEFAULT 0 COMMENT '奖励Karma数量',
        \`is_active\` tinyint(1) DEFAULT 1 COMMENT '是否启用',
        \`reset_type\` enum('daily', 'weekly', 'monthly') NOT NULL DEFAULT 'daily' COMMENT '重置类型',
        \`created_at\` datetime DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`mission_key\` (\`mission_key\`),
        KEY \`mission_type\` (\`mission_type\`),
        KEY \`is_active\` (\`is_active\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    
    // 2. 创建用户任务进度表
    console.log('2. 创建 user_mission_progress 表...');
    await executeQuery(`
      CREATE TABLE IF NOT EXISTS \`user_mission_progress\` (
        \`id\` int NOT NULL AUTO_INCREMENT,
        \`user_id\` int NOT NULL COMMENT '用户ID',
        \`mission_id\` int NOT NULL COMMENT '任务ID',
        \`current_progress\` int NOT NULL DEFAULT 0 COMMENT '当前进度',
        \`is_completed\` tinyint(1) DEFAULT 0 COMMENT '是否已完成',
        \`is_claimed\` tinyint(1) DEFAULT 0 COMMENT '是否已领取奖励',
        \`progress_date\` date NOT NULL COMMENT '进度日期',
        \`created_at\` datetime DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`unique_user_mission_date\` (\`user_id\`, \`mission_id\`, \`progress_date\`),
        KEY \`user_id\` (\`user_id\`),
        KEY \`mission_id\` (\`mission_id\`),
        KEY \`progress_date\` (\`progress_date\`),
        CONSTRAINT \`user_mission_progress_ibfk_1\` FOREIGN KEY (\`user_id\`) REFERENCES \`user\` (\`id\`) ON DELETE CASCADE,
        CONSTRAINT \`user_mission_progress_ibfk_2\` FOREIGN KEY (\`mission_id\`) REFERENCES \`mission_config\` (\`id\`) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    
    // 3. 创建任务完成记录表
    console.log('3. 创建 mission_completion_log 表...');
    await executeQuery(`
      CREATE TABLE IF NOT EXISTS \`mission_completion_log\` (
        \`id\` int NOT NULL AUTO_INCREMENT,
        \`user_id\` int NOT NULL COMMENT '用户ID',
        \`mission_id\` int NOT NULL COMMENT '任务ID',
        \`completed_at\` datetime DEFAULT CURRENT_TIMESTAMP COMMENT '完成时间',
        \`reward_keys\` int NOT NULL DEFAULT 0 COMMENT '获得的钥匙',
        \`reward_karma\` int NOT NULL DEFAULT 0 COMMENT '获得的Karma',
        \`claimed_at\` datetime DEFAULT NULL COMMENT '领取时间',
        PRIMARY KEY (\`id\`),
        KEY \`user_id\` (\`user_id\`),
        KEY \`mission_id\` (\`mission_id\`),
        KEY \`completed_at\` (\`completed_at\`),
        CONSTRAINT \`mission_completion_log_ibfk_1\` FOREIGN KEY (\`user_id\`) REFERENCES \`user\` (\`id\`) ON DELETE CASCADE,
        CONSTRAINT \`mission_completion_log_ibfk_2\` FOREIGN KEY (\`mission_id\`) REFERENCES \`mission_config\` (\`id\`) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    
    // 4. 插入默认任务配置
    console.log('4. 插入默认任务配置...');
    await executeQuery(`
      INSERT IGNORE INTO \`mission_config\` (\`mission_type\`, \`mission_key\`, \`title\`, \`description\`, \`target_value\`, \`reward_keys\`, \`reward_karma\`, \`is_active\`, \`reset_type\`) VALUES
      ('daily', 'read_2_chapters', 'Read 2 new chapters', 'Read 2 new chapters to earn rewards', 2, 2, 0, 1, 'daily'),
      ('daily', 'read_5_chapters', 'Read 5 new chapters', 'Read 5 new chapters to earn rewards', 5, 2, 0, 1, 'daily'),
      ('daily', 'read_10_chapters', 'Read 10 new chapters', 'Read 10 new chapters to earn rewards', 10, 4, 0, 1, 'daily'),
      ('daily', 'write_review', 'Write a review', 'Write a review for any novel', 1, 1, 0, 1, 'daily'),
      ('daily', 'daily_checkin', 'Daily check-in', 'Check in daily to earn keys', 1, 3, 0, 1, 'daily')
    `);
    
    console.log('\n✅ 任务系统相关表创建完成！');
    
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
  const tables = ['mission_config', 'user_mission_progress', 'mission_completion_log'];
  
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
createMissionSystemTables();
