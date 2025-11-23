// 留存率计算详细演示
const mysql = require('mysql2/promise');

// 数据库配置
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '123456',
  database: process.env.DB_NAME || 'kongfuworld',
  charset: 'utf8mb4'
};

async function demonstrateRetentionCalculation() {
  let db;
  try {
    db = await mysql.createConnection(dbConfig);
    
    console.log('\n📊 留存率计算详细演示\n');
    
    // 1. 查看原始阅读数据
    console.log('🔍 1. 原始阅读数据:');
    const [rawData] = await db.execute(`
      SELECT 
        rl.user_id,
        rl.chapter_id,
        c.novel_id,
        n.title as novel_title,
        c.chapter_number,
        rl.read_at
      FROM reading_log rl
      JOIN chapter c ON rl.chapter_id = c.id
      JOIN novel n ON c.novel_id = n.id
      ORDER BY rl.user_id, c.novel_id, rl.read_at
    `);
    
    console.log('原始数据:');
    rawData.forEach(record => {
      console.log(`  用户${record.user_id} 阅读 ${record.novel_title} 第${record.chapter_number}章 (${record.read_at})`);
    });
    
    // 2. 计算每个用户在每个小说中的阅读顺序
    console.log('\n🔍 2. 阅读顺序计算:');
    const [readingSequence] = await db.execute(`
      SELECT 
        rl.user_id,
        rl.chapter_id,
        c.novel_id,
        n.title as novel_title,
        c.chapter_number,
        rl.read_at,
        ROW_NUMBER() OVER (
          PARTITION BY rl.user_id, c.novel_id 
          ORDER BY rl.read_at
        ) as chapter_sequence
      FROM reading_log rl
      JOIN chapter c ON rl.chapter_id = c.id
      JOIN novel n ON c.novel_id = n.id
      ORDER BY rl.user_id, c.novel_id, rl.read_at
    `);
    
    console.log('阅读顺序:');
    readingSequence.forEach(record => {
      console.log(`  用户${record.user_id} 阅读 ${record.novel_title} 第${record.chapter_number}章 → 第${record.chapter_sequence}次阅读`);
    });
    
    // 3. 按小说分组统计
    console.log('\n🔍 3. 按小说分组统计:');
    const [novelStats] = await db.execute(`
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
      ORDER BY c.novel_id
    `);
    
    novelStats.forEach(novel => {
      console.log(`\n📖 ${novel.novel_title} (ID: ${novel.novel_id}):`);
      console.log(`  总读者数: ${novel.total_readers}`);
      console.log(`  继续阅读读者数: ${novel.retained_readers}`);
      console.log(`  留存率: ${novel.retention_rate_percent}%`);
    });
    
    // 4. 详细分析每个用户的阅读行为
    console.log('\n🔍 4. 用户阅读行为详细分析:');
    const [userBehavior] = await db.execute(`
      SELECT 
        rl.user_id,
        c.novel_id,
        n.title as novel_title,
        COUNT(*) as chapters_read,
        MIN(rl.read_at) as first_read,
        MAX(rl.read_at) as last_read,
        CASE 
          WHEN COUNT(*) > 1 THEN '继续阅读'
          ELSE '只读一章'
        END as reading_behavior
      FROM reading_log rl
      JOIN chapter c ON rl.chapter_id = c.id
      JOIN novel n ON c.novel_id = n.id
      GROUP BY rl.user_id, c.novel_id, n.title
      ORDER BY rl.user_id, c.novel_id
    `);
    
    console.log('用户阅读行为:');
    userBehavior.forEach(behavior => {
      console.log(`  用户${behavior.user_id} 阅读 ${behavior.novel_title}:`);
      console.log(`    阅读章节数: ${behavior.chapters_read}`);
      console.log(`    首次阅读: ${behavior.first_read}`);
      console.log(`    最后阅读: ${behavior.last_read}`);
      console.log(`    行为类型: ${behavior.reading_behavior}`);
      console.log('');
    });
    
    // 5. 留存率计算逻辑说明
    console.log('\n📋 5. 留存率计算逻辑说明:');
    console.log('   ✅ 继续阅读的读者 = 阅读了2章或以上的读者');
    console.log('   ✅ 总读者数 = 阅读过该小说的所有读者');
    console.log('   ✅ 留存率 = 继续阅读读者数 ÷ 总读者数 × 100%');
    console.log('');
    console.log('   📊 判断标准:');
    console.log('     - 只读1章 = 未留存 (chapter_sequence = 1)');
    console.log('     - 读2章+ = 已留存 (chapter_sequence > 1)');
    console.log('');
    console.log('   🎯 七猫标准:');
    console.log('     - 留存率 ≥ 30% = 最高奖励 (40元/千字)');
    console.log('     - 留存率 25-30% = 25元/千字');
    console.log('     - 留存率 20-25% = 15元/千字');
    console.log('     - 留存率 15-20% = 10元/千字');
    console.log('     - 留存率 10-15% = 7元/千字');
    console.log('     - 留存率 5-10% = 6元/千字');
    console.log('     - 留存率 < 5% = 无奖励');
    
  } catch (error) {
    console.error('❌ 演示失败:', error);
  } finally {
    if (db) await db.end();
  }
}

// 运行演示
demonstrateRetentionCalculation();
