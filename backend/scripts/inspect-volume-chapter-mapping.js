/**
 * 检查 volume 和 chapter 之间的映射现状
 * 只做只读查询，不修改任何数据
 * 
 * 目标：
 * - 旧设计：chapter.volume_id = volume.volume_id
 * - 新设计：chapter.volume_id = volume.id（前提是 novel_id 相同）
 */

const mysql = require('mysql2/promise');

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '123456',
  database: process.env.DB_NAME || 'kongfuworld',
  charset: 'utf8mb4'
};

async function inspectMapping() {
  let db;

  const result = {
    timestamp: new Date().toISOString(),
    overview: {},
    perNovelCounts: [],
    newMappingStats: [],
    oldMappingStats: [],
    orphanChaptersSample: [],
    sampleNovels: {}
  };

  try {
    console.log('🔌 正在连接数据库...');
    db = await mysql.createConnection(dbConfig);
    console.log('✅ 数据库连接成功\n');

    // ==================== 2.1 整体统计 ====================
    console.log('📊 执行整体统计...');
    
    const [novelCount] = await db.execute('SELECT COUNT(*) as count FROM novel');
    const [volumeCount] = await db.execute('SELECT COUNT(*) as count FROM volume');
    const [chapterCount] = await db.execute('SELECT COUNT(*) as count FROM chapter');

    result.overview = {
      total_novels: novelCount[0].count,
      total_volumes: volumeCount[0].count,
      total_chapters: chapterCount[0].count
    };

    // 按小说维度统计卷/章数量
    const [perNovelStats] = await db.execute(`
      SELECT 
        n.id AS novel_id,
        n.title,
        COUNT(DISTINCT v.id) AS volume_count,
        COUNT(DISTINCT c.id) AS chapter_count
      FROM novel n
      LEFT JOIN volume v ON v.novel_id = n.id
      LEFT JOIN chapter c ON c.novel_id = n.id
      GROUP BY n.id, n.title
      ORDER BY n.id
    `);

    result.perNovelCounts = perNovelStats;

    // ==================== 2.2 新设计匹配成功统计 ====================
    console.log('📊 统计新设计匹配的章节...');
    
    const [newMappingStats] = await db.execute(`
      SELECT
        c.novel_id,
        COUNT(*) AS new_mapping_chapter_count
      FROM chapter c
      JOIN volume v
        ON v.id = c.volume_id
       AND v.novel_id = c.novel_id
      GROUP BY c.novel_id
      ORDER BY c.novel_id
    `);

    result.newMappingStats = newMappingStats;

    // ==================== 2.3 旧设计仍在使用统计 ====================
    console.log('📊 统计旧设计匹配的章节...');
    
    // 找出所有"按旧设计能对上"的章节
    const [oldMappingStats] = await db.execute(`
      SELECT
        c.novel_id,
        COUNT(*) AS old_mapping_chapter_count
      FROM chapter c
      JOIN volume v
        ON v.volume_id = c.volume_id
       AND v.novel_id = c.novel_id
      GROUP BY c.novel_id
      ORDER BY c.novel_id
    `);

    result.oldMappingStats = oldMappingStats;

    // 查找完全孤立的章节（既不是 volume.id，也不是 volume.volume_id）
    console.log('📊 查找孤立章节...');
    
    const [orphanChapters] = await db.execute(`
      SELECT
        c.id AS chapter_id,
        c.novel_id,
        c.volume_id,
        c.chapter_number,
        c.title
      FROM chapter c
      LEFT JOIN volume v_id
        ON v_id.id = c.volume_id
       AND v_id.novel_id = c.novel_id
      LEFT JOIN volume v_old
        ON v_old.volume_id = c.volume_id
       AND v_old.novel_id = c.novel_id
      WHERE v_id.id IS NULL
        AND v_old.id IS NULL
      ORDER BY c.novel_id, c.id
      LIMIT 200
    `);

    result.orphanChaptersSample = orphanChapters;

    // ==================== 2.4 单独验证几个关键小说 ====================
    console.log('📊 检查代表性小说...');
    
    // 找出有章节的小说ID（取前几个作为样本）
    const [novelsWithChapters] = await db.execute(`
      SELECT DISTINCT novel_id
      FROM chapter
      ORDER BY novel_id
      LIMIT 10
    `);

    const sampleNovelIds = novelsWithChapters.map(row => row.novel_id);
    // 确保包含用户提到的 novel_id = 7
    if (!sampleNovelIds.includes(7) && novelsWithChapters.length > 0) {
      sampleNovelIds.unshift(7);
    }

    for (const novelId of sampleNovelIds) {
      // 获取该小说的卷列表
      const [volumes] = await db.execute(`
        SELECT id, novel_id, volume_id, title
        FROM volume
        WHERE novel_id = ?
        ORDER BY volume_id, id
      `, [novelId]);

      // 获取该小说的章节关联情况
      const [chapters] = await db.execute(`
        SELECT
          c.id AS chapter_id,
          c.chapter_number,
          c.volume_id AS chapter_volume_id,
          v_by_id.id       AS matched_volume_id_by_id,
          v_by_id.volume_id AS matched_volume_volume_id_by_id,
          v_by_old.id      AS matched_volume_id_by_old,
          v_by_old.volume_id AS matched_volume_volume_id_by_old
        FROM chapter c
        LEFT JOIN volume v_by_id
          ON v_by_id.id = c.volume_id
         AND v_by_id.novel_id = c.novel_id
        LEFT JOIN volume v_by_old
          ON v_by_old.volume_id = c.volume_id
         AND v_by_old.novel_id = c.novel_id
        WHERE c.novel_id = ?
        ORDER BY c.chapter_number
        LIMIT 300
      `, [novelId]);

      result.sampleNovels[novelId] = {
        volumes: volumes,
        chapters: chapters
      };
    }

    console.log('✅ 检查完成\n');

    // 输出 JSON 结果
    console.log(JSON.stringify(result, null, 2));

  } catch (error) {
    console.error('❌ 检查过程中出错:', error);
    process.exit(1);
  } finally {
    if (db) {
      await db.end();
      console.log('\n🔌 数据库连接已关闭');
    }
  }
}

// 运行检查
inspectMapping().catch(error => {
  console.error('❌ 脚本执行失败:', error);
  process.exit(1);
});

