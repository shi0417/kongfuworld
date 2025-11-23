// 阅读时间追踪API路由
const express = require('express');
const mysql = require('mysql2/promise');
const router = express.Router();

// 数据库配置
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '123456',
  database: process.env.DB_NAME || 'kongfuworld',
  charset: 'utf8mb4'
};

// 更新离开时间
router.post('/update-exit-time', async (req, res) => {
  let recordId, exitTime;
  
  console.log('🔍 请求头:', req.headers['content-type']);
  console.log('🔍 请求体:', req.body);
  
  // 处理不同的请求格式
  if (req.headers['content-type'] && req.headers['content-type'].includes('multipart/form-data')) {
    // sendBeacon 发送的 FormData 格式
    console.log('🔍 FormData 字段:', Object.keys(req.body));
    recordId = req.body.recordId ? parseInt(req.body.recordId) : null;
    exitTime = req.body.exitTime;
  } else if (req.headers['content-type'] === 'application/x-www-form-urlencoded') {
    // URL编码格式
    recordId = req.body.recordId ? parseInt(req.body.recordId) : null;
    exitTime = req.body.exitTime;
  } else {
    // JSON 格式
    recordId = req.body.recordId;
    exitTime = req.body.exitTime;
  }
  
  console.log('🔍 解析后参数:', { recordId, exitTime });
  
  if (!recordId || !exitTime) {
    console.log('❌ 参数验证失败:', { recordId, exitTime });
    return res.status(400).json({ 
      success: false, 
      message: '缺少必要参数: recordId, exitTime' 
    });
  }
  
  let db;
  try {
    db = await mysql.createConnection(dbConfig);
    
    console.log(`📖 更新离开时间: 记录ID${recordId}, 离开时间${exitTime}`);
    
    // 转换ISO字符串为MySQL兼容的datetime格式
    const formatDateTime = (isoString) => {
      if (!isoString) return null;
      // 将UTC时间转换为本地时间
      const date = new Date(isoString);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      const seconds = String(date.getSeconds()).padStart(2, '0');
      return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
    };
    
    const formattedExitTime = formatDateTime(exitTime);
    console.log(`🔄 格式化时间: 离开${formattedExitTime}`);
    
    // 根据记录ID直接更新离开时间
    const [updateResult] = await db.execute(`
      UPDATE reading_log 
      SET page_exit_time = ?
      WHERE id = ?
    `, [formattedExitTime, recordId]);
    
    if (updateResult.affectedRows > 0) {
      console.log(`✅ 更新离开时间成功: 记录ID ${recordId}`);
    } else {
      console.log(`❌ 未找到记录ID ${recordId}`);
      return res.status(404).json({ 
        success: false, 
        message: '未找到指定的阅读记录' 
      });
    }
    
    res.json({ 
      success: true, 
      message: '离开时间更新成功',
      data: {
        recordId,
        exitTime
      }
    });
    
  } catch (error) {
    console.error('更新离开时间失败:', error);
    res.status(500).json({ 
      success: false, 
      message: '更新离开时间失败: ' + error.message 
    });
  } finally {
    if (db) await db.end();
  }
});


// 获取用户阅读时间统计
router.get('/stats/:userId', async (req, res) => {
  const { userId } = req.params;
  const { days = 7 } = req.query; // 默认查询最近7天
  
  let db;
  try {
    db = await mysql.createConnection(dbConfig);
    
    // 查询用户的阅读时间统计
    const [stats] = await db.execute(`
      SELECT 
        DATE(read_at) as read_date,
        COUNT(*) as chapters_read,
        AVG(stay_duration) as avg_duration,
        SUM(stay_duration) as total_duration,
        MIN(page_enter_time) as first_read,
        MAX(page_exit_time) as last_read
      FROM reading_log 
      WHERE user_id = ? 
        AND read_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
        AND stay_duration IS NOT NULL
      GROUP BY DATE(read_at)
      ORDER BY read_date DESC
    `, [userId, days]);
    
    // 查询总体统计
    const [totalStats] = await db.execute(`
      SELECT 
        COUNT(*) as total_chapters,
        AVG(stay_duration) as avg_duration,
        SUM(stay_duration) as total_duration,
        MIN(page_enter_time) as first_read,
        MAX(page_exit_time) as last_read
      FROM reading_log 
      WHERE user_id = ? 
        AND read_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
        AND stay_duration IS NOT NULL
    `, [userId, days]);
    
    res.json({ 
      success: true, 
      data: {
        dailyStats: stats,
        totalStats: totalStats[0] || null,
        queryDays: parseInt(days)
      }
    });
    
  } catch (error) {
    console.error('获取阅读统计失败:', error);
    res.status(500).json({ 
      success: false, 
      message: '获取阅读统计失败: ' + error.message 
    });
  } finally {
    if (db) await db.end();
  }
});

module.exports = router;
