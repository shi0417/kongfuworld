// 测试新的通知API逻辑
const http = require('http');

function testAPI(type) {
  const options = {
    hostname: 'localhost',
    port: 5000,
    path: `/api/user/1/notifications?page=1&type=${type}&limit=10`,
    method: 'GET'
  };

  const req = http.request(options, (res) => {
    let data = '';
    
    res.on('data', (chunk) => {
      data += chunk;
    });
    
    res.on('end', () => {
      try {
        const response = JSON.parse(data);
        console.log(`\n=== 测试 ${type} 类型 ===`);
        console.log('响应状态:', response.success);
        if (response.success) {
          console.log('通知数量:', response.data.notifications.length);
          console.log('分页信息:', response.data.pagination);
          if (response.data.notifications.length > 0) {
            console.log('第一条通知:', {
              id: response.data.notifications[0].id,
              type: response.data.notifications[0].type,
              novel_title: response.data.notifications[0].novel_title,
              isTimeUnlock: response.data.notifications[0].isTimeUnlock
            });
          }
        } else {
          console.log('错误:', response.message);
        }
      } catch (e) {
        console.log('解析响应失败:', e.message);
        console.log('原始响应:', data);
      }
    });
  });

  req.on('error', (e) => {
    console.error(`请求失败: ${e.message}`);
  });

  req.end();
}

console.log('开始测试新的通知API...');
console.log('等待服务器启动...');

setTimeout(() => {
  testAPI('unlock');
  setTimeout(() => {
    testAPI('chapter_marketing');
  }, 1000);
}, 3000);
