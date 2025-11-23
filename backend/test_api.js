// 测试API端点
const http = require('http');

function testAPI(endpoint) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 5000,
      path: endpoint,
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const jsonData = JSON.parse(data);
          resolve({ status: res.statusCode, data: jsonData });
        } catch (error) {
          resolve({ status: res.statusCode, data: data });
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.setTimeout(5000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    req.end();
  });
}

async function runTests() {
  console.log('开始测试API端点...\n');
  
  const endpoints = [
    '/api/homepage/config',
    '/api/homepage/banners',
    '/api/homepage/popular-this-week',
    '/api/homepage/new-releases',
    '/api/homepage/top-series',
    '/api/homepage/all'
  ];
  
  for (const endpoint of endpoints) {
    try {
      console.log(`测试 ${endpoint}...`);
      const result = await testAPI(endpoint);
      console.log(`✓ 状态码: ${result.status}`);
      if (typeof result.data === 'object') {
        console.log(`✓ 返回数据: ${JSON.stringify(result.data).substring(0, 100)}...`);
      } else {
        console.log(`✓ 返回数据: ${result.data.substring(0, 100)}...`);
      }
    } catch (error) {
      console.log(`✗ 错误: ${error.message}`);
    }
    console.log('');
  }
}

runTests();
