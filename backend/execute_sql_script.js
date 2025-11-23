// 执行SQL脚本
const mysql = require('mysql2');
const fs = require('fs');
const path = require('path');

// 数据库连接配置
const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: '123456',
  database: 'kongfuworld',
  charset: 'utf8mb4',
  multipleStatements: true
});

async function executeSQLScript() {
  try {
    console.log('开始执行数据库更新脚本...');
    
    // 读取SQL文件
    const sqlPath = path.join(__dirname, 'update_database_homepage.sql');
    const sqlContent = fs.readFileSync(sqlPath, 'utf8');
    
    // 分割SQL语句（按分号分割，但要注意存储过程等特殊情况）
    const statements = sqlContent
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));
    
    console.log(`找到 ${statements.length} 条SQL语句`);
    
    // 逐条执行SQL语句
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (statement.trim()) {
        try {
          console.log(`执行第 ${i + 1} 条语句...`);
          await new Promise((resolve, reject) => {
            db.query(statement, (err, results) => {
              if (err) {
                console.error(`第 ${i + 1} 条语句执行失败:`, err.message);
                reject(err);
              } else {
                console.log(`第 ${i + 1} 条语句执行成功`);
                resolve(results);
              }
            });
          });
        } catch (error) {
          console.error(`跳过第 ${i + 1} 条语句:`, error.message);
          // 继续执行下一条语句
        }
      }
    }
    
    console.log('\n✅ 数据库更新脚本执行完成！');
    
    // 验证表是否创建成功
    console.log('\n验证表创建结果...');
    const tables = [
      'homepage_featured_novels',
      'homepage_banners', 
      'novel_statistics',
      'homepage_config',
      'genre',
      'novel_genre_relation'
    ];
    
    for (const table of tables) {
      try {
        const result = await new Promise((resolve, reject) => {
          db.query(`SHOW TABLES LIKE '${table}'`, (err, results) => {
            if (err) reject(err);
            else resolve(results);
          });
        });
        
        if (result.length > 0) {
          console.log(`✓ ${table} 表创建成功`);
        } else {
          console.log(`✗ ${table} 表创建失败`);
        }
      } catch (error) {
        console.log(`✗ 检查 ${table} 表时出错: ${error.message}`);
      }
    }
    
  } catch (error) {
    console.error('执行SQL脚本时出错:', error);
  } finally {
    db.end();
  }
}

// 开始执行
executeSQLScript();
