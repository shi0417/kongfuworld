// 使用内置http模块测试API
const http = require('http');

function testAPI() {
  const options = {
    hostname: 'localhost',
    port: 5000,
    path: '/api/user/1/notifications?page=1&type=all&limit=10',
    method: 'GET'
  };

  const req = http.request(options, (res) => {
    console.log('状态码:', res.statusCode);
    console.log('响应头:', res.headers);

    let data = '';
    res.on('data', (chunk) => {
      data += chunk;
    });

    res.on('end', () => {
      console.log('响应数据:', data);
      try {
        const jsonData = JSON.parse(data);
        console.log('解析后的数据:', jsonData);
      } catch (e) {
        console.log('JSON解析失败:', e.message);
      }
    });
  });

  req.on('error', (e) => {
    console.error('请求失败:', e.message);
  });

  req.end();
}

testAPI();
