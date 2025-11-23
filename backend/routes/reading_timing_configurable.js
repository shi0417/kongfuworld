// 可配置的阅读时间追踪API
const express = require('express');
const router = express.Router();
const mysql = require('mysql2/promise');
const heartbeatConfig = require('../config/heartbeat_config');

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '123456',
  database: process.env.DB_NAME || 'kongfuworld',
  charset: 'utf8mb4'
};

// 动态配置管理
let currentConfig = { ...heartbeatConfig };

// 获取当前配置
router.get('/config', (req, res) => {
  res.json({
    success: true,
    data: {
      heartbeatInterval: currentConfig.heartbeatInterval,
      batchSize: currentConfig.batchSize,
      batchInterval: currentConfig.batchInterval,
      minDuration: currentConfig.minDuration,
      visibilityCheck: currentConfig.visibilityCheck
    }
  });
});

// 更新配置
router.post('/config', (req, res) => {
  const { heartbeatInterval, batchSize, batchInterval, minDuration } = req.body;
  
  if (heartbeatInterval && heartbeatInterval >= 60000) {
    currentConfig.heartbeatInterval = heartbeatInterval;
  }
  
  if (batchSize && batchSize > 0) {
    currentConfig.batchSize = batchSize;
  }
  
  if (batchInterval && batchInterval > 0) {
    currentConfig.batchInterval = batchInterval;
  }
  
  if (minDuration && minDuration > 0) {
    currentConfig.minDuration = minDuration;
  }
  
  console.log('🔧 心跳配置已更新:', currentConfig);
  
  res.json({
    success: true,
    message: '配置更新成功',
    data: currentConfig
  });
});

// 根据用户规模自动调整配置
router.post('/auto-adjust', async (req, res) => {
  try {
    const db = await mysql.createConnection(dbConfig);
    
    // 获取当前活跃用户数
    const [activeUsers] = await db.execute(`
      SELECT COUNT(DISTINCT user_id) as active_users
      FROM reading_log 
      WHERE read_at >= DATE_SUB(NOW(), INTERVAL 1 HOUR)
    `);
    
    const activeUserCount = activeUsers[0].active_users;
    let recommendedConfig;
    
    if (activeUserCount < 1000) {
      recommendedConfig = heartbeatConfig.userScaleConfigs.small;
    } else if (activeUserCount < 10000) {
      recommendedConfig = heartbeatConfig.userScaleConfigs.medium;
    } else if (activeUserCount < 100000) {
      recommendedConfig = heartbeatConfig.userScaleConfigs.large;
    } else {
      recommendedConfig = heartbeatConfig.userScaleConfigs.xlarge;
    }
    
    // 应用推荐配置
    currentConfig = { ...currentConfig, ...recommendedConfig };
    
    await db.end();
    
    res.json({
      success: true,
      message: `根据活跃用户数 ${activeUserCount} 自动调整配置`,
      data: {
        activeUsers: activeUserCount,
        recommendedConfig: currentConfig
      }
    });
    
  } catch (error) {
    console.error('自动调整配置失败:', error);
    res.status(500).json({
      success: false,
      message: '自动调整配置失败: ' + error.message
    });
  }
});

// 性能监控
router.get('/performance', async (req, res) => {
  try {
    const db = await mysql.createConnection(dbConfig);
    
    // 获取性能指标
    const [heartbeatStats] = await db.execute(`
      SELECT 
        COUNT(*) as total_heartbeats,
        AVG(stay_duration) as avg_duration,
        MAX(stay_duration) as max_duration,
        MIN(stay_duration) as min_duration
      FROM reading_log 
      WHERE read_at >= DATE_SUB(NOW(), INTERVAL 1 HOUR)
    `);
    
    const [userStats] = await db.execute(`
      SELECT 
        COUNT(DISTINCT user_id) as active_users,
        COUNT(DISTINCT chapter_id) as active_chapters
      FROM reading_log 
      WHERE read_at >= DATE_SUB(NOW(), INTERVAL 1 HOUR)
    `);
    
    await db.end();
    
    res.json({
      success: true,
      data: {
        currentConfig: {
          heartbeatInterval: currentConfig.heartbeatInterval,
          batchSize: currentConfig.batchSize,
          batchInterval: currentConfig.batchInterval
        },
        performance: {
          totalHeartbeats: heartbeatStats[0].total_heartbeats,
          avgDuration: Math.round(heartbeatStats[0].avg_duration || 0),
          maxDuration: heartbeatStats[0].max_duration || 0,
          minDuration: heartbeatStats[0].min_duration || 0,
          activeUsers: userStats[0].active_users,
          activeChapters: userStats[0].active_chapters
        },
        recommendations: {
          currentLoad: heartbeatStats[0].total_heartbeats > 1000 ? 'high' : 'normal',
          suggestedInterval: heartbeatStats[0].total_heartbeats > 1000 ? 300000 : 180000
        }
      }
    });
    
  } catch (error) {
    console.error('获取性能指标失败:', error);
    res.status(500).json({
      success: false,
      message: '获取性能指标失败: ' + error.message
    });
  }
});

module.exports = router;
