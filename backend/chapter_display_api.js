// 章节展示API设计
const express = require('express');
const mysql = require('mysql2/promise');

// 1. 获取小说的卷和章节信息
app.get('/api/novel/:novelId/volumes', async (req, res) => {
  const { novelId } = req.params;
  const { sort = 'newest' } = req.query; // newest, oldest, volume_id

    try {
    const conn = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: '123456',
      database: 'kongfuworld'
    });

    // 获取卷信息
    let orderBy = 'v.volume_id DESC';
    if (sort === 'oldest') {
      orderBy = 'v.volume_id ASC';
    } else if (sort === 'newest') {
      orderBy = 'v.volume_id DESC';
    }

    const [volumes] = await conn.execute(`
      SELECT 
        v.id,
        v.volume_id,
        v.title,
        v.start_chapter,
        v.end_chapter,
        v.chapter_count,
        COUNT(c.id) as actual_chapter_count,
        MAX(c.created_at) as latest_chapter_date
      FROM volume v
      LEFT JOIN chapter c ON v.volume_id = c.volume_id AND c.novel_id = v.novel_id AND c.review_status = 'approved'
      WHERE v.novel_id = ?
      GROUP BY v.id, v.volume_id, v.title, v.start_chapter, v.end_chapter, v.chapter_count
      ORDER BY ${orderBy}
    `, [novelId]);

    // 获取最新章节信息
    const [latestChapter] = await conn.execute(`
      SELECT 
        c.id,
        c.chapter_number,
        c.title,
        c.created_at,
        v.volume_id
      FROM chapter c
      JOIN volume v ON c.volume_id = v.volume_id AND v.novel_id = c.novel_id
      WHERE c.novel_id = ? AND c.review_status = 'approved'
      ORDER BY c.created_at DESC
      LIMIT 1
    `, [novelId]);

    await conn.end();

    res.json({
      success: true,
      data: {
        volumes,
        latest_chapter: latestChapter[0] || null,
        total_volumes: volumes.length
      }
    });

  } catch (error) {
    console.error('获取卷信息失败:', error);
    res.status(500).json({ message: '获取卷信息失败' });
  }
});

// 2. 获取指定卷的章节列表
app.get('/api/volume/:volumeId/chapters', async (req, res) => {
  const { volumeId } = req.params;
  const { sort = 'chapter_number' } = req.query; // chapter_number, newest, oldest
  const { page = 1, limit = 50 } = req.query;

  try {
    const conn = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: '123456',
      database: 'kongfuworld'
    });

    const offset = (page - 1) * limit;

    // 获取卷信息
    const [volumeInfo] = await conn.execute(`
      SELECT v.*, n.title as novel_title
      FROM volume v
      JOIN novel n ON v.novel_id = n.id
      WHERE v.id = ?
    `, [volumeId]);

    if (volumeInfo.length === 0) {
      await conn.end();
      return res.status(404).json({ message: '卷不存在' });
    }

    // 获取章节列表
    let orderBy = 'c.chapter_number ASC';
    if (sort === 'newest') {
      orderBy = 'c.created_at DESC';
    } else if (sort === 'oldest') {
      orderBy = 'c.created_at ASC';
    }

    const [chapters] = await conn.execute(`
      SELECT 
        c.id,
        c.chapter_number,
        c.title,
        c.created_at,
        c.is_advance,
        c.unlock_price,
        CASE 
          WHEN c.unlock_price > 0 THEN 'locked'
          WHEN c.is_advance = 1 THEN 'advance'
          ELSE 'free'
        END as access_status
      FROM chapter c
      WHERE c.volume_id = ? AND c.review_status = 'approved'
      ORDER BY ${orderBy}
      LIMIT ? OFFSET ?
    `, [volumeId, parseInt(limit), parseInt(offset)]);

    // 获取章节总数
    const [totalResult] = await conn.execute(`
      SELECT COUNT(*) as total
      FROM chapter c
      WHERE c.volume_id = ? AND c.review_status = 'approved'
    `, [volumeId]);

    await conn.end();

    res.json({
      success: true,
      data: {
        volume: volumeInfo[0],
        chapters,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: totalResult[0].total,
          pages: Math.ceil(totalResult[0].total / limit)
        }
      }
    });

  } catch (error) {
    console.error('获取章节列表失败:', error);
    res.status(500).json({ message: '获取章节列表失败' });
  }
});

// 3. 获取小说的章节统计信息
app.get('/api/novel/:novelId/chapter-stats', async (req, res) => {
  const { novelId } = req.params;

  try {
    const conn = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: '123456',
      database: 'kongfuworld'
    });

    // 获取章节统计
    const [stats] = await conn.execute(`
      SELECT 
        COUNT(*) as total_chapters,
        COUNT(CASE WHEN unlock_price = 0 OR unlock_price IS NULL THEN 1 END) as free_chapters,
        COUNT(CASE WHEN unlock_price > 0 THEN 1 END) as locked_chapters,
        COUNT(CASE WHEN is_advance = 1 THEN 1 END) as advance_chapters,
        MAX(created_at) as latest_chapter_date
      FROM chapter
      WHERE novel_id = ? AND review_status = 'approved'
    `, [novelId]);

    // 获取卷统计
    const [volumeStats] = await conn.execute(`
      SELECT 
        COUNT(*) as total_volumes,
        SUM(chapter_count) as total_chapters_in_volumes
      FROM volume
      WHERE novel_id = ?
    `, [novelId]);

    await conn.end();

    res.json({
      success: true,
      data: {
        chapters: stats[0],
        volumes: volumeStats[0]
      }
    });

  } catch (error) {
    console.error('获取章节统计失败:', error);
    res.status(500).json({ message: '获取章节统计失败' });
  }
});

module.exports = {
  // 导出API函数
};
