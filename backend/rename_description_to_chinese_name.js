const mysql = require('mysql2/promise');
require('dotenv').config({ path: require('path').join(__dirname, 'kongfuworld.env') });

async function renameField() {
  let connection;
  
  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'wuxiaworld'
    });

    console.log('✅ 已连接到数据库\n');

    // 检查字段是否存在
    const [columns] = await connection.execute(
      `SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH 
       FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = ? 
       AND TABLE_NAME = 'genre' 
       AND COLUMN_NAME IN ('description', 'chinese_name')`,
      [process.env.DB_NAME || 'wuxiaworld']
    );

    console.log('📊 检查字段状态:');
    columns.forEach(col => {
      console.log(`  - ${col.COLUMN_NAME} (${col.DATA_TYPE})`);
    });

    const hasDescription = columns.some(col => col.COLUMN_NAME === 'description');
    const hasChineseName = columns.some(col => col.COLUMN_NAME === 'chinese_name');

    if (hasChineseName && !hasDescription) {
      console.log('\n✅ 字段已经是 chinese_name，无需修改');
    } else if (hasDescription) {
      console.log('\n📝 开始重命名字段: description -> chinese_name');
      
      await connection.execute(`
        ALTER TABLE \`genre\` 
        CHANGE COLUMN \`description\` \`chinese_name\` text COLLATE utf8mb4_unicode_ci COMMENT '中文名称'
      `);

      console.log('✅ 字段重命名成功！');
      
      // 验证修改结果
      const [verifyColumns] = await connection.execute(
        `SELECT COLUMN_NAME, DATA_TYPE, COLUMN_COMMENT 
         FROM INFORMATION_SCHEMA.COLUMNS 
         WHERE TABLE_SCHEMA = ? 
         AND TABLE_NAME = 'genre' 
         AND COLUMN_NAME = 'chinese_name'`,
        [process.env.DB_NAME || 'wuxiaworld']
      );

      if (verifyColumns.length > 0) {
        const col = verifyColumns[0];
        console.log(`\n📊 验证结果:`);
        console.log(`  字段名: ${col.COLUMN_NAME}`);
        console.log(`  类型: ${col.DATA_TYPE}`);
        console.log(`  注释: ${col.COLUMN_COMMENT}`);
        
        // 查询几条数据验证
        const [samples] = await connection.execute(
          'SELECT id, name, chinese_name FROM genre LIMIT 5'
        );
        console.log(`\n📋 示例数据 (前5条):`);
        samples.forEach(row => {
          console.log(`  ${row.name} -> ${row.chinese_name || '(空)'}`);
        });
      }
    } else {
      console.log('\n❌ 未找到 description 字段，请检查表结构');
    }

  } catch (error) {
    console.error('❌ 错误:', error.message);
    if (error.code === 'ER_DUP_FIELDNAME') {
      console.error('   字段 chinese_name 已存在，请先删除重复字段');
    }
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n✅ 数据库连接已关闭');
    }
  }
}

renameField();

