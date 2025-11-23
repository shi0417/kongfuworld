const mysql = require('mysql2/promise');
require('dotenv').config({ path: require('path').join(__dirname, 'kongfuworld.env') });

async function insertOtherGenre() {
  let connection;
  
  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'wuxiaworld'
    });

    console.log('✅ 已连接到数据库\n');

    // 检查是否已存在
    const [existing] = await connection.execute(
      'SELECT id, name, chinese_name FROM genre WHERE name = ? OR slug = ?',
      ['other', 'other']
    );

    if (existing.length > 0) {
      console.log('⚠️  类型 "other" 已存在:');
      existing.forEach(row => {
        console.log(`  ID: ${row.id}, Name: ${row.name}, Chinese Name: ${row.chinese_name}`);
      });
      console.log('\n✅ 无需重复插入');
      return;
    }

    // 插入新数据
    console.log('📝 插入新类型...');
    const [result] = await connection.execute(
      'INSERT INTO genre (name, slug, chinese_name, is_active) VALUES (?, ?, ?, 1)',
      ['other', 'other', '其他小说']
    );

    console.log(`✅ 插入成功！`);
    console.log(`   新记录 ID: ${result.insertId}`);
    console.log(`   Name: other`);
    console.log(`   Slug: other`);
    console.log(`   Chinese Name: 其他小说`);

    // 验证插入结果
    const [verify] = await connection.execute(
      'SELECT id, name, slug, chinese_name, is_active FROM genre WHERE id = ?',
      [result.insertId]
    );

    if (verify.length > 0) {
      const row = verify[0];
      console.log(`\n📊 验证结果:`);
      console.log(`   ID: ${row.id}`);
      console.log(`   Name: ${row.name}`);
      console.log(`   Slug: ${row.slug}`);
      console.log(`   Chinese Name: ${row.chinese_name}`);
      console.log(`   Is Active: ${row.is_active ? '是' : '否'}`);
    }

  } catch (error) {
    console.error('❌ 错误:', error.message);
    if (error.code === 'ER_DUP_ENTRY') {
      console.error('   错误：名称或 slug 已存在');
    }
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n✅ 数据库连接已关闭');
    }
  }
}

insertOtherGenre();

