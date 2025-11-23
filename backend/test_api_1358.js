// 测试章节1358的API
const http = require('http');

function testAPI() {
  console.log('\n🔧 测试章节1358的API\n');
  
  const options = {
    hostname: 'localhost',
    port: 5000,
    path: '/api/chapter-unlock/status/1358/1',
    method: 'GET'
  };
  
  const req = http.request(options, (res) => {
    console.log(`状态码: ${res.statusCode}`);
    console.log(`响应头: ${JSON.stringify(res.headers)}`);
    
    let data = '';
    res.on('data', (chunk) => {
      data += chunk;
    });
    
    res.on('end', () => {
      console.log('响应数据:', data);
      
      try {
        const response = JSON.parse(data);
        console.log('\n📊 API响应解析:');
        console.log(`   success: ${response.success}`);
        if (response.data) {
          console.log(`   chapterId: ${response.data.chapterId}`);
          console.log(`   novelTitle: ${response.data.novelTitle}`);
          console.log(`   chapterNumber: ${response.data.chapterNumber}`);
          console.log(`   isPremium: ${response.data.isPremium}`);
          console.log(`   keyCost: ${response.data.keyCost}`);
          console.log(`   isUnlocked: ${response.data.isUnlocked}`);
          console.log(`   unlockMethod: ${response.data.unlockMethod}`);
          console.log(`   userKeyBalance: ${response.data.userKeyBalance}`);
          console.log(`   canUnlockWithKey: ${response.data.canUnlockWithKey}`);
          console.log(`   hasChampionSubscription: ${response.data.hasChampionSubscription}`);
        }
      } catch (error) {
        console.log('JSON解析失败:', error.message);
      }
    });
  });
  
  req.on('error', (e) => {
    console.error(`请求错误: ${e.message}`);
  });
  
  req.end();
}

testAPI();
