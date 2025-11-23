const express = require('express');
const router = express.Router();
const mysql = require('mysql2/promise');

// 数据库配置
const dbConfig = {
  host: 'localhost',
  user: 'root',
  password: '123456',
  database: 'kongfuworld'
};

// 获取数据库连接
async function getConnection() {
  return await mysql.createConnection(dbConfig);
}

// 添加收藏
router.post('/add', async (req, res) => {
  const { user_id, novel_id, novel_name, chapter_id, chapter_name } = req.body;
  
  if (!user_id || !novel_id) {
    return res.json({ success: false, message: '缺少必要参数' });
  }

  let connection;
  try {
    connection = await getConnection();
    
    // 检查是否已经收藏
    const [existing] = await connection.execute(
      'SELECT id FROM favorite WHERE user_id = ? AND novel_id = ? AND chapter_id = ?',
      [user_id, novel_id, chapter_id]
    );

    if (existing.length > 0) {
      // 如果已存在，更新状态为1
      await connection.execute(
        'UPDATE favorite SET favorite_status = 1, novel_name = ?, chapter_name = ?, updated_at = NOW() WHERE user_id = ? AND novel_id = ? AND chapter_id = ?',
        [novel_name, chapter_name, user_id, novel_id, chapter_id]
      );
    } else {
      // 如果不存在，插入新记录
      await connection.execute(
        `INSERT INTO favorite (user_id, novel_id, novel_name, chapter_id, chapter_name, favorite_status, updated_at) 
         VALUES (?, ?, ?, ?, ?, 1, NOW())`,
        [user_id, novel_id, novel_name, chapter_id, chapter_name]
      );
    }

    res.json({ success: true, message: '收藏成功' });
  } catch (error) {
    console.error('添加收藏失败:', error);
    res.json({ success: false, message: '收藏失败' });
  } finally {
    if (connection) await connection.end();
  }
});

// 取消收藏
router.post('/remove', async (req, res) => {
  const { user_id, novel_id, chapter_id } = req.body;
  
  if (!user_id || !novel_id) {
    return res.json({ success: false, message: '缺少必要参数' });
  }

  let connection;
  try {
    connection = await getConnection();
    
    // 更新favorite_status为0
    await connection.execute(
      'UPDATE favorite SET favorite_status = 0, updated_at = NOW() WHERE user_id = ? AND novel_id = ? AND chapter_id = ?',
      [user_id, novel_id, chapter_id]
    );

    res.json({ success: true, message: '取消收藏成功' });
  } catch (error) {
    console.error('取消收藏失败:', error);
    res.json({ success: false, message: '取消收藏失败' });
  } finally {
    if (connection) await connection.end();
  }
});

// 切换收藏状态
router.post('/toggle', async (req, res) => {
  const { user_id, novel_id, novel_name, chapter_id, chapter_name } = req.body;
  
  if (!user_id || !novel_id) {
    return res.json({ success: false, message: '缺少必要参数' });
  }

  let connection;
  try {
    connection = await getConnection();
    
    // 检查当前状态
    const [existing] = await connection.execute(
      'SELECT id, favorite_status FROM favorite WHERE user_id = ? AND novel_id = ? AND chapter_id = ?',
      [user_id, novel_id, chapter_id]
    );

    if (existing.length > 0) {
      // 切换状态
      const newStatus = existing[0].favorite_status === 1 ? 0 : 1;
      await connection.execute(
        'UPDATE favorite SET favorite_status = ?, novel_name = ?, chapter_name = ?, updated_at = NOW() WHERE id = ?',
        [newStatus, novel_name, chapter_name, existing[0].id]
      );
      
      res.json({ 
        success: true, 
        message: newStatus === 1 ? '收藏成功' : '取消收藏成功',
        is_favorite: newStatus === 1
      });
    } else {
      // 创建新记录
      await connection.execute(
        `INSERT INTO favorite (user_id, novel_id, novel_name, chapter_id, chapter_name, favorite_status, updated_at) 
         VALUES (?, ?, ?, ?, ?, 1, NOW())`,
        [user_id, novel_id, novel_name, chapter_id, chapter_name]
      );
      
      res.json({ 
        success: true, 
        message: '收藏成功',
        is_favorite: true
      });
    }
  } catch (error) {
    console.error('切换收藏状态失败:', error);
    res.json({ success: false, message: '操作失败' });
  } finally {
    if (connection) await connection.end();
  }
});

// 获取用户收藏列表
router.get('/list/:user_id', async (req, res) => {
  const { user_id } = req.params;
  
  let connection;
  try {
    connection = await getConnection();
    
    const [favorites] = await connection.execute(
      `SELECT novel_id, novel_name, chapter_id, chapter_name, favorite_status, created_at, updated_at 
       FROM favorite 
       WHERE user_id = ? AND favorite_status = 1 
       ORDER BY updated_at DESC`,
      [user_id]
    );

    res.json({ success: true, data: favorites });
  } catch (error) {
    console.error('获取收藏列表失败:', error);
    res.json({ success: false, message: '获取收藏列表失败' });
  } finally {
    if (connection) await connection.end();
  }
});

// 检查收藏状态
router.post('/check', async (req, res) => {
  const { user_id, novel_id, chapter_id } = req.body;
  
  if (!user_id || !novel_id) {
    return res.json({ success: false, message: '缺少必要参数' });
  }

  let connection;
  try {
    connection = await getConnection();
    
    const [result] = await connection.execute(
      'SELECT favorite_status FROM favorite WHERE user_id = ? AND novel_id = ? AND chapter_id = ?',
      [user_id, novel_id, chapter_id]
    );

    const is_favorite = result.length > 0 && result[0].favorite_status === 1;
    
    res.json({ 
      success: true, 
      is_favorite: is_favorite 
    });
  } catch (error) {
    console.error('检查收藏状态失败:', error);
    res.json({ success: false, message: '检查收藏状态失败' });
  } finally {
    if (connection) await connection.end();
  }
});

// 获取收藏统计
router.get('/stats/:user_id', async (req, res) => {
  const { user_id } = req.params;
  
  let connection;
  try {
    connection = await getConnection();
    
    // 获取总收藏数
    const [totalResult] = await connection.execute(
      'SELECT COUNT(*) as total FROM favorite WHERE user_id = ? AND favorite_status = 1',
      [user_id]
    );

    // 获取按小说分组的收藏数
    const [novelStats] = await connection.execute(
      `SELECT novel_id, novel_name, COUNT(*) as chapter_count 
       FROM favorite 
       WHERE user_id = ? AND favorite_status = 1 
       GROUP BY novel_id, novel_name 
       ORDER BY chapter_count DESC`,
      [user_id]
    );

    res.json({ 
      success: true, 
      data: {
        total_favorites: totalResult[0].total,
        novel_stats: novelStats
      }
    });
  } catch (error) {
    console.error('获取收藏统计失败:', error);
    res.json({ success: false, message: '获取收藏统计失败' });
  } finally {
    if (connection) await connection.end();
  }
});

module.exports = router;
