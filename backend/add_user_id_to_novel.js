const mysql = require('mysql2/promise');
require('dotenv').config({ path: require('path').join(__dirname, 'kongfuworld.env') });

async function addUserIdToNovel() {
  let connection;
  
  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'wuxiaworld'
    });

    console.log('✅ 已连接到数据库\n');

    // 检查字段是否已存在
    const [columns] = await connection.execute(
      `SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_COMMENT 
       FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = ? 
       AND TABLE_NAME = 'novel' 
       AND COLUMN_NAME = 'user_id'`,
      [process.env.DB_NAME || 'wuxiaworld']
    );

    if (columns.length > 0) {
      console.log('⚠️  字段 user_id 已存在:');
      const col = columns[0];
      console.log(`   字段名: ${col.COLUMN_NAME}`);
      console.log(`   类型: ${col.DATA_TYPE}`);
      console.log(`   可空: ${col.IS_NULLABLE}`);
      console.log(`   注释: ${col.COLUMN_COMMENT}`);
      console.log('\n✅ 无需重复添加');
      return;
    }

    // 检查是否存在外键约束
    const [constraints] = await connection.execute(
      `SELECT CONSTRAINT_NAME, TABLE_NAME, COLUMN_NAME, REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME
       FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
       WHERE TABLE_SCHEMA = ?
       AND TABLE_NAME = 'novel'
       AND CONSTRAINT_NAME = 'novel_ibfk_user'`,
      [process.env.DB_NAME || 'wuxiaworld']
    );

    console.log('📝 开始添加 user_id 字段...\n');

    // 分步执行，避免一次性执行失败
    try {
      // 1. 添加字段
      console.log('1. 添加 user_id 字段...');
      await connection.execute(`
        ALTER TABLE \`novel\` 
        ADD COLUMN \`user_id\` int DEFAULT NULL COMMENT '作者用户ID' AFTER \`id\`
      `);
      console.log('   ✅ 字段添加成功');

      // 2. 添加索引
      console.log('2. 添加索引 idx_user_id...');
      await connection.execute(`
        ALTER TABLE \`novel\` 
        ADD INDEX \`idx_user_id\` (\`user_id\`)
      `);
      console.log('   ✅ 索引添加成功');

      // 3. 添加外键约束
      console.log('3. 添加外键约束...');
      await connection.execute(`
        ALTER TABLE \`novel\` 
        ADD CONSTRAINT \`novel_ibfk_user\` 
        FOREIGN KEY (\`user_id\`) REFERENCES \`user\` (\`id\`) ON DELETE SET NULL
      `);
      console.log('   ✅ 外键约束添加成功');

      console.log('\n✅ 所有操作完成！\n');

      // 验证结果
      const [verifyColumns] = await connection.execute(
        `SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_COMMENT, COLUMN_DEFAULT
         FROM INFORMATION_SCHEMA.COLUMNS 
         WHERE TABLE_SCHEMA = ? 
         AND TABLE_NAME = 'novel' 
         AND COLUMN_NAME = 'user_id'`,
        [process.env.DB_NAME || 'wuxiaworld']
      );

      if (verifyColumns.length > 0) {
        const col = verifyColumns[0];
        console.log('📊 验证结果:');
        console.log(`   字段名: ${col.COLUMN_NAME}`);
        console.log(`   类型: ${col.DATA_TYPE}`);
        console.log(`   可空: ${col.IS_NULLABLE}`);
        console.log(`   默认值: ${col.COLUMN_DEFAULT}`);
        console.log(`   注释: ${col.COLUMN_COMMENT}`);
      }

      // 检查索引
      const [indexes] = await connection.execute(
        `SELECT INDEX_NAME, COLUMN_NAME, NON_UNIQUE
         FROM INFORMATION_SCHEMA.STATISTICS 
         WHERE TABLE_SCHEMA = ? 
         AND TABLE_NAME = 'novel' 
         AND COLUMN_NAME = 'user_id'`,
        [process.env.DB_NAME || 'wuxiaworld']
      );

      if (indexes.length > 0) {
        console.log('\n📊 索引信息:');
        indexes.forEach(idx => {
          console.log(`   ${idx.INDEX_NAME} (${idx.NON_UNIQUE ? '普通索引' : '唯一索引'}) on ${idx.COLUMN_NAME}`);
        });
      }

      // 检查外键约束
      const [fkConstraints] = await connection.execute(
        `SELECT CONSTRAINT_NAME, TABLE_NAME, COLUMN_NAME, REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME
         FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
         WHERE TABLE_SCHEMA = ?
         AND TABLE_NAME = 'novel'
         AND CONSTRAINT_NAME = 'novel_ibfk_user'`,
        [process.env.DB_NAME || 'wuxiaworld']
      );

      if (fkConstraints.length > 0) {
        console.log('\n📊 外键约束:');
        fkConstraints.forEach(fk => {
          console.log(`   ${fk.CONSTRAINT_NAME}: ${fk.TABLE_NAME}.${fk.COLUMN_NAME} -> ${fk.REFERENCED_TABLE_NAME}.${fk.REFERENCED_COLUMN_NAME}`);
        });
      }

      // 查询示例数据
      const [samples] = await connection.execute(
        'SELECT id, title, author, user_id FROM novel LIMIT 5'
      );
      if (samples.length > 0) {
        console.log('\n📋 示例数据 (前5条):');
        samples.forEach(row => {
          console.log(`   ID: ${row.id}, Title: ${row.title}, Author: ${row.author || '(空)'}, User ID: ${row.user_id || '(空)'}`);
        });
      }

    } catch (error) {
      if (error.code === 'ER_DUP_FIELDNAME') {
        console.error('   ❌ 字段已存在');
      } else if (error.code === 'ER_DUP_KEYNAME') {
        console.error('   ❌ 索引已存在');
      } else if (error.code === 'ER_DUP_KEY') {
        console.error('   ❌ 外键约束已存在');
      } else {
        throw error;
      }
    }

  } catch (error) {
    console.error('❌ 错误:', error.message);
    if (error.code === 'ER_NO_REFERENCED_ROW_2') {
      console.error('   错误：无法添加外键约束，请确保 user 表存在');
    }
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n✅ 数据库连接已关闭');
    }
  }
}

addUserIdToNovel();

