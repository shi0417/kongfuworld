// 创建用户解锁章节费用设定表
const mysql = require('mysql2');

// 数据库连接配置
const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: '123456',
  database: 'kongfuworld',
  charset: 'utf8mb4'
});

async function createUnlockpriceTable() {
  try {
    console.log('开始创建用户解锁章节费用设定表...\n');
    
    // 创建 unlockprice 表
    console.log('创建 unlockprice 表...');
    await executeQuery(`
      CREATE TABLE IF NOT EXISTS \`unlockprice\` (
        \`id\` int NOT NULL AUTO_INCREMENT,
        \`user_id\` int NOT NULL COMMENT '用户ID',
        \`novel_id\` int NOT NULL COMMENT '小说ID',
        \`fixed_style\` tinyint(1) NOT NULL DEFAULT 1 COMMENT '费用模式（0=随机，1=固定）',
        \`fixed_cost\` int NOT NULL DEFAULT 20 COMMENT '固定费用值',
        \`random_cost_min\` int DEFAULT NULL COMMENT '随机费用最小值',
        \`random_cost_max\` int DEFAULT NULL COMMENT '随机费用最大值',
        \`created_at\` datetime DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
        \`updated_at\` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
        PRIMARY KEY (\`id\`),
        KEY \`idx_user_id\` (\`user_id\`),
        KEY \`idx_novel_id\` (\`novel_id\`),
        KEY \`idx_user_novel\` (\`user_id\`, \`novel_id\`),
        CONSTRAINT \`unlockprice_ibfk_1\` FOREIGN KEY (\`user_id\`) REFERENCES \`user\` (\`id\`) ON DELETE CASCADE,
        CONSTRAINT \`unlockprice_ibfk_2\` FOREIGN KEY (\`novel_id\`) REFERENCES \`novel\` (\`id\`) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户解锁章节费用设定表'
    `);
    
    console.log('\n✅ unlockprice 表创建完成！');
    
    // 验证表创建结果
    console.log('\n验证表创建结果...');
    await verifyTable();
    
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

async function verifyTable() {
  try {
    const result = await new Promise((resolve, reject) => {
      db.query(`SHOW TABLES LIKE 'unlockprice'`, (err, results) => {
        if (err) reject(err);
        else resolve(results);
      });
    });
    
    if (result.length > 0) {
      console.log('✓ unlockprice 表存在');
      
      // 显示表结构
      const structure = await new Promise((resolve, reject) => {
        db.query(`DESCRIBE unlockprice`, (err, results) => {
          if (err) reject(err);
          else resolve(results);
        });
      });
      
      console.log('\n表结构:');
      console.table(structure);
    } else {
      console.log('✗ unlockprice 表不存在');
    }
  } catch (error) {
    console.log(`✗ 检查 unlockprice 表时出错: ${error.message}`);
  }
}

// 开始创建表
createUnlockpriceTable();

