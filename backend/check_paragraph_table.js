const mysql = require('mysql2/promise');
require('dotenv').config({ path: require('path').join(__dirname, 'kongfuworld.env') });

async function checkParagraphTable() {
  let connection;
  
  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'wuxiaworld'
    });

    console.log('✅ 已连接到数据库\n');

    // 1. 检查 paragraph 表是否存在
    const [tables] = await connection.execute(
      `SELECT TABLE_NAME 
       FROM INFORMATION_SCHEMA.TABLES 
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'paragraph'`,
      [process.env.DB_NAME || 'wuxiaworld']
    );

    if (tables.length === 0) {
      console.log('ℹ️  paragraph 表不存在，无需删除');
      return;
    }

    console.log('📊 检查 paragraph 表...\n');

    // 2. 检查表中的数据量
    const [countResult] = await connection.execute('SELECT COUNT(*) as count FROM paragraph');
    const recordCount = countResult[0].count;
    console.log(`记录数: ${recordCount}`);

    if (recordCount > 0) {
      console.log('\n⚠️  表中存在数据，先查看前5条记录:');
      const [samples] = await connection.execute('SELECT * FROM paragraph LIMIT 5');
      samples.forEach((row, index) => {
        console.log(`  ${index + 1}. ID: ${row.id}, Chapter ID: ${row.chapter_id}, Paragraph Index: ${row.paragraph_index}, Content: ${row.content?.substring(0, 50) || ''}...`);
      });
    } else {
      console.log('✅ 表中没有数据');
    }

    // 3. 检查是否有外键依赖
    console.log('\n📋 检查外键依赖关系...');
    const [foreignKeys] = await connection.execute(
      `SELECT 
        CONSTRAINT_NAME, 
        TABLE_NAME, 
        COLUMN_NAME, 
        REFERENCED_TABLE_NAME, 
        REFERENCED_COLUMN_NAME
       FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
       WHERE TABLE_SCHEMA = ? 
       AND REFERENCED_TABLE_NAME = 'paragraph'`,
      [process.env.DB_NAME || 'wuxiaworld']
    );

    if (foreignKeys.length > 0) {
      console.log('⚠️  发现以下表依赖 paragraph 表:');
      foreignKeys.forEach(fk => {
        console.log(`  - ${fk.TABLE_NAME}.${fk.COLUMN_NAME} -> paragraph.${fk.REFERENCED_COLUMN_NAME} (约束: ${fk.CONSTRAINT_NAME})`);
      });
    } else {
      console.log('✅ 没有其他表依赖 paragraph 表');
    }

    // 4. 检查 paragraph 表的外键约束
    console.log('\n📋 检查 paragraph 表的外键约束...');
    const [paragraphFKs] = await connection.execute(
      `SELECT 
        CONSTRAINT_NAME, 
        TABLE_NAME, 
        COLUMN_NAME, 
        REFERENCED_TABLE_NAME, 
        REFERENCED_COLUMN_NAME
       FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
       WHERE TABLE_SCHEMA = ? 
       AND TABLE_NAME = 'paragraph'`,
      [process.env.DB_NAME || 'wuxiaworld']
    );

    if (paragraphFKs.length > 0) {
      console.log('paragraph 表的外键约束:');
      paragraphFKs.forEach(fk => {
        if (fk.REFERENCED_TABLE_NAME) {
          console.log(`  - ${fk.COLUMN_NAME} -> ${fk.REFERENCED_TABLE_NAME}.${fk.REFERENCED_COLUMN_NAME} (约束: ${fk.CONSTRAINT_NAME})`);
        }
      });
    }

    // 5. 检查代码中是否有使用（通过查询是否有引用）
    console.log('\n📝 总结:');
    console.log(`  - 表存在: ✅`);
    console.log(`  - 记录数: ${recordCount}`);
    console.log(`  - 依赖关系: ${foreignKeys.length > 0 ? '⚠️  有依赖' : '✅ 无依赖'}`);
    
    if (recordCount === 0 && foreignKeys.length === 0) {
      console.log('\n✅ 结论: paragraph 表未被使用，可以安全删除');
    } else if (recordCount > 0) {
      console.log('\n⚠️  警告: 表中有数据，删除前请确认是否需要保留');
    } else if (foreignKeys.length > 0) {
      console.log('\n⚠️  警告: 有其他表依赖此表，删除前需要先处理依赖关系');
    }

  } catch (error) {
    console.error('❌ 错误:', error.message);
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n✅ 数据库连接已关闭');
    }
  }
}

checkParagraphTable();

