// 使用Redis缓存的阅读时间追踪API
const express = require('express');
const router = express.Router();
const mysql = require('mysql2/promise');
const Redis = require('redis');
require('dotenv').config({ path: '../kongfuworld.env' });

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '123456',
  database: process.env.DB_NAME || 'kongfuworld',
  charset: 'utf8mb4'
};

// Redis配置
const redisClient = Redis.createClient({
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379,
  password: process.env.REDIS_PASSWORD || null
});

redisClient.on('error', (err) => {
  console.error('Redis连接错误:', err);
});

// 连接Redis
redisClient.connect();

// 心跳数据缓存键
const getHeartbeatKey = (recordId) => `heartbeat:${recordId}`;
const getBatchKey = () => `heartbeat:batch:${Math.floor(Date.now() / 10000)}`; // 10秒批次

// 使用Redis缓存的心跳检测
router.post('/heartbeat-redis', async (req, res) => {
  const { recordId, currentDuration } = req.body;
  
  if (!recordId) {
    return res.status(400).json({ 
      success: false, 
      message: '缺少必要参数: recordId' 
    });
  }
  
  try {
    const heartbeatKey = getHeartbeatKey(recordId);
    const batchKey = getBatchKey();
    
    // 将心跳数据存入Redis
    await redisClient.hSet(heartbeatKey, {
      duration: currentDuration,
      timestamp: Date.now(),
      recordId: recordId
    });
    
    // 设置过期时间（1小时）
    await redisClient.expire(heartbeatKey, 3600);
    
    // 添加到批次队列
    await redisClient.sAdd(batchKey, recordId);
    await redisClient.expire(batchKey, 3600);
    
    res.json({ 
      success: true, 
      message: '心跳已缓存到Redis',
      data: { recordId, currentDuration }
    });
    
  } catch (error) {
    console.error('Redis心跳缓存失败:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Redis心跳缓存失败: ' + error.message 
    });
  }
});

// 批量处理Redis中的心跳数据
async function processRedisHeartbeats() {
  try {
    // 获取所有批次键
    const batchKeys = await redisClient.keys('heartbeat:batch:*');
    
    for (const batchKey of batchKeys) {
      const recordIds = await redisClient.sMembers(batchKey);
      
      if (recordIds.length === 0) continue;
      
      // 批量获取心跳数据
      const heartbeatData = [];
      for (const recordId of recordIds) {
        const heartbeatKey = getHeartbeatKey(recordId);
        const data = await redisClient.hGetAll(heartbeatKey);
        
        if (data.duration) {
          heartbeatData.push({
            recordId: parseInt(recordId),
            duration: parseInt(data.duration),
            timestamp: parseInt(data.timestamp)
          });
        }
      }
      
      if (heartbeatData.length > 0) {
        // 批量更新数据库
        await batchUpdateToDatabase(heartbeatData);
        
        // 清理Redis数据
        await redisClient.del(batchKey);
        for (const recordId of recordIds) {
          await redisClient.del(getHeartbeatKey(recordId));
        }
      }
    }
  } catch (error) {
    console.error('处理Redis心跳数据失败:', error);
  }
}

// 批量更新到数据库
async function batchUpdateToDatabase(heartbeatData) {
  let db;
  try {
    db = await mysql.createConnection(dbConfig);
    
    // 构建批量更新SQL
    const updates = heartbeatData.map(data => 
      `(${data.recordId}, ${data.duration}, NOW())`
    ).join(', ');
    
    await db.execute(`
      INSERT INTO reading_log (id, stay_duration, read_at) 
      VALUES ${updates}
      ON DUPLICATE KEY UPDATE 
        stay_duration = VALUES(stay_duration),
        read_at = VALUES(read_at)
    `);
    
    console.log(`📊 Redis批量更新: ${heartbeatData.length} 条记录`);
    
  } catch (error) {
    console.error('批量更新数据库失败:', error);
  } finally {
    if (db) await db.end();
  }
}

// 定时处理Redis数据（每60秒）
setInterval(processRedisHeartbeats, 60000);

// 获取Redis缓存状态
router.get('/redis-status', async (req, res) => {
  try {
    const heartbeatKeys = await redisClient.keys('heartbeat:*');
    const batchKeys = await redisClient.keys('heartbeat:batch:*');
    
    res.json({
      success: true,
      data: {
        totalHeartbeats: heartbeatKeys.length,
        totalBatches: batchKeys.length,
        memoryUsage: await redisClient.memoryUsage()
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '获取Redis状态失败: ' + error.message
    });
  }
});

module.exports = router;
