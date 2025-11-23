// 为user表添加作者相关字段
const mysql = require('mysql2/promise');

const dbConfig = {
  host: 'localhost',
  user: 'root',
  password: '123456',
  database: 'kongfuworld',
  charset: 'utf8mb4',
  multipleStatements: true
};

async function addAuthorFields() {
  let connection;
  
  try {
    console.log('🔗 正在连接数据库...');
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ 数据库连接成功\n');

    // 检查字段是否已存在
    const fieldsToCheck = ['is_author', 'pen_name', 'bio', 'confirmed_email', 'social_links'];
    const existingFields = [];
    
    for (const field of fieldsToCheck) {
      const [columns] = await connection.execute(`
        SELECT COLUMN_NAME 
        FROM information_schema.COLUMNS 
        WHERE TABLE_SCHEMA = ? 
          AND TABLE_NAME = 'user' 
          AND COLUMN_NAME = ?
      `, [dbConfig.database, field]);
      
      if (columns.length > 0) {
        existingFields.push(field);
      }
    }

    if (existingFields.length > 0) {
      console.log(`⚠️  以下字段已存在，将跳过: ${existingFields.join(', ')}\n`);
    }

    // 添加字段
    const fieldsToAdd = [
      {
        name: 'is_author',
        sql: `ALTER TABLE \`user\` ADD COLUMN \`is_author\` tinyint(1) DEFAULT 0 COMMENT '是否是作者' AFTER \`is_vip\``,
        skipIfExists: existingFields.includes('is_author')
      },
      {
        name: 'pen_name',
        sql: `ALTER TABLE \`user\` ADD COLUMN \`pen_name\` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '笔名' AFTER \`is_author\``,
        skipIfExists: existingFields.includes('pen_name')
      },
      {
        name: 'bio',
        sql: `ALTER TABLE \`user\` ADD COLUMN \`bio\` text COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '作者简介' AFTER \`pen_name\``,
        skipIfExists: existingFields.includes('bio')
      },
      {
        name: 'confirmed_email',
        sql: `ALTER TABLE \`user\` ADD COLUMN \`confirmed_email\` tinyint(1) DEFAULT 0 COMMENT '邮箱是否已确认' AFTER \`email\``,
        skipIfExists: existingFields.includes('confirmed_email')
      },
      {
        name: 'social_links',
        sql: `ALTER TABLE \`user\` ADD COLUMN \`social_links\` json DEFAULT NULL COMMENT '社交媒体链接' AFTER \`settings_json\``,
        skipIfExists: existingFields.includes('social_links')
      }
    ];

    console.log('📝 开始添加字段...\n');
    
    for (const field of fieldsToAdd) {
      if (field.skipIfExists) {
        console.log(`⏭️  跳过 ${field.name}（字段已存在）`);
        continue;
      }

      try {
        console.log(`⏳ 正在添加字段: ${field.name}...`);
        await connection.execute(field.sql);
        console.log(`✅ ${field.name} 字段添加成功\n`);
      } catch (error) {
        if (error.message.includes('Duplicate column name')) {
          console.log(`ℹ️  ${field.name} 字段已存在，跳过\n`);
        } else {
          throw error;
        }
      }
    }

    // 添加索引
    console.log('📊 添加索引...\n');
    
    const indexes = [
      {
        name: 'idx_pen_name',
        sql: `ALTER TABLE \`user\` ADD INDEX \`idx_pen_name\` (\`pen_name\`)`,
        field: 'pen_name'
      },
      {
        name: 'idx_is_author',
        sql: `ALTER TABLE \`user\` ADD INDEX \`idx_is_author\` (\`is_author\`)`,
        field: 'is_author'
      }
    ];

    for (const index of indexes) {
      try {
        // 先检查索引是否已存在
        const [existingIndexes] = await connection.execute(`
          SELECT INDEX_NAME 
          FROM information_schema.STATISTICS 
          WHERE TABLE_SCHEMA = ? 
            AND TABLE_NAME = 'user' 
            AND INDEX_NAME = ?
        `, [dbConfig.database, index.name]);

        if (existingIndexes.length > 0) {
          console.log(`⏭️  跳过索引 ${index.name}（已存在）`);
          continue;
        }

        // 检查字段是否存在
        const [fieldExists] = await connection.execute(`
          SELECT COLUMN_NAME 
          FROM information_schema.COLUMNS 
          WHERE TABLE_SCHEMA = ? 
            AND TABLE_NAME = 'user' 
            AND COLUMN_NAME = ?
        `, [dbConfig.database, index.field]);

        if (fieldExists.length === 0) {
          console.log(`⚠️  跳过索引 ${index.name}（字段 ${index.field} 不存在）`);
          continue;
        }

        console.log(`⏳ 正在添加索引: ${index.name}...`);
        await connection.execute(index.sql);
        console.log(`✅ ${index.name} 索引添加成功\n`);
      } catch (error) {
        if (error.message.includes('Duplicate key name')) {
          console.log(`ℹ️  索引 ${index.name} 已存在，跳过\n`);
        } else {
          console.log(`⚠️  添加索引 ${index.name} 失败: ${error.message}\n`);
        }
      }
    }

    // 验证字段添加结果
    console.log('🔍 验证字段添加结果...\n');
    const [allColumns] = await connection.execute(`
      SELECT COLUMN_NAME, COLUMN_TYPE, COLUMN_DEFAULT, COLUMN_COMMENT
      FROM information_schema.COLUMNS 
      WHERE TABLE_SCHEMA = ? 
        AND TABLE_NAME = 'user' 
        AND COLUMN_NAME IN ('is_author', 'pen_name', 'bio', 'confirmed_email', 'social_links')
      ORDER BY ORDINAL_POSITION
    `, [dbConfig.database]);

    if (allColumns.length > 0) {
      console.log('✅ 成功添加的字段:');
      allColumns.forEach(col => {
        console.log(`   - ${col.COLUMN_NAME}: ${col.COLUMN_TYPE} (默认值: ${col.COLUMN_DEFAULT || 'NULL'}, 注释: ${col.COLUMN_COMMENT || '无'})`);
      });
    } else {
      console.log('❌ 未找到任何新添加的字段');
    }

    // 验证索引添加结果
    console.log('\n🔍 验证索引添加结果...\n');
    const [allIndexes] = await connection.execute(`
      SELECT INDEX_NAME, COLUMN_NAME, NON_UNIQUE
      FROM information_schema.STATISTICS 
      WHERE TABLE_SCHEMA = ? 
        AND TABLE_NAME = 'user' 
        AND INDEX_NAME IN ('idx_pen_name', 'idx_is_author')
      ORDER BY INDEX_NAME, SEQ_IN_INDEX
    `, [dbConfig.database]);

    if (allIndexes.length > 0) {
      console.log('✅ 成功添加的索引:');
      allIndexes.forEach(idx => {
        console.log(`   - ${idx.INDEX_NAME}: ${idx.COLUMN_NAME} (${idx.NON_UNIQUE === 0 ? '唯一' : '非唯一'})`);
      });
    }

    console.log('\n🎉 字段添加完成！');

  } catch (error) {
    console.error('❌ 添加字段失败:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n🔌 数据库连接已关闭');
    }
  }
}

// 执行添加字段操作
addAuthorFields().catch(console.error);

