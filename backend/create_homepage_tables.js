// 创建首页相关数据库表
const mysql = require('mysql2');

// 数据库连接配置
const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: '123456',
  database: 'kongfuworld',
  charset: 'utf8mb4'
});

async function createTables() {
  try {
    console.log('开始创建首页相关数据库表...\n');
    
    // 1. 创建首页推荐小说表
    console.log('1. 创建 homepage_featured_novels 表...');
    await executeQuery(`
      CREATE TABLE IF NOT EXISTS \`homepage_featured_novels\` (
        \`id\` int NOT NULL AUTO_INCREMENT,
        \`novel_id\` int NOT NULL COMMENT '小说ID',
        \`section_type\` enum('popular','new_releases','top_series','banner','recommended','trending') NOT NULL COMMENT '展示区块类型',
        \`display_order\` int NOT NULL DEFAULT 0 COMMENT '显示顺序，数字越小越靠前',
        \`is_active\` tinyint(1) DEFAULT 1 COMMENT '是否启用',
        \`start_date\` datetime DEFAULT NULL COMMENT '开始展示时间',
        \`end_date\` datetime DEFAULT NULL COMMENT '结束展示时间',
        \`created_at\` datetime DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`unique_novel_section\` (\`novel_id\`, \`section_type\`),
        KEY \`section_type\` (\`section_type\`),
        KEY \`display_order\` (\`display_order\`),
        KEY \`is_active\` (\`is_active\`),
        CONSTRAINT \`homepage_featured_novels_ibfk_1\` FOREIGN KEY (\`novel_id\`) REFERENCES \`novel\` (\`id\`) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    
    // 2. 创建首页轮播图管理表
    console.log('2. 创建 homepage_banners 表...');
    await executeQuery(`
      CREATE TABLE IF NOT EXISTS \`homepage_banners\` (
        \`id\` int NOT NULL AUTO_INCREMENT,
        \`novel_id\` int DEFAULT NULL COMMENT '关联的小说ID，可为空',
        \`title\` varchar(255) NOT NULL COMMENT '轮播图标题',
        \`subtitle\` varchar(255) DEFAULT NULL COMMENT '副标题',
        \`image_url\` varchar(500) NOT NULL COMMENT '轮播图图片URL',
        \`link_url\` varchar(500) DEFAULT NULL COMMENT '点击跳转链接',
        \`display_order\` int NOT NULL DEFAULT 0 COMMENT '显示顺序',
        \`is_active\` tinyint(1) DEFAULT 1 COMMENT '是否启用',
        \`start_date\` datetime DEFAULT NULL COMMENT '开始展示时间',
        \`end_date\` datetime DEFAULT NULL COMMENT '结束展示时间',
        \`created_at\` datetime DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        KEY \`display_order\` (\`display_order\`),
        KEY \`is_active\` (\`is_active\`),
        CONSTRAINT \`homepage_banners_ibfk_1\` FOREIGN KEY (\`novel_id\`) REFERENCES \`novel\` (\`id\`) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    
    // 3. 创建小说统计信息表
    console.log('3. 创建 novel_statistics 表...');
    await executeQuery(`
      CREATE TABLE IF NOT EXISTS \`novel_statistics\` (
        \`id\` int NOT NULL AUTO_INCREMENT,
        \`novel_id\` int NOT NULL,
        \`date\` date NOT NULL COMMENT '统计日期',
        \`views\` int DEFAULT 0 COMMENT '当日浏览量',
        \`reads\` int DEFAULT 0 COMMENT '当日阅读量',
        \`favorites\` int DEFAULT 0 COMMENT '当日收藏量',
        \`comments\` int DEFAULT 0 COMMENT '当日评论量',
        \`shares\` int DEFAULT 0 COMMENT '当日分享量',
        \`created_at\` datetime DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`unique_novel_date\` (\`novel_id\`, \`date\`),
        KEY \`date\` (\`date\`),
        KEY \`views\` (\`views\`),
        KEY \`reads\` (\`reads\`),
        CONSTRAINT \`novel_statistics_ibfk_1\` FOREIGN KEY (\`novel_id\`) REFERENCES \`novel\` (\`id\`) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    
    // 4. 创建首页配置表
    console.log('4. 创建 homepage_config 表...');
    await executeQuery(`
      CREATE TABLE IF NOT EXISTS \`homepage_config\` (
        \`id\` int NOT NULL AUTO_INCREMENT,
        \`section_name\` varchar(100) NOT NULL COMMENT '区块名称，如popular_this_week',
        \`section_title\` varchar(255) NOT NULL COMMENT '区块显示标题',
        \`display_limit\` int DEFAULT 6 COMMENT '显示数量限制',
        \`sort_by\` enum('manual','views','rating','recent','random','trending') DEFAULT 'manual' COMMENT '排序方式',
        \`is_active\` tinyint(1) DEFAULT 1 COMMENT '是否启用',
        \`description\` text COMMENT '区块描述',
        \`created_at\` datetime DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`section_name\` (\`section_name\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    
    // 5. 创建小说类型表
    console.log('5. 创建 genre 表...');
    await executeQuery(`
      CREATE TABLE IF NOT EXISTS \`genre\` (
        \`id\` int NOT NULL AUTO_INCREMENT,
        \`name\` varchar(100) NOT NULL COMMENT '类型名称',
        \`slug\` varchar(100) NOT NULL COMMENT 'URL友好的名称',
        \`chinese_name\` text COMMENT '中文名称',
        \`is_active\` tinyint(1) DEFAULT 1,
        \`created_at\` datetime DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`name\` (\`name\`),
        UNIQUE KEY \`slug\` (\`slug\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    
    // 6. 创建小说与类型关联表
    console.log('6. 创建 novel_genre_relation 表...');
    await executeQuery(`
      CREATE TABLE IF NOT EXISTS \`novel_genre_relation\` (
        \`id\` int NOT NULL AUTO_INCREMENT,
        \`novel_id\` int NOT NULL,
        \`genre_id_1\` int NOT NULL,
        \`genre_id_2\` int DEFAULT NULL COMMENT '第二类型ID',
        \`created_at\` datetime DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`unique_id_novel\` (\`id\`, \`novel_id\`),
        KEY \`novel_id\` (\`novel_id\`),
        KEY \`genre_id_1\` (\`genre_id_1\`),
        KEY \`genre_id_2\` (\`genre_id_2\`),
        CONSTRAINT \`novel_genre_relation_ibfk_1\` FOREIGN KEY (\`novel_id\`) REFERENCES \`novel\` (\`id\`) ON DELETE CASCADE,
        CONSTRAINT \`novel_genre_relation_ibfk_2\` FOREIGN KEY (\`genre_id_1\`) REFERENCES \`genre\` (\`id\`) ON DELETE CASCADE,
        CONSTRAINT \`novel_genre_relation_ibfk_3\` FOREIGN KEY (\`genre_id_2\`) REFERENCES \`genre\` (\`id\`) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    
    console.log('\n✅ 所有表创建完成！');
    
    // 插入默认数据
    console.log('\n开始插入默认数据...');
    await insertDefaultData();
    
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

async function insertDefaultData() {
  try {
    // 插入默认的首页配置数据
    console.log('插入首页配置数据...');
    await executeQuery(`
      INSERT IGNORE INTO \`homepage_config\` (\`section_name\`, \`section_title\`, \`display_limit\`, \`sort_by\`, \`is_active\`, \`description\`) VALUES
      ('popular_this_week', 'Popular This Week', 6, 'views', 1, '本周最受欢迎的小说'),
      ('new_releases', 'New Releases', 6, 'recent', 1, '最新发布的小说'),
      ('top_series', 'Top Series', 6, 'rating', 1, '评分最高的小说系列'),
      ('trending', 'Trending Now', 6, 'trending', 1, '当前热门小说'),
      ('recommended', 'Recommended For You', 6, 'random', 1, '为你推荐')
    `);
    
    // 插入默认的小说类型数据
    console.log('插入小说类型数据...');
    await executeQuery(`
      INSERT IGNORE INTO \`genre\` (\`name\`, \`slug\`, \`chinese_name\`, \`is_active\`) VALUES
      ('Fantasy', 'fantasy', '奇幻小说', 1),
      ('Romance', 'romance', '言情小说', 1),
      ('Action', 'action', '动作冒险', 1),
      ('Comedy', 'comedy', '喜剧小说', 1),
      ('Drama', 'drama', '戏剧小说', 1),
      ('Mystery', 'mystery', '悬疑小说', 1),
      ('Sci-fi', 'sci-fi', '科幻小说', 1),
      ('Historical', 'historical', '历史小说', 1)
    `);
    
    console.log('✓ 默认数据插入完成');
  } catch (error) {
    console.error('插入默认数据时出错:', error);
  }
}

async function verifyTables() {
  const tables = [
    'homepage_featured_novels',
    'homepage_banners', 
    'novel_statistics',
    'homepage_config',
    'genre',
    'novel_genre_relation'
  ];
  
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
createTables();
