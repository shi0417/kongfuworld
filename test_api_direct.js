// 直接测试API分页功能
const http = require('http');

function testAPI(page, limit) {
  const options = {
    hostname: 'localhost',
    port: 5000,
    path: `/api/key-transaction/transactions?userId=1&page=${page}&limit=${limit}`,
    method: 'GET'
  };

  const req = http.request(options, (res) => {
    let data = '';
    
    res.on('data', (chunk) => {
      data += chunk;
    });
    
    res.on('end', () => {
      try {
        const result = JSON.parse(data);
        console.log(`\n=== 测试 page=${page}, limit=${limit} ===`);
        console.log(`返回记录数: ${result.data.transactions.length}`);
        console.log(`分页信息:`, result.data.pagination);
        
        if (result.data.transactions.length > 0) {
          console.log(`第一条记录ID: ${result.data.transactions[0].id}`);
          console.log(`最后一条记录ID: ${result.data.transactions[result.data.transactions.length - 1].id}`);
        }
      } catch (error) {
        console.error('解析响应失败:', error.message);
      }
    });
  });

  req.on('error', (error) => {
    console.error('请求失败:', error.message);
  });

  req.end();
}

console.log('🧪 测试API分页功能...');

// 测试第1页
testAPI(1, 10);

// 等待1秒后测试第2页
setTimeout(() => {
  testAPI(2, 10);
}, 1000);
