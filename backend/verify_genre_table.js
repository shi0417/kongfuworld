const mysql = require('mysql2/promise');
require('dotenv').config({ path: require('path').join(__dirname, 'kongfuworld.env') });

(async () => {
  let connection;
  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'wuxiaworld'
    });

    console.log('✅ 已连接到数据库\n');

    // 检查表名
    console.log('📊 检查表名...');
    const [tables] = await connection.execute(
      `SELECT TABLE_NAME 
       FROM INFORMATION_SCHEMA.TABLES 
       WHERE TABLE_SCHEMA = ? 
       AND TABLE_NAME IN ('novel_genre', 'genre')`,
      [process.env.DB_NAME || 'wuxiaworld']
    );

    tables.forEach(t => {
      console.log(`   ${t.TABLE_NAME} - ${t.TABLE_NAME === 'genre' ? '✅ 新表名' : '❌ 旧表名'}`);
    });

    // 检查外键约束
    console.log('\n📊 检查外键约束...');
    const [fks] = await connection.execute(
      `SELECT CONSTRAINT_NAME, TABLE_NAME, COLUMN_NAME, REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME
       FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
       WHERE TABLE_SCHEMA = ?
       AND TABLE_NAME = 'novel_genre_relation'
       AND REFERENCED_TABLE_NAME IS NOT NULL`,
      [process.env.DB_NAME || 'wuxiaworld']
    );

    fks.forEach(fk => {
      console.log(`   ${fk.CONSTRAINT_NAME}: ${fk.TABLE_NAME}.${fk.COLUMN_NAME} -> ${fk.REFERENCED_TABLE_NAME}.${fk.REFERENCED_COLUMN_NAME}`);
      if (fk.REFERENCED_TABLE_NAME === 'genre') {
        console.log('      ✅ 外键引用正确');
      } else {
        console.log(`      ⚠️  外键引用可能不正确（期望: genre）`);
      }
    });

    // 查询示例数据
    const [samples] = await connection.execute('SELECT id, name, slug, chinese_name FROM genre LIMIT 3');
    if (samples.length > 0) {
      console.log('\n📋 示例数据:');
      samples.forEach(row => {
        console.log(`   ${row.name} (${row.slug}) - ${row.chinese_name}`);
      });
    }

    await connection.end();
    console.log('\n✅ 验证完成');
  } catch (error) {
    console.error('错误:', error.message);
    if (connection) await connection.end();
  }
})();

