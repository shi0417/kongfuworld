const http = require('http');

// 测试回复点赞API
const testReplyLike = (replyId) => {
  const options = {
    hostname: 'localhost',
    port: 5000,
    path: `/api/comment/${replyId}/like`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer test-token' // 使用测试token
    }
  };

  console.log(`🔍 测试回复点赞API，回复ID: ${replyId}`);
  console.log(`URL: http://localhost:5000/api/comment/${replyId}/like`);

  const req = http.request(options, (res) => {
    console.log(`状态码: ${res.statusCode}`);
    console.log(`响应头: ${JSON.stringify(res.headers)}`);
    
    let data = '';
    res.on('data', (chunk) => {
      data += chunk;
    });
    
    res.on('end', () => {
      console.log('\n响应数据:');
      try {
        const jsonData = JSON.parse(data);
        console.log(JSON.stringify(jsonData, null, 2));
      } catch (error) {
        console.log('原始响应:', data);
      }
    });
  });

  req.on('error', (error) => {
    console.error('请求失败:', error);
  });

  req.end();
};

// 测试回复点踩API
const testReplyDislike = (replyId) => {
  const options = {
    hostname: 'localhost',
    port: 5000,
    path: `/api/comment/${replyId}/dislike`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer test-token' // 使用测试token
    }
  };

  console.log(`🔍 测试回复点踩API，回复ID: ${replyId}`);
  console.log(`URL: http://localhost:5000/api/comment/${replyId}/dislike`);

  const req = http.request(options, (res) => {
    console.log(`状态码: ${res.statusCode}`);
    console.log(`响应头: ${JSON.stringify(res.headers)}`);
    
    let data = '';
    res.on('data', (chunk) => {
      data += chunk;
    });
    
    res.on('end', () => {
      console.log('\n响应数据:');
      try {
        const jsonData = JSON.parse(data);
        console.log(JSON.stringify(jsonData, null, 2));
      } catch (error) {
        console.log('原始响应:', data);
      }
    });
  });

  req.on('error', (error) => {
    console.error('请求失败:', error);
  });

  req.end();
};

// 测试回复ID 15和16（从截图可以看出这些是回复）
console.log('🔧 测试回复点赞功能...\n');

console.log('📋 测试回复ID 15:');
testReplyLike(15);

setTimeout(() => {
  console.log('\n📋 测试回复ID 16:');
  testReplyDislike(16);
}, 2000);
