// 改进的留存率分析 - 基于更严格的继续阅读标准
const mysql = require('mysql2/promise');

// 数据库配置
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '123456',
  database: process.env.DB_NAME || 'kongfuworld',
  charset: 'utf8mb4'
};

async function improvedRetentionAnalysis() {
  let db;
  try {
    db = await mysql.createConnection(dbConfig);
    
    console.log('\n📊 改进的留存率分析 - 基于更严格的继续阅读标准\n');
    
    // 1. 不同门槛的留存率对比
    console.log('🔍 1. 不同继续阅读门槛的留存率对比:');
    
    const thresholds = [
      { name: '2章+ (原标准)', minChapters: 2 },
      { name: '5章+ (建议标准)', minChapters: 5 },
      { name: '10章+ (严格标准)', minChapters: 10 },
      { name: '20章+ (高门槛)', minChapters: 20 }
    ];
    
    for (const threshold of thresholds) {
      console.log(`\n📈 ${threshold.name}:`);
      
      const [results] = await db.execute(`
        SELECT 
          c.novel_id,
          n.title as novel_title,
          COUNT(DISTINCT rl.user_id) as total_readers,
          COUNT(DISTINCT CASE 
            WHEN reader_sequence.chapter_sequence >= ${threshold.minChapters}
            THEN rl.user_id 
          END) as retained_readers,
          ROUND(
            COUNT(DISTINCT CASE 
              WHEN reader_sequence.chapter_sequence >= ${threshold.minChapters}
              THEN rl.user_id 
            END) * 100.0 / COUNT(DISTINCT rl.user_id), 2
          ) as retention_rate_percent
        FROM reading_log rl
        JOIN chapter c ON rl.chapter_id = c.id
        JOIN novel n ON c.novel_id = n.id
        LEFT JOIN (
          SELECT 
            user_id,
            chapter_id,
            ROW_NUMBER() OVER (
              PARTITION BY user_id, c2.novel_id 
              ORDER BY read_at
            ) as chapter_sequence
          FROM reading_log rl2
          JOIN chapter c2 ON rl2.chapter_id = c2.id
        ) reader_sequence ON rl.user_id = reader_sequence.user_id 
          AND rl.chapter_id = reader_sequence.chapter_id
        GROUP BY c.novel_id, n.title
        ORDER BY retention_rate_percent DESC
      `);
      
      results.forEach(novel => {
        console.log(`   📖 ${novel.novel_title}: ${novel.retention_rate_percent}% (${novel.retained_readers}/${novel.total_readers})`);
      });
    }
    
    // 2. 读者阅读深度分布分析
    console.log('\n🔍 2. 读者阅读深度分布分析:');
    const [depthAnalysis] = await db.execute(`
      SELECT 
        c.novel_id,
        n.title as novel_title,
        CASE 
          WHEN reader_sequence.chapter_sequence = 1 THEN '1章 (试读)'
          WHEN reader_sequence.chapter_sequence BETWEEN 2 AND 4 THEN '2-4章 (浅度阅读)'
          WHEN reader_sequence.chapter_sequence BETWEEN 5 AND 9 THEN '5-9章 (中度阅读)'
          WHEN reader_sequence.chapter_sequence BETWEEN 10 AND 19 THEN '10-19章 (深度阅读)'
          WHEN reader_sequence.chapter_sequence >= 20 THEN '20章+ (忠实读者)'
        END as reading_depth,
        COUNT(DISTINCT rl.user_id) as readers_count
      FROM reading_log rl
      JOIN chapter c ON rl.chapter_id = c.id
      JOIN novel n ON c.novel_id = n.id
      JOIN (
        SELECT 
          user_id,
          chapter_id,
          ROW_NUMBER() OVER (
            PARTITION BY user_id, c2.novel_id 
            ORDER BY read_at
          ) as chapter_sequence
        FROM reading_log rl2
        JOIN chapter c2 ON rl2.chapter_id = c2.id
      ) reader_sequence ON rl.user_id = reader_sequence.user_id 
        AND rl.chapter_id = reader_sequence.chapter_id
      GROUP BY c.novel_id, n.title, reading_depth
      ORDER BY c.novel_id, 
        CASE reading_depth
          WHEN '1章 (试读)' THEN 1
          WHEN '2-4章 (浅度阅读)' THEN 2
          WHEN '5-9章 (中度阅读)' THEN 3
          WHEN '10-19章 (深度阅读)' THEN 4
          WHEN '20章+ (忠实读者)' THEN 5
        END
    `);
    
    const depthByNovel = {};
    depthAnalysis.forEach(record => {
      if (!depthByNovel[record.novel_id]) {
        depthByNovel[record.novel_id] = {
          title: record.novel_title,
          depths: []
        };
      }
      depthByNovel[record.novel_id].depths.push({
        depth: record.reading_depth,
        count: record.readers_count
      });
    });
    
    Object.values(depthByNovel).forEach(novel => {
      console.log(`\n📖 ${novel.title}:`);
      novel.depths.forEach(depth => {
        console.log(`   ${depth.depth}: ${depth.count} 读者`);
      });
    });
    
    // 3. 建议的继续阅读标准
    console.log('\n🔍 3. 建议的继续阅读标准分析:');
    console.log('   📊 行业标准分析:');
    console.log('     - 2章+: 门槛过低，容易产生"假留存"');
    console.log('     - 5章+: 平衡标准，适合大部分平台');
    console.log('     - 10章+: 严格标准，反映真实粘性');
    console.log('     - 20章+: 高门槛，只计算忠实读者');
    console.log('');
    console.log('   🎯 七猫建议标准:');
    console.log('     - 基础留存: 5章+ (反映初步兴趣)');
    console.log('     - 深度留存: 10章+ (反映真实粘性)');
    console.log('     - 忠实留存: 20章+ (反映核心粉丝)');
    console.log('');
    console.log('   💰 奖励对应:');
    console.log('     - 5章+ 留存率 ≥ 30%: 40元/千字');
    console.log('     - 10章+ 留存率 ≥ 20%: 40元/千字');
    console.log('     - 20章+ 留存率 ≥ 10%: 40元/千字');
    
    // 4. 改进的留存率计算API建议
    console.log('\n🔍 4. 改进的留存率计算API建议:');
    console.log('   📝 建议实现多个留存率指标:');
    console.log('     - basic_retention: 5章+ 留存率');
    console.log('     - deep_retention: 10章+ 留存率');
    console.log('     - loyal_retention: 20章+ 留存率');
    console.log('     - overall_retention: 综合留存率');
    console.log('');
    console.log('   🔧 API接口设计:');
    console.log('     GET /api/retention-analysis/:novelId');
    console.log('     Response: {');
    console.log('       "basic_retention": 85.5,');
    console.log('       "deep_retention": 72.3,');
    console.log('       "loyal_retention": 45.2,');
    console.log('       "reward_tier": "最高等级"');
    console.log('     }');
    
  } catch (error) {
    console.error('❌ 分析失败:', error);
  } finally {
    if (db) await db.end();
  }
}

// 运行分析
improvedRetentionAnalysis();
