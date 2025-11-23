const mysql = require('mysql2/promise');
require('dotenv').config({ path: require('path').join(__dirname, 'kongfuworld.env') });

async function renameNovelGenreToGenre() {
  let connection;
  
  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'wuxiaworld'
    });

    console.log('✅ 已连接到数据库\n');

    // 1. 检查 novel_genre 表是否存在
    const [novelGenreTable] = await connection.execute(
      `SELECT TABLE_NAME 
       FROM INFORMATION_SCHEMA.TABLES 
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'novel_genre'`,
      [process.env.DB_NAME || 'wuxiaworld']
    );

    if (novelGenreTable.length === 0) {
      // 检查是否已经是 genre
      const [genreTable] = await connection.execute(
        `SELECT TABLE_NAME 
         FROM INFORMATION_SCHEMA.TABLES 
         WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'genre'`,
        [process.env.DB_NAME || 'wuxiaworld']
      );

      if (genreTable.length > 0) {
        console.log('ℹ️  表已经是 genre，无需重命名');
        return;
      } else {
        console.log('❌ novel_genre 表不存在');
        return;
      }
    }

    // 2. 检查 genre 表是否已存在
    const [genreExists] = await connection.execute(
      `SELECT TABLE_NAME 
       FROM INFORMATION_SCHEMA.TABLES 
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'genre'`,
      [process.env.DB_NAME || 'wuxiaworld']
    );

    if (genreExists.length > 0) {
      console.log('⚠️  警告: genre 表已存在，无法重命名');
      return;
    }

    console.log('📝 开始重命名表...\n');

    // 3. 查找并删除 novel_genre_relation 表中的外键约束
    console.log('1. 查找外键约束...');
    const [foreignKeys] = await connection.execute(
      `SELECT CONSTRAINT_NAME
       FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
       WHERE TABLE_SCHEMA = ?
       AND TABLE_NAME = 'novel_genre_relation'
       AND REFERENCED_TABLE_NAME = 'novel_genre'`,
      [process.env.DB_NAME || 'wuxiaworld']
    );

    if (foreignKeys.length > 0) {
      const constraintName = foreignKeys[0].CONSTRAINT_NAME;
      console.log(`   找到外键约束: ${constraintName}`);
      console.log('2. 删除外键约束...');
      await connection.execute(`ALTER TABLE \`novel_genre_relation\` DROP FOREIGN KEY \`${constraintName}\``);
      console.log('   ✅ 外键约束删除成功');
    } else {
      console.log('   ℹ️  未找到相关外键约束');
    }

    // 4. 重命名表
    console.log('3. 重命名表 novel_genre -> genre...');
    await connection.execute('RENAME TABLE `novel_genre` TO `genre`');
    console.log('   ✅ 表重命名成功');

    // 5. 重新创建外键约束
    if (foreignKeys.length > 0) {
      console.log('4. 重新创建外键约束...');
      const constraintName = foreignKeys[0].CONSTRAINT_NAME;
      await connection.execute(
        `ALTER TABLE \`novel_genre_relation\` 
         ADD CONSTRAINT \`${constraintName}\` 
         FOREIGN KEY (\`genre_id\`) REFERENCES \`genre\` (\`id\`) ON DELETE CASCADE`
      );
      console.log('   ✅ 外键约束重新创建成功');
    }

    // 6. 验证结果
    console.log('\n📊 验证结果:');
    const [verifyGenre] = await connection.execute(
      `SELECT TABLE_NAME 
       FROM INFORMATION_SCHEMA.TABLES 
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'genre'`,
      [process.env.DB_NAME || 'wuxiaworld']
    );

    if (verifyGenre.length > 0) {
      console.log('   ✅ genre 表存在');
    }

    const [verifyFK] = await connection.execute(
      `SELECT CONSTRAINT_NAME, REFERENCED_TABLE_NAME
       FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
       WHERE TABLE_SCHEMA = ?
       AND TABLE_NAME = 'novel_genre_relation'
       AND REFERENCED_TABLE_NAME = 'genre'`,
      [process.env.DB_NAME || 'wuxiaworld']
    );

    if (verifyFK.length > 0) {
      console.log(`   ✅ 外键约束正确: novel_genre_relation.genre_id -> genre.id`);
    }

    // 7. 查询示例数据验证
    const [samples] = await connection.execute('SELECT id, name, chinese_name FROM genre LIMIT 5');
    if (samples.length > 0) {
      console.log('\n📋 示例数据 (前5条):');
      samples.forEach(row => {
        console.log(`   ID: ${row.id}, Name: ${row.name}, Chinese Name: ${row.chinese_name}`);
      });
    }

    console.log('\n✅ 重命名操作完成！');

  } catch (error) {
    console.error('❌ 错误:', error.message);
    if (error.code === 'ER_DUP_TABLE_NAME') {
      console.error('   错误：genre 表已存在');
    }
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n✅ 数据库连接已关闭');
    }
  }
}

renameNovelGenreToGenre();

