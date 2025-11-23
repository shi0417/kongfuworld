// 测试volume表插入修复
const mysql = require('mysql2');

// 数据库连接配置
const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: '123456',
  database: 'kongfuworld',
  charset: 'utf8mb4'
});

async function testVolumeInsert() {
  try {
    console.log('🧪 测试volume表插入修复...\n');
    
    // 1. 测试修复后的插入语句
    console.log('1. 测试修复后的插入语句:');
    const testSql = `
      INSERT INTO volume (novel_id, volume_id, title, volume_number)
      VALUES (?, ?, ?, ?)
    `;
    
    const testValues = [12, 2, '第二卷', 2];
    
    const result = await new Promise((resolve, reject) => {
      db.query(testSql, testValues, (err, result) => {
        if (err) reject(err);
        else resolve(result);
      });
    });
    
    console.log('✅ 插入成功，ID:', result.insertId);
    
    // 2. 验证插入的数据
    console.log('\n2. 验证插入的数据:');
    const checkSql = 'SELECT * FROM volume WHERE novel_id = 12 ORDER BY volume_id';
    
    const checkResult = await new Promise((resolve, reject) => {
      db.query(checkSql, (err, results) => {
        if (err) reject(err);
        else resolve(results);
      });
    });
    
    console.table(checkResult);
    
    // 3. 测试createVolume函数逻辑
    console.log('\n3. 测试createVolume函数逻辑:');
    const createVolume = async (novelId, volumeTitle, volumeNumber) => {
      const sql = `
        INSERT INTO volume (novel_id, volume_id, title, volume_number)
        VALUES (?, ?, ?, ?)
      `;
      
      const values = [novelId, volumeNumber, volumeTitle, volumeNumber];
      
      const result = await new Promise((resolve, reject) => {
        db.query(sql, values, (err, result) => {
          if (err) reject(err);
          else resolve(result);
        });
      });
      
      return result.insertId;
    };
    
    const volumeId = await createVolume(12, '第三卷', 3);
    console.log('✅ createVolume函数测试成功，ID:', volumeId);
    
    // 4. 最终验证
    console.log('\n4. 最终验证所有卷:');
    const finalCheck = await new Promise((resolve, reject) => {
      db.query('SELECT * FROM volume WHERE novel_id = 12 ORDER BY volume_id', (err, results) => {
        if (err) reject(err);
        else resolve(results);
      });
    });
    
    console.table(finalCheck);
    
    console.log('\n✅ volume表插入修复测试完成！');
    
  } catch (error) {
    console.error('❌ 测试失败:', error);
  } finally {
    db.end();
  }
}

// 开始测试
testVolumeInsert();
