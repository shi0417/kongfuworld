const express = require('express');
const router = express.Router();
const mysql = require('mysql2/promise');

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '123456',
  database: process.env.DB_NAME || 'kongfuworld'
};

async function getConnection() {
  return await mysql.createConnection(dbConfig);
}

// 创建或更新书签设置
router.post('/create-or-update', async (req, res) => {
  const { user_id, novel_id, novel_name, bookmark_closed, notification_off } = req.body;
  
  if (!user_id || !novel_id || !novel_name) {
    return res.json({ success: false, message: '缺少必要参数' });
  }

  let connection;
  try {
    connection = await getConnection();
    
    // 检查是否已存在记录
    const [existing] = await connection.execute(
      'SELECT id FROM bookmark WHERE user_id = ? AND novel_id = ?',
      [user_id, novel_id]
    );

    if (existing.length > 0) {
      // 更新现有记录
      await connection.execute(
        'UPDATE bookmark SET novel_name = ?, bookmark_closed = ?, notification_off = ?, updated_at = NOW() WHERE user_id = ? AND novel_id = ?',
        [novel_name, bookmark_closed || 0, notification_off || 0, user_id, novel_id]
      );
      
      res.json({ 
        success: true, 
        message: '书签设置更新成功',
        bookmark_id: existing[0].id
      });
    } else {
      // 创建新记录
      const [result] = await connection.execute(
        `INSERT INTO bookmark (user_id, novel_id, novel_name, bookmark_closed, notification_off) 
         VALUES (?, ?, ?, ?, ?)`,
        [user_id, novel_id, novel_name, bookmark_closed || 0, notification_off || 0]
      );
      
      res.json({ 
        success: true, 
        message: '书签设置创建成功',
        bookmark_id: result.insertId
      });
    }
  } catch (error) {
    console.error('创建或更新书签设置失败:', error);
    res.json({ success: false, message: '操作失败' });
  } finally {
    if (connection) await connection.end();
  }
});

// 获取用户的书签设置
router.get('/user/:user_id', async (req, res) => {
  const { user_id } = req.params;
  
  let connection;
  try {
    connection = await getConnection();
    
    const [bookmarks] = await connection.execute(
      `SELECT id, novel_id, novel_name, bookmark_closed, notification_off, created_at, updated_at 
       FROM bookmark 
       WHERE user_id = ? 
       ORDER BY updated_at DESC`,
      [user_id]
    );

    res.json({ success: true, data: bookmarks });
  } catch (error) {
    console.error('获取书签设置失败:', error);
    res.json({ success: false, message: '获取书签设置失败' });
  } finally {
    if (connection) await connection.end();
  }
});

// 获取特定小说的书签设置
router.get('/status/:user_id/:novel_id', async (req, res) => {
  const { user_id, novel_id } = req.params;
  
  let connection;
  try {
    connection = await getConnection();
    
    const [bookmark] = await connection.execute(
      `SELECT id, novel_id, novel_name, bookmark_closed, notification_off, created_at, updated_at 
       FROM bookmark 
       WHERE user_id = ? AND novel_id = ?`,
      [user_id, novel_id]
    );

    if (bookmark.length > 0) {
      res.json({ success: true, data: bookmark[0] });
    } else {
      res.json({ 
        success: true, 
        data: {
          novel_id: parseInt(novel_id),
          bookmark_closed: 0,
          notification_off: 0
        }
      });
    }
  } catch (error) {
    console.error('获取书签状态失败:', error);
    res.json({ success: false, message: '获取书签状态失败' });
  } finally {
    if (connection) await connection.end();
  }
});

// 切换书签关闭状态
router.post('/toggle-bookmark', async (req, res) => {
  const { user_id, novel_id, novel_name } = req.body;
  
  if (!user_id || !novel_id) {
    return res.json({ success: false, message: '缺少必要参数' });
  }

  let connection;
  try {
    connection = await getConnection();
    
    // 检查当前状态
    const [existing] = await connection.execute(
      'SELECT id, bookmark_closed FROM bookmark WHERE user_id = ? AND novel_id = ?',
      [user_id, novel_id]
    );

    if (existing.length > 0) {
      // 切换状态
      const newStatus = existing[0].bookmark_closed === 1 ? 0 : 1;
      await connection.execute(
        'UPDATE bookmark SET bookmark_closed = ?, updated_at = NOW() WHERE id = ?',
        [newStatus, existing[0].id]
      );
      
      res.json({ 
        success: true, 
        message: newStatus === 1 ? '书签已关闭' : '书签已开启',
        bookmark_closed: newStatus
      });
    } else {
      // 创建新记录，默认关闭书签
      await connection.execute(
        `INSERT INTO bookmark (user_id, novel_id, novel_name, bookmark_closed) 
         VALUES (?, ?, ?, 1)`,
        [user_id, novel_id, novel_name]
      );
      
      res.json({ 
        success: true, 
        message: '书签已关闭',
        bookmark_closed: 1
      });
    }
  } catch (error) {
    console.error('切换书签状态失败:', error);
    res.json({ success: false, message: '操作失败' });
  } finally {
    if (connection) await connection.end();
  }
});

// 切换通知关闭状态
router.post('/toggle-notification', async (req, res) => {
  const { user_id, novel_id, novel_name } = req.body;
  
  if (!user_id || !novel_id) {
    return res.json({ success: false, message: '缺少必要参数' });
  }

  let connection;
  try {
    connection = await getConnection();
    
    // 检查当前状态
    const [existing] = await connection.execute(
      'SELECT id, notification_off FROM bookmark WHERE user_id = ? AND novel_id = ?',
      [user_id, novel_id]
    );

    if (existing.length > 0) {
      // 切换状态
      const newStatus = existing[0].notification_off === 1 ? 0 : 1;
      await connection.execute(
        'UPDATE bookmark SET notification_off = ?, updated_at = NOW() WHERE id = ?',
        [newStatus, existing[0].id]
      );
      
      res.json({ 
        success: true, 
        message: newStatus === 1 ? '通知已关闭' : '通知已开启',
        notification_off: newStatus
      });
    } else {
      // 创建新记录，默认关闭通知
      await connection.execute(
        `INSERT INTO bookmark (user_id, novel_id, novel_name, notification_off) 
         VALUES (?, ?, ?, 1)`,
        [user_id, novel_id, novel_name]
      );
      
      res.json({ 
        success: true, 
        message: '通知已关闭',
        notification_off: 1
      });
    }
  } catch (error) {
    console.error('切换通知状态失败:', error);
    res.json({ success: false, message: '操作失败' });
  } finally {
    if (connection) await connection.end();
  }
});

// 删除书签设置
router.delete('/:user_id/:novel_id', async (req, res) => {
  const { user_id, novel_id } = req.params;
  
  let connection;
  try {
    connection = await getConnection();
    
    await connection.execute(
      'DELETE FROM bookmark WHERE user_id = ? AND novel_id = ?',
      [user_id, novel_id]
    );

    res.json({ success: true, message: '书签设置已删除' });
  } catch (error) {
    console.error('删除书签设置失败:', error);
    res.json({ success: false, message: '删除失败' });
  } finally {
    if (connection) await connection.end();
  }
});

module.exports = router;
