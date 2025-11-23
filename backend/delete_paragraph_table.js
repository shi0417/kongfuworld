const mysql = require('mysql2/promise');
require('dotenv').config({ path: require('path').join(__dirname, 'kongfuworld.env') });

async function deleteParagraphTable() {
  let connection;
  
  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'wuxiaworld'
    });

    console.log('✅ 已连接到数据库\n');

    // 1. 检查表是否存在
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

    // 2. 检查数据量
    const [countResult] = await connection.execute('SELECT COUNT(*) as count FROM paragraph');
    const recordCount = countResult[0].count;

    if (recordCount > 0) {
      console.log(`⚠️  警告: paragraph 表中有 ${recordCount} 条数据`);
      console.log('   删除操作已取消，请先确认是否需要保留这些数据');
      return;
    }

    // 3. 检查是否有其他表依赖
    const [foreignKeys] = await connection.execute(
      `SELECT CONSTRAINT_NAME, TABLE_NAME, COLUMN_NAME
       FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
       WHERE TABLE_SCHEMA = ? 
       AND REFERENCED_TABLE_NAME = 'paragraph'`,
      [process.env.DB_NAME || 'wuxiaworld']
    );

    if (foreignKeys.length > 0) {
      console.log('⚠️  警告: 有以下表依赖 paragraph 表:');
      foreignKeys.forEach(fk => {
        console.log(`  - ${fk.TABLE_NAME}.${fk.COLUMN_NAME}`);
      });
      console.log('   删除操作已取消，请先处理依赖关系');
      return;
    }

    console.log('📝 开始删除 paragraph 表...\n');

    // 4. 删除外键约束
    console.log('1. 删除外键约束...');
    try {
      await connection.execute('ALTER TABLE `paragraph` DROP FOREIGN KEY `paragraph_ibfk_1`');
      console.log('   ✅ 外键约束删除成功');
    } catch (error) {
      if (error.code === 'ER_CANT_DROP_FIELD_OR_KEY') {
        console.log('   ℹ️  外键约束可能不存在或已删除');
      } else {
        throw error;
      }
    }

    // 5. 删除表
    console.log('2. 删除表...');
    await connection.execute('DROP TABLE IF EXISTS `paragraph`');
    console.log('   ✅ 表删除成功');

    // 6. 验证删除
    const [verifyTables] = await connection.execute(
      `SELECT TABLE_NAME 
       FROM INFORMATION_SCHEMA.TABLES 
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'paragraph'`,
      [process.env.DB_NAME || 'wuxiaworld']
    );

    if (verifyTables.length === 0) {
      console.log('\n✅ 验证: paragraph 表已成功删除');
    } else {
      console.log('\n⚠️  警告: 表删除后仍然存在，请手动检查');
    }

    console.log('\n✅ 删除操作完成！');

  } catch (error) {
    console.error('❌ 错误:', error.message);
    if (error.code === 'ER_DROP_FK_BAD_PARENT_NAME') {
      console.error('   外键约束名称可能不正确，请检查');
    }
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n✅ 数据库连接已关闭');
    }
  }
}

deleteParagraphTable();

