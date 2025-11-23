const mysql = require('mysql2/promise');
require('dotenv').config({ path: require('path').join(__dirname, 'kongfuworld.env') });

async function createLanguagesTable() {
  let connection;
  
  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'wuxiaworld'
    });

    console.log('✅ 已连接到数据库\n');

    // 1. 创建 languages 表
    console.log('📝 创建 languages 表...');
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS \`languages\` (
        \`id\` int NOT NULL AUTO_INCREMENT,
        \`language\` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '语言名称',
        \`created_at\` datetime DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`unique_language\` (\`language\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='语言表'
    `);
    console.log('   ✅ languages 表创建成功\n');

    // 2. 插入语言数据
    console.log('📝 插入语言数据...');
    const languages = ['Chinese', 'Korean', 'English'];
    
    for (const lang of languages) {
      try {
        await connection.execute(
          'INSERT INTO `languages` (`language`) VALUES (?) ON DUPLICATE KEY UPDATE `language` = VALUES(`language`)',
          [lang]
        );
        console.log(`   ✅ ${lang} 插入成功`);
      } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
          console.log(`   ℹ️  ${lang} 已存在，跳过`);
        } else {
          throw error;
        }
      }
    }

    // 3. 验证表结构
    console.log('\n📊 验证表结构:');
    const [columns] = await connection.execute(
      `SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT, COLUMN_COMMENT, ORDINAL_POSITION
       FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = ? 
       AND TABLE_NAME = 'languages'
       ORDER BY ORDINAL_POSITION`,
      [process.env.DB_NAME || 'wuxiaworld']
    );

    console.log('\n字段结构:');
    console.log('字段名\t\t\t类型\t\t可空\t默认值\t\t注释');
    console.log('─'.repeat(80));
    columns.forEach(col => {
      const maxLen = col.CHARACTER_MAXIMUM_LENGTH ? `(${col.CHARACTER_MAXIMUM_LENGTH})` : '';
      const type = `${col.DATA_TYPE}${maxLen}`.padEnd(15);
      const name = col.COLUMN_NAME.padEnd(20);
      const nullable = col.IS_NULLABLE.padEnd(5);
      const defaultValue = (col.COLUMN_DEFAULT || 'NULL').toString().padEnd(10);
      const comment = col.COLUMN_COMMENT || '';
      console.log(`${name}\t${type}\t${nullable}\t${defaultValue}\t${comment}`);
    });

    // 4. 验证索引
    const [indexes] = await connection.execute(
      `SELECT INDEX_NAME, GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX) as COLUMNS, NON_UNIQUE
       FROM INFORMATION_SCHEMA.STATISTICS 
       WHERE TABLE_SCHEMA = ? 
       AND TABLE_NAME = 'languages'
       GROUP BY INDEX_NAME, NON_UNIQUE
       ORDER BY INDEX_NAME`,
      [process.env.DB_NAME || 'wuxiaworld']
    );

    console.log('\n索引列表:');
    indexes.forEach(idx => {
      const type = idx.NON_UNIQUE === 0 ? '唯一索引' : '普通索引';
      console.log(`   ${idx.INDEX_NAME}: ${type} on (${idx.COLUMNS})`);
    });

    // 5. 查询插入的数据
    console.log('\n📋 查询插入的数据:');
    const [rows] = await connection.execute(
      'SELECT id, language, created_at FROM `languages` ORDER BY id'
    );

    if (rows.length > 0) {
      console.log('\n数据列表:');
      console.log('ID\t语言名称\t\t创建时间');
      console.log('─'.repeat(60));
      rows.forEach(row => {
        const date = row.created_at ? new Date(row.created_at).toLocaleString('zh-CN') : 'NULL';
        console.log(`${row.id}\t${row.language.padEnd(15)}\t${date}`);
      });
      console.log(`\n总计: ${rows.length} 条记录`);
    } else {
      console.log('   表中暂无数据');
    }

    console.log('\n✅ 所有操作完成！');

  } catch (error) {
    console.error('❌ 错误:', error.message);
    console.error(error);
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n✅ 数据库连接已关闭');
    }
  }
}

createLanguagesTable();

