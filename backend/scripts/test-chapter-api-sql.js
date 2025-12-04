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
    const chapterId = 857;
    
    const query = `
      SELECT 
        c.id,
        c.novel_id,
        c.volume_id,
        c.chapter_number,
        c.title,
        c.content,
        c.unlock_price,
        c.translator_note,
        n.title as novel_title,
        n.author,
        n.translator,
        v.title as volume_title,
        v.volume_id,
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
      JOIN novel n ON c.novel_id = n.id
      LEFT JOIN volume v ON c.volume_id = v.id
        AND v.novel_id = c.novel_id
      WHERE c.id = ? AND c.review_status = 'approved'
    `;
    
    const [results] = await pool.query(query, [chapterId]);
    
    console.log('=== SQL 查询结果 ===');
    console.log('结果数量:', results.length);
    if (results.length > 0) {
      const chapter = results[0];
      console.log('章节ID:', chapter.id);
      console.log('章节号:', chapter.chapter_number);
      console.log('prev_chapter_id:', chapter.prev_chapter_id);
      console.log('next_chapter_id:', chapter.next_chapter_id);
      console.log('prev_chapter_id 类型:', typeof chapter.prev_chapter_id);
      console.log('next_chapter_id 类型:', typeof chapter.next_chapter_id);
      console.log('prev_chapter_id 是否为 null:', chapter.prev_chapter_id === null);
      console.log('next_chapter_id 是否为 null:', chapter.next_chapter_id === null);
      console.log('prev_chapter_id 是否为 undefined:', chapter.prev_chapter_id === undefined);
      console.log('next_chapter_id 是否为 undefined:', chapter.next_chapter_id === undefined);
    } else {
      console.log('❌ 没有找到章节');
    }
    
    await pool.end();
  } catch (error) {
    console.error('错误:', error);
    await pool.end();
    process.exit(1);
  }
})();

