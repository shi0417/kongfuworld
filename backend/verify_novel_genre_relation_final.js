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

    // 查询表结构
    const [columns] = await connection.execute(
      `SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT, COLUMN_COMMENT, ORDINAL_POSITION
       FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = ? 
       AND TABLE_NAME = 'novel_genre_relation'
       ORDER BY ORDINAL_POSITION`,
      [process.env.DB_NAME || 'wuxiaworld']
    );

    console.log('📊 novel_genre_relation 表结构:');
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

    // 检查索引
    const [indexes] = await connection.execute(
      `SELECT INDEX_NAME, GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX) as COLUMNS, NON_UNIQUE
       FROM INFORMATION_SCHEMA.STATISTICS 
       WHERE TABLE_SCHEMA = ? 
       AND TABLE_NAME = 'novel_genre_relation'
       GROUP BY INDEX_NAME, NON_UNIQUE
       ORDER BY INDEX_NAME`,
      [process.env.DB_NAME || 'wuxiaworld']
    );

    console.log('\n📋 索引列表:');
    indexes.forEach(idx => {
      const type = idx.NON_UNIQUE === 0 ? '唯一索引' : '普通索引';
      console.log(`   ${idx.INDEX_NAME}: ${type} on (${idx.COLUMNS})`);
    });

    // 检查外键约束
    const [fks] = await connection.execute(
      `SELECT CONSTRAINT_NAME, COLUMN_NAME, REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME
       FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
       WHERE TABLE_SCHEMA = ?
       AND TABLE_NAME = 'novel_genre_relation'
       AND REFERENCED_TABLE_NAME IS NOT NULL`,
      [process.env.DB_NAME || 'wuxiaworld']
    );

    console.log('\n🔗 外键约束:');
    fks.forEach(fk => {
      console.log(`   ${fk.CONSTRAINT_NAME}: ${fk.COLUMN_NAME} -> ${fk.REFERENCED_TABLE_NAME}.${fk.REFERENCED_COLUMN_NAME}`);
    });

    // 验证唯一索引 (id, novel_id)
    const uniqueIndex = indexes.find(idx => idx.INDEX_NAME === 'unique_id_novel' && idx.NON_UNIQUE === 0);
    if (uniqueIndex) {
      const cols = uniqueIndex.COLUMNS.split(',').sort().join(',');
      if (cols === 'id,novel_id' || cols === 'novel_id,id') {
        console.log('\n✅ 唯一索引 (id, novel_id) 已正确创建');
      } else {
        console.log(`\n⚠️  唯一索引字段不正确: ${cols}`);
      }
    } else {
      console.log('\n❌ 未找到唯一索引 unique_id_novel');
    }

    await connection.end();
    console.log('\n✅ 验证完成');
  } catch (error) {
    console.error('错误:', error.message);
    if (connection) await connection.end();
  }
})();

