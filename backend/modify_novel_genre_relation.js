const mysql = require('mysql2/promise');
require('dotenv').config({ path: require('path').join(__dirname, 'kongfuworld.env') });

async function modifyNovelGenreRelation() {
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
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'novel_genre_relation'`,
      [process.env.DB_NAME || 'wuxiaworld']
    );

    if (tables.length === 0) {
      console.log('❌ novel_genre_relation 表不存在');
      return;
    }

    console.log('📝 开始修改 novel_genre_relation 表...\n');

    // 2. 删除触发器（如果存在）
    console.log('1. 删除触发器...');
    try {
      await connection.query('DROP TRIGGER IF EXISTS `sync_genre_relation_fields`');
      await connection.query('DROP TRIGGER IF EXISTS `sync_genre_relation_fields_update`');
      console.log('   ✅ 触发器已删除');
    } catch (error) {
      console.log('   ℹ️  触发器可能不存在或已删除');
    }

    // 3. 删除外键约束
    console.log('2. 删除外键约束...');
    try {
      await connection.execute('ALTER TABLE `novel_genre_relation` DROP FOREIGN KEY `novel_genre_relation_ibfk_2`');
      console.log('   ✅ 外键约束已删除');
    } catch (error) {
      console.log('   ℹ️  外键约束可能不存在或已删除');
    }

    // 4. 删除旧索引（如果有）
    console.log('3. 检查并删除旧索引...');
    try {
      const [indexes] = await connection.execute(
        `SELECT INDEX_NAME 
         FROM INFORMATION_SCHEMA.STATISTICS 
         WHERE TABLE_SCHEMA = ? 
         AND TABLE_NAME = 'novel_genre_relation' 
         AND INDEX_NAME IN ('unique_novel_genre', 'genre_id')`,
        [process.env.DB_NAME || 'wuxiaworld']
      );

      for (const idx of indexes) {
        try {
          await connection.execute(`ALTER TABLE \`novel_genre_relation\` DROP INDEX \`${idx.INDEX_NAME}\``);
          console.log(`   ✅ 索引 ${idx.INDEX_NAME} 已删除`);
        } catch (error) {
          console.log(`   ℹ️  索引 ${idx.INDEX_NAME} 可能不存在`);
        }
      }
    } catch (error) {
      console.log('   ℹ️  检查索引时出错');
    }

    // 5. 删除 genre_name 和 genre_chinese_name 字段（如果存在）
    console.log('4. 删除冗余字段...');
    try {
      const [columns] = await connection.execute(
        `SELECT COLUMN_NAME 
         FROM INFORMATION_SCHEMA.COLUMNS 
         WHERE TABLE_SCHEMA = ? 
         AND TABLE_NAME = 'novel_genre_relation' 
         AND COLUMN_NAME IN ('genre_name', 'genre_chinese_name')`,
        [process.env.DB_NAME || 'wuxiaworld']
      );

      for (const col of columns) {
        await connection.execute(`ALTER TABLE \`novel_genre_relation\` DROP COLUMN \`${col.COLUMN_NAME}\``);
        console.log(`   ✅ 字段 ${col.COLUMN_NAME} 已删除`);
      }

      if (columns.length === 0) {
        console.log('   ℹ️  冗余字段不存在，跳过');
      }
    } catch (error) {
      console.log('   ℹ️  删除字段时出错:', error.message);
    }

    // 6. 重命名 genre_id 为 genre_id_1
    console.log('5. 重命名 genre_id -> genre_id_1...');
    try {
      const [genreIdColumn] = await connection.execute(
        `SELECT COLUMN_NAME 
         FROM INFORMATION_SCHEMA.COLUMNS 
         WHERE TABLE_SCHEMA = ? 
         AND TABLE_NAME = 'novel_genre_relation' 
         AND COLUMN_NAME = 'genre_id'`,
        [process.env.DB_NAME || 'wuxiaworld']
      );

      if (genreIdColumn.length > 0) {
        await connection.execute(`
          ALTER TABLE \`novel_genre_relation\` 
          CHANGE COLUMN \`genre_id\` \`genre_id_1\` int NOT NULL
        `);
        console.log('   ✅ 字段重命名成功');
      } else {
        // 检查是否已经是 genre_id_1
        const [genreId1Column] = await connection.execute(
          `SELECT COLUMN_NAME 
           FROM INFORMATION_SCHEMA.COLUMNS 
           WHERE TABLE_SCHEMA = ? 
           AND TABLE_NAME = 'novel_genre_relation' 
           AND COLUMN_NAME = 'genre_id_1'`,
          [process.env.DB_NAME || 'wuxiaworld']
        );

        if (genreId1Column.length > 0) {
          console.log('   ℹ️  字段已经是 genre_id_1，跳过');
        } else {
          throw new Error('genre_id 字段不存在');
        }
      }
    } catch (error) {
      console.log('   ⚠️  重命名失败:', error.message);
    }

    // 7. 添加 genre_id_2 字段
    console.log('6. 添加 genre_id_2 字段...');
    try {
      const [genreId2Column] = await connection.execute(
        `SELECT COLUMN_NAME 
         FROM INFORMATION_SCHEMA.COLUMNS 
         WHERE TABLE_SCHEMA = ? 
         AND TABLE_NAME = 'novel_genre_relation' 
         AND COLUMN_NAME = 'genre_id_2'`,
        [process.env.DB_NAME || 'wuxiaworld']
      );

      if (genreId2Column.length === 0) {
        await connection.execute(`
          ALTER TABLE \`novel_genre_relation\` 
          ADD COLUMN \`genre_id_2\` int DEFAULT NULL COMMENT '第二类型ID' AFTER \`genre_id_1\`
        `);
        console.log('   ✅ genre_id_2 字段添加成功');
      } else {
        console.log('   ℹ️  genre_id_2 字段已存在，跳过');
      }
    } catch (error) {
      console.log('   ⚠️  添加字段失败:', error.message);
    }

    // 8. 添加 updated_at 字段
    console.log('7. 添加 updated_at 字段...');
    try {
      const [updatedAtColumn] = await connection.execute(
        `SELECT COLUMN_NAME 
         FROM INFORMATION_SCHEMA.COLUMNS 
         WHERE TABLE_SCHEMA = ? 
         AND TABLE_NAME = 'novel_genre_relation' 
         AND COLUMN_NAME = 'updated_at'`,
        [process.env.DB_NAME || 'wuxiaworld']
      );

      if (updatedAtColumn.length === 0) {
        await connection.execute(`
          ALTER TABLE \`novel_genre_relation\` 
          ADD COLUMN \`updated_at\` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间' AFTER \`created_at\`
        `);
        console.log('   ✅ updated_at 字段添加成功');
      } else {
        console.log('   ℹ️  updated_at 字段已存在，跳过');
      }
    } catch (error) {
      console.log('   ⚠️  添加字段失败:', error.message);
    }

    // 9. 创建唯一索引 (id, novel_id)
    console.log('8. 创建唯一索引 (id, novel_id)...');
    try {
      // 检查是否已存在
      const [existingIndex] = await connection.execute(
        `SELECT INDEX_NAME 
         FROM INFORMATION_SCHEMA.STATISTICS 
         WHERE TABLE_SCHEMA = ? 
         AND TABLE_NAME = 'novel_genre_relation' 
         AND INDEX_NAME = 'unique_id_novel'`,
        [process.env.DB_NAME || 'wuxiaworld']
      );

      if (existingIndex.length === 0) {
        await connection.execute(`
          ALTER TABLE \`novel_genre_relation\` 
          ADD UNIQUE KEY \`unique_id_novel\` (\`id\`, \`novel_id\`)
        `);
        console.log('   ✅ 唯一索引创建成功');
      } else {
        console.log('   ℹ️  唯一索引已存在，跳过');
      }
    } catch (error) {
      console.log('   ⚠️  创建索引失败:', error.message);
    }

    // 10. 重新创建外键约束（genre_id_1）
    console.log('9. 重新创建外键约束...');
    try {
      await connection.execute(`
        ALTER TABLE \`novel_genre_relation\` 
        ADD CONSTRAINT \`novel_genre_relation_ibfk_2\` 
        FOREIGN KEY (\`genre_id_1\`) REFERENCES \`genre\` (\`id\`) ON DELETE CASCADE
      `);
      console.log('   ✅ 外键约束创建成功');
    } catch (error) {
      if (error.code === 'ER_DUP_KEY') {
        console.log('   ℹ️  外键约束已存在');
      } else {
        console.log('   ⚠️  创建外键约束失败:', error.message);
      }
    }

    // 11. 添加 genre_id_2 的外键约束（可选）
    console.log('10. 添加 genre_id_2 的外键约束...');
    try {
      await connection.execute(`
        ALTER TABLE \`novel_genre_relation\` 
        ADD CONSTRAINT \`novel_genre_relation_ibfk_3\` 
        FOREIGN KEY (\`genre_id_2\`) REFERENCES \`genre\` (\`id\`) ON DELETE SET NULL
      `);
      console.log('   ✅ genre_id_2 外键约束创建成功');
    } catch (error) {
      if (error.code === 'ER_DUP_KEY') {
        console.log('   ℹ️  外键约束已存在');
      } else {
        console.log('   ⚠️  创建外键约束失败:', error.message);
      }
    }

    // 12. 验证结果
    console.log('\n📊 验证结果:');
    const [finalColumns] = await connection.execute(
      `SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT, COLUMN_COMMENT
       FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = ? 
       AND TABLE_NAME = 'novel_genre_relation'
       ORDER BY ORDINAL_POSITION`,
      [process.env.DB_NAME || 'wuxiaworld']
    );

    console.log('\n表结构:');
    finalColumns.forEach(col => {
      const maxLen = col.DATA_TYPE.includes('varchar') ? '(...)' : '';
      console.log(`   ${col.COLUMN_NAME.padEnd(20)} ${col.DATA_TYPE}${maxLen.padEnd(10)} ${col.IS_NULLABLE.padEnd(5)} ${(col.COLUMN_DEFAULT || 'NULL').toString().padEnd(15)} ${col.COLUMN_COMMENT || ''}`);
    });

    // 检查索引
    const [finalIndexes] = await connection.execute(
      `SELECT INDEX_NAME, GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX) as COLUMNS, NON_UNIQUE
       FROM INFORMATION_SCHEMA.STATISTICS 
       WHERE TABLE_SCHEMA = ? 
       AND TABLE_NAME = 'novel_genre_relation'
       GROUP BY INDEX_NAME, NON_UNIQUE`,
      [process.env.DB_NAME || 'wuxiaworld']
    );

    console.log('\n索引列表:');
    finalIndexes.forEach(idx => {
      const type = idx.NON_UNIQUE === 0 ? '唯一索引' : '普通索引';
      console.log(`   ${idx.INDEX_NAME}: ${type} on (${idx.COLUMNS})`);
    });

    // 检查外键约束
    const [finalFKs] = await connection.execute(
      `SELECT CONSTRAINT_NAME, COLUMN_NAME, REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME
       FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
       WHERE TABLE_SCHEMA = ?
       AND TABLE_NAME = 'novel_genre_relation'
       AND REFERENCED_TABLE_NAME IS NOT NULL`,
      [process.env.DB_NAME || 'wuxiaworld']
    );

    console.log('\n外键约束:');
    finalFKs.forEach(fk => {
      console.log(`   ${fk.CONSTRAINT_NAME}: ${fk.COLUMN_NAME} -> ${fk.REFERENCED_TABLE_NAME}.${fk.REFERENCED_COLUMN_NAME}`);
    });

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

modifyNovelGenreRelation();

