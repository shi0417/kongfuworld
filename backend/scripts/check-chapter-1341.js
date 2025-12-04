const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: 'localhost',
  user: 'root',
  password: '123456',
  database: 'kongfuworld',
  waitForConnections: true,
  connectionLimit: 10
});

(async () => {
  try {
    // 检查章节 1341 的信息
    const [chapter1341] = await pool.query(
      'SELECT id, novel_id, chapter_number, review_status FROM chapter WHERE id = 1341'
    );
    
    console.log('=== 章节 1341 信息 ===');
    console.log(chapter1341[0]);
    
    const novelId = chapter1341[0].novel_id;
    const chapterNumber = chapter1341[0].chapter_number;
    
    // 检查同一小说中所有已审核的章节
    const [allChapters] = await pool.query(
      'SELECT id, chapter_number, review_status FROM chapter WHERE novel_id = ? AND review_status = "approved" ORDER BY chapter_number',
      [novelId]
    );
    
    console.log(`\n=== 小说 ${novelId} 的所有已审核章节 (共 ${allChapters.length} 个) ===`);
    allChapters.forEach(r => {
      const marker = r.id === 1341 ? ' <-- 当前章节' : '';
      console.log(`ID: ${r.id}, 章节号: ${r.chapter_number}, 状态: ${r.review_status}${marker}`);
    });
    
    // 测试 SQL 子查询
    const [prevQuery] = await pool.query(
      `SELECT id
       FROM chapter
       WHERE novel_id = ?
         AND review_status = 'approved'
         AND chapter_number < ?
       ORDER BY chapter_number DESC
       LIMIT 1`,
      [novelId, chapterNumber]
    );
    
    const [nextQuery] = await pool.query(
      `SELECT id
       FROM chapter
       WHERE novel_id = ?
         AND review_status = 'approved'
         AND chapter_number > ?
       ORDER BY chapter_number ASC
       LIMIT 1`,
      [novelId, chapterNumber]
    );
    
    console.log(`\n=== SQL 查询结果 ===`);
    console.log(`上一章查询结果:`, prevQuery.length > 0 ? `ID ${prevQuery[0].id}` : 'null');
    console.log(`下一章查询结果:`, nextQuery.length > 0 ? `ID ${nextQuery[0].id}` : 'null');
    
    // 测试完整的后端 SQL
    const [fullQuery] = await pool.query(
      `SELECT 
        c.id,
        c.novel_id,
        c.volume_id,
        c.chapter_number,
        c.title,
        (SELECT id
         FROM chapter
         WHERE novel_id = c.novel_id
           AND review_status = 'approved'
           AND chapter_number < c.chapter_number
         ORDER BY chapter_number DESC
         LIMIT 1) AS prev_chapter_id,
        (SELECT id
         FROM chapter
         WHERE novel_id = c.novel_id
           AND review_status = 'approved'
           AND chapter_number > c.chapter_number
         ORDER BY chapter_number ASC
         LIMIT 1) AS next_chapter_id
      FROM chapter c
      WHERE c.id = 1341 AND c.review_status = 'approved'`,
      []
    );
    
    console.log(`\n=== 完整 SQL 查询结果 ===`);
    if (fullQuery.length > 0) {
      const result = fullQuery[0];
      console.log('章节ID:', result.id);
      console.log('章节号:', result.chapter_number);
      console.log('prev_chapter_id:', result.prev_chapter_id, '| 类型:', typeof result.prev_chapter_id);
      console.log('next_chapter_id:', result.next_chapter_id, '| 类型:', typeof result.next_chapter_id);
    }
    
    await pool.end();
  } catch (error) {
    console.error('错误:', error);
    await pool.end();
    process.exit(1);
  }
})();

