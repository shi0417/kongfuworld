const express = require('express');
const router = express.Router();
const mysql = require('mysql2/promise');

const dbConfig = {
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME
};

async function getConnection() {
  return await mysql.createConnection(dbConfig);
}

// 获取用户当前阅读列表
router.get('/current-reads/:user_id', async (req, res) => {
  const { user_id } = req.params;
  const { page = 1, limit = 20 } = req.query;
  
  const offset = (parseInt(page) - 1) * parseInt(limit);
  
  console.log('分页参数:', { user_id, page, limit, offset });
  
  let connection;
  try {
    connection = await getConnection();
    
    // 先获取总数
    const [countResult] = await connection.execute(`
      SELECT COUNT(*) as total
      FROM (
        SELECT c.novel_id
        FROM reading_log rl
        INNER JOIN chapter c ON rl.chapter_id = c.id
        INNER JOIN novel n ON c.novel_id = n.id
        LEFT JOIN bookmark b ON rl.user_id = b.user_id AND c.novel_id = b.novel_id
        WHERE rl.user_id = ?
          AND (b.bookmark_closed IS NULL OR b.bookmark_closed = 0)
        GROUP BY c.novel_id
      ) unique_novels
    `, [user_id]);
    
    const total = countResult[0].total;
    const totalPages = Math.ceil(total / parseInt(limit));
    
    // 查询用户阅读过的小说，优先显示锁定的章节
    const [novels] = await connection.execute(`
      SELECT 
        latest.novel_id,
        -- 优先显示锁定章节，否则显示最新阅读章节
        COALESCE(locked_chapter.chapter_id, latest.last_read_chapter_id) as last_read_chapter_id,
        latest.last_read_at,
        latest.bookmark_locked,
        latest.novel_name,
        COALESCE(latest.bookmark_closed, 0) as bookmark_closed,
        COALESCE(latest.notification_off, 0) as notification_off,
        latest.bookmark_updated_at,
        -- 优先显示锁定章节的标题，否则显示最新阅读章节的标题
        COALESCE(locked_chapter.chapter_title, latest.chapter_title) as chapter_title,
        COALESCE(locked_chapter.chapter_number, latest.last_read_chapter_number) as last_read_chapter_number,
        latest.novel_title,
        latest.chapters,
        latest.novel_status,
        latest.novel_cover,
        latest_chapter.latest_chapter_id,
        latest_chapter.latest_chapter_title,
        latest_chapter.latest_chapter_number,
        COALESCE(locked_chapter.bookmark_locked, 0) as chapter_bookmark_locked
      FROM (
        -- 获取每本小说的最新阅读记录
        SELECT 
          rl.user_id,
          c.novel_id,
          rl.chapter_id as last_read_chapter_id,
          rl.read_at as last_read_at,
          rl.bookmark_locked,
          b.novel_name,
          b.bookmark_closed,
          b.notification_off,
          b.updated_at as bookmark_updated_at,
          c.title as chapter_title,
          c.chapter_number as last_read_chapter_number,
          n.title as novel_title,
          n.chapters,
          n.status as novel_status,
          CONCAT('http://localhost:5000', n.cover) as novel_cover,
          ROW_NUMBER() OVER (PARTITION BY c.novel_id ORDER BY rl.read_at DESC) as rn
        FROM reading_log rl
        INNER JOIN chapter c ON rl.chapter_id = c.id
        INNER JOIN novel n ON c.novel_id = n.id
        LEFT JOIN bookmark b ON rl.user_id = b.user_id AND c.novel_id = b.novel_id
        WHERE rl.user_id = ?
          AND (b.bookmark_closed IS NULL OR b.bookmark_closed = 0)
      ) latest
      -- 获取每本小说的锁定章节（如果有的话）
      LEFT JOIN (
        SELECT 
          bl.user_id,
          bl.novel_id,
          bl.chapter_id,
          bl.bookmark_locked,
          c.title as chapter_title,
          c.chapter_number as chapter_number,
          ROW_NUMBER() OVER (PARTITION BY bl.novel_id ORDER BY bl.updated_at DESC) as rn
        FROM bookmarklocked bl
        INNER JOIN chapter c ON bl.chapter_id = c.id
        WHERE bl.user_id = ? AND bl.bookmark_locked = 1
      ) locked_chapter ON latest.novel_id = locked_chapter.novel_id AND locked_chapter.rn = 1
      -- 获取每本小说的最新章节
      LEFT JOIN (
        SELECT 
          c2.novel_id,
          c2.id as latest_chapter_id,
          c2.title as latest_chapter_title,
          c2.chapter_number as latest_chapter_number,
          ROW_NUMBER() OVER (PARTITION BY c2.novel_id ORDER BY c2.id DESC) as rn
        FROM chapter c2
      ) latest_chapter ON latest.novel_id = latest_chapter.novel_id AND latest_chapter.rn = 1
      WHERE latest.rn = 1
      ORDER BY latest.last_read_at DESC
      LIMIT ${parseInt(limit)} OFFSET ${parseInt(offset)}
    `, [user_id, user_id]);

    console.log(`获取用户 ${user_id} 的当前阅读列表，找到 ${novels.length} 本小说`);
    
    // 调试：打印第一本小说的数据
    if (novels.length > 0) {
      console.log('第一本小说数据:', JSON.stringify(novels[0], null, 2));
    }
    
    res.json({
      success: true,
      data: novels,
      pagination: {
        currentPage: parseInt(page),
        totalPages: totalPages,
        totalItems: total,
        itemsPerPage: parseInt(limit),
        hasNextPage: parseInt(page) < totalPages,
        hasPrevPage: parseInt(page) > 1
      }
    });
  } catch (error) {
    console.error('获取当前阅读列表失败:', error);
    res.json({ success: false, message: '获取当前阅读列表失败: ' + error.message });
  } finally {
    if (connection) await connection.end();
  }
});

// 获取用户收藏章节列表
router.get('/favorite-chapters/:user_id', async (req, res) => {
  const { user_id } = req.params;
  const { page = 1, limit = 20 } = req.query;
  
  const offset = (parseInt(page) - 1) * parseInt(limit);
  
  console.log('收藏章节分页参数:', { user_id, page, limit, offset });
  
  let connection;
  try {
    connection = await getConnection();
    
    // 先获取收藏的小说总数
    const [countResult] = await connection.execute(`
      SELECT COUNT(DISTINCT f.novel_id) as total
      FROM favorite f
      WHERE f.user_id = ? AND f.favorite_status = 1
    `, [user_id]);
    
    const total = countResult[0].total;
    const totalPages = Math.ceil(total / parseInt(limit));
    
    // 查询用户收藏的章节，按小说分组，包含小说封面
    const [favorites] = await connection.execute(`
      SELECT 
        f.novel_id,
        f.novel_name,
        f.chapter_id,
        f.chapter_name,
        f.favorite_status,
        f.created_at as favorited_at,
        f.updated_at,
        b.bookmark_closed,
        b.notification_off,
        n.title as novel_title,
        n.chapters,
        n.status as novel_status,
        CONCAT('http://localhost:5000', n.cover) as novel_cover,
        c.chapter_number,
        c.title as chapter_title
      FROM favorite f
      INNER JOIN novel n ON f.novel_id = n.id
      INNER JOIN chapter c ON f.chapter_id = c.id
      LEFT JOIN bookmark b ON f.user_id = b.user_id AND f.novel_id = b.novel_id
      WHERE f.user_id = ? AND f.favorite_status = 1
      ORDER BY f.updated_at DESC
    `, [user_id]);

    // 按小说分组
    const groupedFavorites = {};
    favorites.forEach(fav => {
      if (!groupedFavorites[fav.novel_id]) {
        groupedFavorites[fav.novel_id] = {
          novel_id: fav.novel_id,
          novel_name: fav.novel_name,
          novel_title: fav.novel_title,
          chapters: fav.chapters,
          novel_status: fav.novel_status,
          novel_cover: fav.novel_cover,
          bookmark_closed: fav.bookmark_closed || 0,
          notification_off: fav.notification_off || 0,
          favoriteChapters: []
        };
      }
      
      groupedFavorites[fav.novel_id].favoriteChapters.push({
        chapter_id: fav.chapter_id,
        chapter_name: fav.chapter_name,
        chapter_title: fav.chapter_title,
        chapter_number: fav.chapter_number,
        favorited_at: fav.favorited_at,
        updated_at: fav.updated_at
      });
    });

    // 转换为数组并按收藏时间排序
    const result = Object.values(groupedFavorites).sort((a, b) => {
      const aLatestChapter = a.favoriteChapters.sort((x, y) => new Date(y.favorited_at) - new Date(x.favorited_at))[0];
      const bLatestChapter = b.favoriteChapters.sort((x, y) => new Date(y.favorited_at) - new Date(x.favorited_at))[0];
      return new Date(bLatestChapter.favorited_at) - new Date(aLatestChapter.favorited_at);
    });
    
    // 应用分页
    const paginatedResult = result.slice(offset, offset + parseInt(limit));
    
    res.json({
      success: true,
      data: paginatedResult,
      pagination: {
        currentPage: parseInt(page),
        totalPages: totalPages,
        totalItems: total,
        itemsPerPage: parseInt(limit),
        hasNextPage: parseInt(page) < totalPages,
        hasPrevPage: parseInt(page) > 1
      }
    });
  } catch (error) {
    console.error('获取收藏章节列表失败:', error);
    res.json({ success: false, message: '获取收藏章节列表失败' });
  } finally {
    if (connection) await connection.end();
  }
});

// 切换书签锁定状态
router.post('/toggle-bookmark-lock', async (req, res) => {
  const { user_id, novel_id, status } = req.body;
  
  if (!user_id || !novel_id || status === undefined) {
    return res.json({ success: false, message: '缺少必要参数' });
  }

  let connection;
  try {
    connection = await getConnection();
    
    // 更新或创建bookmark记录
    await connection.execute(`
      INSERT INTO bookmark (user_id, novel_id, novel_name, bookmark_closed, updated_at)
      VALUES (?, ?, (SELECT title FROM novel WHERE id = ?), ?, NOW())
      ON DUPLICATE KEY UPDATE 
      bookmark_closed = VALUES(bookmark_closed),
      updated_at = NOW()
    `, [user_id, novel_id, novel_id, status]);

    res.json({ 
      success: true, 
      message: status === 1 ? '书签已锁定' : '书签已解锁',
      bookmark_closed: status
    });
  } catch (error) {
    console.error('切换书签锁定状态失败:', error);
    res.json({ success: false, message: '操作失败' });
  } finally {
    if (connection) await connection.end();
  }
});

// 切换通知状态
router.post('/toggle-notification', async (req, res) => {
  const { user_id, novel_id, status } = req.body;
  
  if (!user_id || !novel_id || status === undefined) {
    return res.json({ success: false, message: '缺少必要参数' });
  }

  let connection;
  try {
    connection = await getConnection();
    
    // 更新或创建bookmark记录
    await connection.execute(`
      INSERT INTO bookmark (user_id, novel_id, novel_name, notification_off, updated_at)
      VALUES (?, ?, (SELECT title FROM novel WHERE id = ?), ?, NOW())
      ON DUPLICATE KEY UPDATE 
      notification_off = VALUES(notification_off),
      updated_at = NOW()
    `, [user_id, novel_id, novel_id, status]);

    res.json({ 
      success: true, 
      message: status === 1 ? '通知已关闭' : '通知已开启',
      notification_off: status
    });
  } catch (error) {
    console.error('切换通知状态失败:', error);
    res.json({ success: false, message: '操作失败' });
  } finally {
    if (connection) await connection.end();
  }
});

// 移除小说书签
router.delete('/remove-novel/:user_id/:novel_id', async (req, res) => {
  const { user_id, novel_id } = req.params;
  
  let connection;
  try {
    connection = await getConnection();
    
    // 删除reading_log记录
    await connection.execute(
      'DELETE FROM reading_log WHERE user_id = ? AND novel_id = ?',
      [user_id, novel_id]
    );
    
    // 删除bookmark记录
    await connection.execute(
      'DELETE FROM bookmark WHERE user_id = ? AND novel_id = ?',
      [user_id, novel_id]
    );
    
    // 取消收藏该小说的所有章节
    await connection.execute(
      'UPDATE favorite SET favorite_status = 0 WHERE user_id = ? AND novel_id = ?',
      [user_id, novel_id]
    );

    res.json({ success: true, message: '小说已从书签中移除' });
  } catch (error) {
    console.error('移除小说书签失败:', error);
    res.json({ success: false, message: '移除失败' });
  } finally {
    if (connection) await connection.end();
  }
});

// 移除收藏章节
router.delete('/remove-favorite-chapter', async (req, res) => {
  const { user_id, novel_id, chapter_id } = req.body;
  
  if (!user_id || !novel_id || !chapter_id) {
    return res.json({ success: false, message: '缺少必要参数' });
  }

  let connection;
  try {
    connection = await getConnection();
    
    // 取消收藏特定章节，同时更新updated_at时间
    await connection.execute(
      'UPDATE favorite SET favorite_status = 0, updated_at = NOW() WHERE user_id = ? AND novel_id = ? AND chapter_id = ?',
      [user_id, novel_id, chapter_id]
    );

    res.json({ success: true, message: '章节已从收藏中移除' });
  } catch (error) {
    console.error('移除收藏章节失败:', error);
    res.json({ success: false, message: '移除失败' });
  } finally {
    if (connection) await connection.end();
  }
});

// 切换章节书签锁定状态
router.post('/toggle-chapter-bookmark-lock', async (req, res) => {
  const { chapter_id, status } = req.body;
  
  if (!chapter_id || status === undefined) {
    return res.json({ success: false, message: '缺少必要参数' });
  }

  let connection;
  try {
    connection = await getConnection();
    
    // 更新chapter表中的bookmark_locked字段
    await connection.execute(`
      UPDATE chapter 
      SET bookmark_locked = ?
      WHERE id = ?
    `, [status, chapter_id]);

    res.json({ 
      success: true, 
      message: status === 1 ? '章节书签已锁定' : '章节书签已解锁',
      bookmark_locked: status
    });
  } catch (error) {
    console.error('切换章节书签锁定状态失败:', error);
    res.json({ success: false, message: '操作失败' });
  } finally {
    if (connection) await connection.end();
  }
});

// 关闭小说书签（从Current Reads列表中移除）
router.post('/close-novel-bookmark', async (req, res) => {
  const { user_id, novel_id } = req.body;

  if (!user_id || !novel_id) {
    return res.json({ success: false, message: '缺少必要参数' });
  }

  let connection;
  try {
    connection = await getConnection();

    // 更新bookmark记录，设置bookmark_closed为1
    await connection.execute(`
      INSERT INTO bookmark (user_id, novel_id, novel_name, bookmark_closed, updated_at)
      VALUES (?, ?, (SELECT title FROM novel WHERE id = ?), 1, NOW())
      ON DUPLICATE KEY UPDATE 
      bookmark_closed = 1,
      updated_at = NOW()
    `, [user_id, novel_id, novel_id]);

    res.json({
      success: true,
      message: '小说书签已关闭',
      bookmark_closed: 1
    });
  } catch (error) {
    console.error('关闭小说书签失败:', error);
    res.json({ success: false, message: '操作失败' });
  } finally {
    if (connection) await connection.end();
  }
});

module.exports = router;
