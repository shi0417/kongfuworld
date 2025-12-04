const http = require('http');

const chapterId = process.argv[2] || 860;

const options = {
  hostname: 'localhost',
  port: 5000,
  path: `/api/chapter/${chapterId}`,
  method: 'GET'
};

const req = http.request(options, (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    try {
      const json = JSON.parse(data);
      console.log('=== API 响应 ===');
      console.log('章节ID:', json.data.id);
      console.log('章节号:', json.data.chapter_number);
      console.log('has_prev:', json.data.has_prev, '| 类型:', typeof json.data.has_prev);
      console.log('has_next:', json.data.has_next, '| 类型:', typeof json.data.has_next);
      console.log('prev_chapter_id:', json.data.prev_chapter_id, '| 类型:', typeof json.data.prev_chapter_id);
      console.log('next_chapter_id:', json.data.next_chapter_id, '| 类型:', typeof json.data.next_chapter_id);
      console.log('prev_chapter_id === null:', json.data.prev_chapter_id === null);
      console.log('next_chapter_id === null:', json.data.next_chapter_id === null);
    } catch (error) {
      console.error('解析 JSON 失败:', error);
      console.log('原始响应:', data);
    }
  });
});

req.on('error', (error) => {
  console.error('请求失败:', error);
});

req.end();

