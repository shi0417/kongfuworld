// 心跳频率性能分析
const mysql = require('mysql2/promise');

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '123456',
  database: process.env.DB_NAME || 'kongfuworld',
  charset: 'utf8mb4'
};

async function analyzeHeartbeatPerformance() {
  console.log('📊 心跳频率性能分析\n');
  
  // 不同用户规模下的性能对比
  const userScenarios = [
    { users: 100, name: '小规模' },
    { users: 1000, name: '中等规模' },
    { users: 10000, name: '大规模' },
    { users: 100000, name: '超大规模' }
  ];
  
  const heartbeatIntervals = [
    { interval: 30, name: '30秒' },
    { interval: 60, name: '60秒' },
    { interval: 180, name: '180秒（推荐）' },
    { interval: 300, name: '300秒' }
  ];
  
  console.log('🎯 不同心跳频率的性能对比:\n');
  
  userScenarios.forEach(scenario => {
    console.log(`👥 ${scenario.name} (${scenario.users}用户):`);
    console.log('┌─────────────┬─────────────┬─────────────┬─────────────┬─────────────┐');
    console.log('│ 心跳频率    │ 每分钟请求  │ 每小时请求  │ 每天请求    │ 服务器负担  │');
    console.log('├─────────────┼─────────────┼─────────────┼─────────────┼─────────────┤');
    
    heartbeatIntervals.forEach(heartbeat => {
      const requestsPerMinute = (scenario.users * 60) / heartbeat.interval;
      const requestsPerHour = requestsPerMinute * 60;
      const requestsPerDay = requestsPerHour * 24;
      
      let burdenLevel = '🟢 低';
      if (requestsPerMinute > 1000) burdenLevel = '🔴 高';
      else if (requestsPerMinute > 500) burdenLevel = '🟡 中';
      
      console.log(`│ ${heartbeat.name.padEnd(11)} │ ${Math.round(requestsPerMinute).toString().padEnd(11)} │ ${Math.round(requestsPerHour).toString().padEnd(11)} │ ${Math.round(requestsPerDay).toString().padEnd(11)} │ ${burdenLevel.padEnd(11)} │`);
    });
    
    console.log('└─────────────┴─────────────┴─────────────┴─────────────┴─────────────┘\n');
  });
  
  // 180秒心跳频率的优势分析
  console.log('✅ 180秒心跳频率的优势:\n');
  console.log('1. 📉 服务器负担减少83% (相比30秒)');
  console.log('2. 💾 数据库压力减少83%');
  console.log('3. 🌐 网络带宽使用减少83%');
  console.log('4. ⚡ 响应时间更稳定');
  console.log('5. 💰 服务器成本降低');
  
  console.log('\n📈 性能提升对比 (10,000用户):\n');
  console.log('┌─────────────┬─────────────┬─────────────┬─────────────┐');
  console.log('│ 心跳频率    │ 每天请求数  │ 数据库压力  │ 网络带宽    │');
  console.log('├─────────────┼─────────────┼─────────────┼─────────────┤');
  console.log('│ 30秒        │ 28,800,000  │ 🔴 极高      │ 🔴 极高      │');
  console.log('│ 60秒        │ 14,400,000  │ 🟡 高        │ 🟡 高        │');
  console.log('│ 180秒       │ 4,800,000   │ 🟢 中等      │ 🟢 中等      │');
  console.log('│ 300秒       │ 2,880,000   │ 🟢 低        │ 🟢 低        │');
  console.log('└─────────────┴─────────────┴─────────────┴─────────────┘\n');
  
  console.log('🎯 推荐配置:\n');
  console.log('• 心跳频率: 180秒 (3分钟)');
  console.log('• 最小停留时间: 30秒');
  console.log('• 批量处理间隔: 30秒');
  console.log('• 页面不可见时暂停心跳');
  console.log('• 用户离开时立即更新最终时间');
  
  console.log('\n💡 实施建议:\n');
  console.log('1. 立即调整心跳频率为180秒');
  console.log('2. 实施智能心跳检测（页面不可见时暂停）');
  console.log('3. 添加批量更新机制');
  console.log('4. 监控服务器性能指标');
  console.log('5. 根据实际负载动态调整');
}

analyzeHeartbeatPerformance();
