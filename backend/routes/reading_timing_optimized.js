// 优化版阅读时间追踪API
const express = require('express');
const router = express.Router();
const mysql = require('mysql2/promise');
require('dotenv').config({ path: '../kongfuworld.env' });

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '123456',
  database: process.env.DB_NAME || 'kongfuworld',
  charset: 'utf8mb4'
};

// 内存缓存，用于批量更新
const heartbeatCache = new Map();
const BATCH_SIZE = 100; // 批量处理大小
const BATCH_INTERVAL = 30000; // 30秒批量处理一次

// 批量更新心跳数据
async function batchUpdateHeartbeats() {
  if (heartbeatCache.size === 0) return;
  
  let db;
  try {
    db = await mysql.createConnection(dbConfig);
    
    const updates = [];
    for (const [recordId, data] of heartbeatCache.entries()) {
      updates.push(`(${recordId}, ${data.duration}, NOW())`);
    }
    
    // 批量更新
    await db.execute(`
      INSERT INTO reading_log (id, stay_duration, read_at) 
      VALUES ${updates.join(', ')}
      ON DUPLICATE KEY UPDATE 
        stay_duration = VALUES(stay_duration),
        read_at = VALUES(read_at)
    `);
    
    console.log(`📊 批量更新心跳数据: ${updates.length} 条记录`);
    heartbeatCache.clear();
    
  } catch (error) {
    console.error('批量更新心跳失败:', error);
  } finally {
    if (db) await db.end();
  }
}

// 定时批量更新
setInterval(batchUpdateHeartbeats, BATCH_INTERVAL);

// 优化版心跳检测API
router.post('/heartbeat-optimized', async (req, res) => {
  const { recordId, currentDuration } = req.body;
  
  if (!recordId) {
    return res.status(400).json({ 
      success: false, 
      message: '缺少必要参数: recordId' 
    });
  }
  
  try {
    // 将数据存入缓存，不立即更新数据库
    heartbeatCache.set(recordId, {
      duration: currentDuration,
      timestamp: Date.now()
    });
    
    res.json({ 
      success: true, 
      message: '心跳已缓存，将批量更新',
      data: { recordId, currentDuration }
    });
    
  } catch (error) {
    console.error('心跳缓存失败:', error);
    res.status(500).json({ 
      success: false, 
      message: '心跳缓存失败: ' + error.message 
    });
  }
});

// 获取缓存状态（用于监控）
router.get('/heartbeat-status', (req, res) => {
  res.json({
    success: true,
    data: {
      cacheSize: heartbeatCache.size,
      batchSize: BATCH_SIZE,
      batchInterval: BATCH_INTERVAL
    }
  });
});

module.exports = router;
