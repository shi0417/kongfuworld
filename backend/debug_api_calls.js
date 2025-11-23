// 调试API调用
const express = require('express');
const app = express();

// 添加请求日志中间件
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  console.log('Headers:', req.headers);
  next();
});

// 模拟章节解锁状态API
app.get('/api/chapter-unlock/status/:chapterId/:userId', (req, res) => {
  const { chapterId, userId } = req.params;
  console.log(`\n🔍 API调用: 章节${chapterId}, 用户${userId}`);
  
  // 模拟返回已解锁状态
  const response = {
    success: true,
    data: {
      chapterId: chapterId,
      novelTitle: "一号大秘",
      chapterNumber: 14,
      isPremium: 1,
      keyCost: 1,
      isUnlocked: true,  // 明确返回已解锁
      unlockMethod: "time_unlock",
      userKeyBalance: 62,
      canUnlockWithKey: true,
      hasChampionSubscription: false
    }
  };
  
  console.log('返回响应:', JSON.stringify(response, null, 2));
  res.json(response);
});

const PORT = 5001;
app.listen(PORT, () => {
  console.log(`调试服务器运行在 http://localhost:${PORT}`);
  console.log('测试URL: http://localhost:5001/api/chapter-unlock/status/1358/1');
});
