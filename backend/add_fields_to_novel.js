const mysql = require('mysql2/promise');
require('dotenv').config({ path: require('path').join(__dirname, 'kongfuworld.env') });

async function addFieldsToNovel() {
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
      `SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH, COLUMN_COMMENT 
       FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = ? 
       AND TABLE_NAME = 'novel' 
       AND COLUMN_NAME IN ('recommendation', 'languages')`,
      [process.env.DB_NAME || 'wuxiaworld']
    );

    console.log('📊 检查字段状态:');
    if (columns.length > 0) {
      columns.forEach(col => {
        console.log(`  - ${col.COLUMN_NAME} (${col.DATA_TYPE}) - 已存在`);
      });
    } else {
      console.log('  - 字段不存在，需要添加');
    }

    const hasRecommendation = columns.some(col => col.COLUMN_NAME === 'recommendation');
    const hasLanguages = columns.some(col => col.COLUMN_NAME === 'languages');

    // 1. 添加推荐语字段
    if (!hasRecommendation) {
      console.log('\n📝 添加推荐语字段 (recommendation)...');
      await connection.execute(`
        ALTER TABLE \`novel\` 
        ADD COLUMN \`recommendation\` text COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '推荐语' AFTER \`description\`
      `);
      console.log('   ✅ recommendation 字段添加成功');
    } else {
      console.log('\nℹ️  recommendation 字段已存在，跳过');
    }

    // 2. 添加 languages 字段
    if (!hasLanguages) {
      console.log('\n📝 添加 languages 字段...');
      await connection.execute(`
        ALTER TABLE \`novel\` 
        ADD COLUMN \`languages\` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '支持的语言（如：en,zh,es，多个语言用逗号分隔）' AFTER \`recommendation\`
      `);
      console.log('   ✅ languages 字段添加成功');
    } else {
      console.log('\nℹ️  languages 字段已存在，跳过');
    }

    // 3. 验证结果
    console.log('\n📊 验证结果:');
    const [verifyColumns] = await connection.execute(
      `SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH, IS_NULLABLE, COLUMN_DEFAULT, COLUMN_COMMENT
       FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = ? 
       AND TABLE_NAME = 'novel' 
       AND COLUMN_NAME IN ('recommendation', 'languages')
       ORDER BY ORDINAL_POSITION`,
      [process.env.DB_NAME || 'wuxiaworld']
    );

    if (verifyColumns.length > 0) {
      verifyColumns.forEach(col => {
        console.log(`\n   字段: ${col.COLUMN_NAME}`);
        console.log(`     类型: ${col.DATA_TYPE}${col.CHARACTER_MAXIMUM_LENGTH ? `(${col.CHARACTER_MAXIMUM_LENGTH})` : ''}`);
        console.log(`     可空: ${col.IS_NULLABLE}`);
        console.log(`     默认值: ${col.COLUMN_DEFAULT || 'NULL'}`);
        console.log(`     注释: ${col.COLUMN_COMMENT}`);
      });
    }

    // 4. 查询示例数据
    const [samples] = await connection.execute(
      'SELECT id, title, description, recommendation, languages FROM novel LIMIT 3'
    );
    
    if (samples.length > 0) {
      console.log('\n📋 示例数据 (前3条):');
      samples.forEach(row => {
        console.log(`   ID: ${row.id}, Title: ${row.title}`);
        console.log(`      Description: ${(row.description || '').substring(0, 50)}...`);
        console.log(`      Recommendation: ${row.recommendation || '(空)'}`);
        console.log(`      Languages: ${row.languages || '(空)'}`);
      });
    } else {
      console.log('\n📋 表中暂无数据');
    }

    console.log('\n✅ 操作完成！');

  } catch (error) {
    console.error('❌ 错误:', error.message);
    if (error.code === 'ER_DUP_FIELDNAME') {
      console.error('   字段已存在');
    }
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n✅ 数据库连接已关闭');
    }
  }
}

addFieldsToNovel();

