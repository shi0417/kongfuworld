// 测试章节展示API
const mysql = require('mysql2/promise');

(async () => {
  const conn = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '123456',
    database: 'kongfuworld'
  });

  try {
    console.log('🧪 测试章节展示API...');

    // 1. 测试获取卷信息
    console.log('📝 1. 测试获取卷信息...');
    const [volumes] = await conn.execute(`
      SELECT 
        v.id,
        v.volume_number,
        v.title,
        v.start_chapter,
        v.end_chapter,
        v.chapter_count,
        COUNT(c.id) as actual_chapter_count,
        MAX(c.created_at) as latest_chapter_date
      FROM volume v
      LEFT JOIN chapter c ON v.id = c.volume_id AND c.is_visible = 1
      WHERE v.novel_id = ?
      GROUP BY v.id, v.volume_number, v.title, v.start_chapter, v.end_chapter, v.chapter_count
      ORDER BY v.volume_number DESC
    `, [10]); // 测试小说ID为10

    console.log('📊 卷信息:');
    volumes.forEach(volume => {
      console.log(`  卷 ${volume.volume_number}: ${volume.title}`);
      console.log(`    章节数: ${volume.actual_chapter_count}/${volume.chapter_count}`);
      console.log(`    最新章节时间: ${volume.latest_chapter_date || '无'}`);
      console.log('');
    });

    // 2. 测试获取最新章节
    console.log('📝 2. 测试获取最新章节...');
    const [latestChapter] = await conn.execute(`
      SELECT 
        c.id,
        c.chapter_number,
        c.title,
        c.created_at,
        v.volume_number
      FROM chapter c
      JOIN volume v ON c.volume_id = v.volume_id AND v.novel_id = c.novel_id
      WHERE c.novel_id = ? AND c.is_visible = 1
      ORDER BY c.created_at DESC
      LIMIT 1
    `, [10]);

    if (latestChapter.length > 0) {
      console.log('📊 最新章节:');
      console.log(`  章节 ${latestChapter[0].chapter_number}: ${latestChapter[0].title}`);
      console.log(`  发布时间: ${latestChapter[0].created_at}`);
      console.log(`  所属卷: ${latestChapter[0].volume_number}`);
    } else {
      console.log('📊 暂无章节数据');
    }

    // 3. 测试获取指定卷的章节
    if (volumes.length > 0) {
      console.log('📝 3. 测试获取指定卷的章节...');
      const volumeId = volumes[0].id;
      
      const [chapters] = await conn.execute(`
        SELECT 
          c.id,
          c.chapter_number,
          c.title,
          c.created_at,
          c.is_locked,
          c.is_vip_only,
          c.is_advance,
          c.unlock_price,
          CASE 
            WHEN c.is_locked = 1 THEN 'locked'
            WHEN c.is_vip_only = 1 THEN 'vip_only'
            WHEN c.is_advance = 1 THEN 'advance'
            ELSE 'free'
          END as access_status
        FROM chapter c
        WHERE c.volume_id = ? AND c.is_visible = 1
        ORDER BY c.chapter_number ASC
        LIMIT 10
      `, [volumeId]);

      console.log(`📊 卷 ${volumes[0].volume_number} 的章节 (前10个):`);
      chapters.forEach(chapter => {
        console.log(`  章节 ${chapter.chapter_number}: ${chapter.title}`);
        console.log(`    状态: ${chapter.access_status}`);
        console.log(`    发布时间: ${chapter.created_at}`);
        console.log('');
      });
    }

    // 4. 测试章节统计
    console.log('📝 4. 测试章节统计...');
    const [stats] = await conn.execute(`
      SELECT 
        COUNT(*) as total_chapters,
        COUNT(CASE WHEN is_locked = 0 AND is_vip_only = 0 THEN 1 END) as free_chapters,
        COUNT(CASE WHEN is_locked = 1 THEN 1 END) as locked_chapters,
        COUNT(CASE WHEN is_vip_only = 1 THEN 1 END) as vip_chapters,
        COUNT(CASE WHEN is_advance = 1 THEN 1 END) as advance_chapters,
        MAX(created_at) as latest_chapter_date
      FROM chapter
      WHERE novel_id = ? AND is_visible = 1
    `, [10]);

    console.log('📊 章节统计:');
    console.log(`  总章节数: ${stats[0].total_chapters}`);
    console.log(`  免费章节: ${stats[0].free_chapters}`);
    console.log(`  锁定章节: ${stats[0].locked_chapters}`);
    console.log(`  VIP章节: ${stats[0].vip_chapters}`);
    console.log(`  预读章节: ${stats[0].advance_chapters}`);
    console.log(`  最新章节时间: ${stats[0].latest_chapter_date || '无'}`);

    console.log('🎉 章节展示API测试完成！');

  } catch (error) {
    console.error('❌ 测试过程中出现错误:', error);
  } finally {
    await conn.end();
  }
})();
