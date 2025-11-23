// 心跳检测配置文件
module.exports = {
  // 心跳频率配置（毫秒）
  heartbeatInterval: 180000, // 180秒 = 3分钟
  
  // 批量处理配置
  batchSize: 100, // 批量处理大小
  batchInterval: 30000, // 30秒批量处理一次
  
  // 智能心跳配置
  minDuration: 30, // 最小停留时间（秒）
  maxDuration: 7200, // 最大停留时间（秒，2小时）
  
  // 页面可见性检测
  visibilityCheck: true, // 页面不可见时暂停心跳
  resumeOnVisible: true, // 页面重新可见时恢复心跳
  
  // 数据库优化配置
  dbOptimization: {
    enableIndexes: true, // 启用索引优化
    enablePartitioning: false, // 启用表分区（大数据量时）
    cleanupOldData: true, // 清理旧数据
    dataRetentionDays: 90 // 数据保留天数
  },
  
  // Redis缓存配置
  redis: {
    enabled: false, // 是否启用Redis缓存
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379,
    password: process.env.REDIS_PASSWORD || null,
    keyPrefix: 'heartbeat:',
    expireTime: 3600 // 缓存过期时间（秒）
  },
  
  // 性能监控配置
  monitoring: {
    enabled: true, // 启用性能监控
    logLevel: 'info', // 日志级别: debug, info, warn, error
    metricsInterval: 60000, // 指标收集间隔（毫秒）
    alertThreshold: {
      responseTime: 1000, // 响应时间阈值（毫秒）
      errorRate: 0.05, // 错误率阈值（5%）
      memoryUsage: 0.8 // 内存使用率阈值（80%）
    }
  },
  
  // 不同用户规模的推荐配置
  userScaleConfigs: {
    small: { // 100-1000用户
      heartbeatInterval: 180000, // 3分钟
      batchSize: 50,
      batchInterval: 30000
    },
    medium: { // 1000-10000用户
      heartbeatInterval: 300000, // 5分钟
      batchSize: 100,
      batchInterval: 60000
    },
    large: { // 10000-100000用户
      heartbeatInterval: 600000, // 10分钟
      batchSize: 200,
      batchInterval: 120000,
      redis: { enabled: true }
    },
    xlarge: { // 100000+用户
      heartbeatInterval: 900000, // 15分钟
      batchSize: 500,
      batchInterval: 300000,
      redis: { enabled: true },
      dbOptimization: { enablePartitioning: true }
    }
  },
  
  // 动态调整配置
  dynamicAdjustment: {
    enabled: true, // 启用动态调整
    loadThreshold: 0.7, // 负载阈值
    adjustmentFactor: 1.5, // 调整因子
    minInterval: 60000, // 最小心跳间隔（1分钟）
    maxInterval: 1800000 // 最大心跳间隔（30分钟）
  }
};
