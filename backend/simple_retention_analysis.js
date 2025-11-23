// 简化的留存率分析脚本
const mysql = require('mysql2/promise');

// 数据库配置
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '123456',
  database: process.env.DB_NAME || 'kongfuworld',
  charset: 'utf8mb4'
};

async function analyzeRetention() {
  let db;
  try {
    db = await mysql.createConnection(dbConfig);
    
    console.log('\n📊 小说留存率分析\n');
    
    // 1. 基础留存率计算
    console.log('🔍 1. 基础留存率分析:');
    const [basicRetention] = await db.execute(`
      SELECT 
        c.novel_id,
        n.title as novel_title,
        COUNT(DISTINCT rl.user_id) as total_readers,
        COUNT(DISTINCT CASE 
          WHEN reader_sequence.chapter_sequence > 1 
          THEN rl.user_id 
        END) as retained_readers,
        ROUND(
          COUNT(DISTINCT CASE 
            WHEN reader_sequence.chapter_sequence > 1 
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
    
    basicRetention.forEach(novel => {
      console.log(`   📖 ${novel.novel_title} (ID: ${novel.novel_id})`);
      console.log(`      总读者数: ${novel.total_readers}`);
      console.log(`      留存读者数: ${novel.retained_readers}`);
      console.log(`      留存率: ${novel.retention_rate_percent}%`);
      console.log('');
    });
    
    // 2. 日阅读UV分析
    console.log('🔍 2. 日阅读UV分析 (最近7天):');
    const [dailyUV] = await db.execute(`
      SELECT 
        c.novel_id,
        n.title as novel_title,
        DATE(rl.read_at) as read_date,
        COUNT(DISTINCT rl.user_id) as daily_uv
      FROM reading_log rl
      JOIN chapter c ON rl.chapter_id = c.id
      JOIN novel n ON c.novel_id = n.id
      WHERE rl.read_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
      GROUP BY c.novel_id, n.title, DATE(rl.read_at)
      ORDER BY read_date DESC, daily_uv DESC
    `);
    
    dailyUV.forEach(record => {
      console.log(`   📅 ${record.read_date} - ${record.novel_title}: ${record.daily_uv} UV`);
    });
    
    // 3. 读者阅读深度分析
    console.log('\n🔍 3. 读者阅读深度分析:');
    const [readingDepth] = await db.execute(`
      SELECT 
        c.novel_id,
        n.title as novel_title,
        reader_sequence.chapter_sequence,
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
      WHERE reader_sequence.chapter_sequence <= 10
      GROUP BY c.novel_id, n.title, reader_sequence.chapter_sequence
      ORDER BY c.novel_id, reader_sequence.chapter_sequence
    `);
    
    const depthByNovel = {};
    readingDepth.forEach(record => {
      if (!depthByNovel[record.novel_id]) {
        depthByNovel[record.novel_id] = {
          title: record.novel_title,
          depths: []
        };
      }
      depthByNovel[record.novel_id].depths.push({
        chapter: record.chapter_sequence,
        readers: record.readers_count
      });
    });
    
    Object.values(depthByNovel).forEach(novel => {
      console.log(`   📖 ${novel.title}:`);
      novel.depths.forEach(depth => {
        console.log(`      第${depth.chapter}章: ${depth.readers} 读者`);
      });
      console.log('');
    });
    
  } catch (error) {
    console.error('❌ 分析失败:', error);
  } finally {
    if (db) await db.end();
  }
}

// 运行分析
analyzeRetention();
