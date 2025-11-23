// 计算小说留存率的完整分析脚本
const mysql = require('mysql2/promise');

// 数据库配置
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '123456',
  database: process.env.DB_NAME || 'kongfuworld',
  charset: 'utf8mb4'
};

async function calculateRetentionRate(novelId = null) {
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
      ${novelId ? 'WHERE c.novel_id = ?' : ''}
      GROUP BY c.novel_id, n.title
      ORDER BY retention_rate_percent DESC
    `, novelId ? [novelId] : []);
    
    basicRetention.forEach(novel => {
      console.log(`   📖 ${novel.novel_title} (ID: ${novel.novel_id})`);
      console.log(`      总读者数: ${novel.total_readers}`);
      console.log(`      留存读者数: ${novel.retained_readers}`);
      console.log(`      留存率: ${novel.retention_rate_percent}%`);
      console.log('');
    });
    
    // 2. 多章节门槛留存率 (假设每章2000字，10万字=50章)
    console.log('🔍 2. 多章节门槛留存率分析 (≥50章):');
    const [retentionAfter50Chapters] = await db.execute(`
      SELECT 
        c.novel_id,
        n.title as novel_title,
        n.chapters,
        COUNT(DISTINCT rl.user_id) as readers_after_50_chapters,
        COUNT(DISTINCT CASE 
          WHEN reader_sequence.chapter_sequence > 1 
          THEN rl.user_id 
        END) as retained_after_50_chapters,
        ROUND(
          COUNT(DISTINCT CASE 
            WHEN reader_sequence.chapter_sequence > 1 
            THEN rl.user_id 
          END) * 100.0 / COUNT(DISTINCT rl.user_id), 2
        ) as retention_rate_after_50_chapters
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
      WHERE n.chapters >= 50
      ${novelId ? 'AND c.novel_id = ?' : ''}
      GROUP BY c.novel_id, n.title, n.chapters
      ORDER BY retention_rate_after_50_chapters DESC
    `, novelId ? [novelId] : []);
    
    retentionAfter50Chapters.forEach(novel => {
      console.log(`   📖 ${novel.novel_title} (ID: ${novel.novel_id})`);
      console.log(`      总章节数: ${novel.chapters}`);
      console.log(`      多章节读者数: ${novel.readers_after_50_chapters}`);
      console.log(`      多章节留存读者数: ${novel.retained_after_50_chapters}`);
      console.log(`      多章节留存率: ${novel.retention_rate_after_50_chapters}%`);
      console.log('');
    });
    
    // 3. 日阅读UV分析
    console.log('🔍 3. 日阅读UV分析 (最近7天):');
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
      ${novelId ? 'AND c.novel_id = ?' : ''}
      GROUP BY c.novel_id, n.title, DATE(rl.read_at)
      ORDER BY read_date DESC, daily_uv DESC
    `, novelId ? [novelId] : []);
    
    dailyUV.forEach(record => {
      console.log(`   📅 ${record.read_date} - ${record.novel_title}: ${record.daily_uv} UV`);
    });
    
    // 4. 留存率阶梯分析
    console.log('\n🔍 4. 留存率阶梯分析:');
    const [retentionTiers] = await db.execute(`
      SELECT 
        c.novel_id,
        n.title as novel_title,
        CASE 
          WHEN retention_rate < 5 THEN '0-5%'
          WHEN retention_rate < 10 THEN '5-10%'
          WHEN retention_rate < 15 THEN '10-15%'
          WHEN retention_rate < 20 THEN '15-20%'
          WHEN retention_rate < 25 THEN '20-25%'
          WHEN retention_rate < 30 THEN '25-30%'
          ELSE '30%以上'
        END as retention_tier,
        COUNT(*) as novel_count
      FROM (
        SELECT 
          c.novel_id,
          n.title,
          ROUND(
            COUNT(DISTINCT CASE 
              WHEN reader_sequence.chapter_sequence > 1 
              THEN rl.user_id 
            END) * 100.0 / COUNT(DISTINCT rl.user_id), 2
          ) as retention_rate
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
        ${novelId ? 'WHERE c.novel_id = ?' : ''}
        GROUP BY c.novel_id, n.title
      ) retention_data
      GROUP BY retention_tier
      ORDER BY 
        CASE retention_tier
          WHEN '0-5%' THEN 1
          WHEN '5-10%' THEN 2
          WHEN '10-15%' THEN 3
          WHEN '15-20%' THEN 4
          WHEN '20-25%' THEN 5
          WHEN '25-30%' THEN 6
          WHEN '30%以上' THEN 7
        END
    `, novelId ? [novelId] : []);
    
    retentionTiers.forEach(tier => {
      console.log(`   📊 ${tier.retention_tier}: ${tier.novel_count} 部小说`);
    });
    
  } catch (error) {
    console.error('❌ 计算失败:', error);
  } finally {
    if (db) await db.end();
  }
}

// 运行分析
const novelId = process.argv[2] ? parseInt(process.argv[2]) : null;
calculateRetentionRate(novelId);
