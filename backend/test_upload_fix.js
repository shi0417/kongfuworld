const mysql = require('mysql2');
const { setDatabase, findSimilarNovels, getAllNovels } = require('./upload_novel');

// 创建数据库连接池
const db = mysql.createPool({
  host: 'localhost',
  user: 'root',
  password: '123456',
  database: 'kongfuworld',
  connectionLimit: 10,
  charset: 'utf8mb4'
});

// 设置数据库连接
setDatabase(db);

async function testDatabaseConnection() {
  try {
    console.log('测试数据库连接...');
    
    // 测试获取所有小说
    const novels = await getAllNovels();
    console.log('获取小说列表成功，共', novels.length, '个小说');
    
    // 测试查询相似小说
    const similarNovels = await findSimilarNovels('水浒');
    console.log('查询相似小说成功，共', similarNovels.length, '个相似小说');
    
    console.log('数据库连接测试通过！');
    
  } catch (error) {
    console.error('数据库连接测试失败:', error);
  } finally {
    // 关闭连接池
    db.end();
  }
}

testDatabaseConnection(); 