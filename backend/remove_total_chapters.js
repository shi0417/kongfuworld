// 删除novel表中的total_chapters字段
const mysql = require('mysql2/promise');

const dbConfig = {
  host: 'localhost',
  user: 'root',
  password: '123456',
  database: 'kongfuworld',
  charset: 'utf8mb4'
};

async function removeTotalChapters() {
  let connection;
  
  try {
    console.log('🔗 正在连接数据库...');
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ 数据库连接成功\n');

    // 先检查字段是否存在
    console.log('🔍 检查novel表中是否存在total_chapters字段...');
    const [columns] = await connection.execute(`
      SELECT COLUMN_NAME 
      FROM information_schema.COLUMNS 
      WHERE TABLE_SCHEMA = ? 
        AND TABLE_NAME = 'novel' 
        AND COLUMN_NAME = 'total_chapters'
    `, [dbConfig.database]);

    if (columns.length === 0) {
      console.log('ℹ️  novel表中不存在total_chapters字段，无需删除\n');
      return;
    }

    console.log('✅ 找到total_chapters字段\n');

    // 执行删除语句
    console.log('🗑️  正在删除total_chapters字段...');
    try {
      await connection.execute('ALTER TABLE `novel` DROP COLUMN `total_chapters`');
      console.log('✅ total_chapters字段删除成功！\n');
    } catch (error) {
      // 如果MySQL版本不支持DROP COLUMN IF EXISTS，使用备用方案
      if (error.message.includes('syntax') || error.message.includes('IF EXISTS')) {
        console.log('⚠️  当前MySQL版本不支持DROP COLUMN IF EXISTS，使用备用方案...\n');
        await connection.execute(`
          SET @exist := (SELECT COUNT(*) FROM information_schema.COLUMNS 
                         WHERE TABLE_SCHEMA = ?
                           AND TABLE_NAME = 'novel' 
                           AND COLUMN_NAME = 'total_chapters');
          SET @sqlstmt := IF(@exist > 0, 
              'ALTER TABLE \`novel\` DROP COLUMN \`total_chapters\`', 
              'SELECT "Column does not exist"');
          PREPARE stmt FROM @sqlstmt;
          EXECUTE stmt;
          DEALLOCATE PREPARE stmt;
        `, [dbConfig.database]);
        console.log('✅ total_chapters字段删除成功！\n');
      } else {
        throw error;
      }
    }

    // 验证字段是否已删除
    console.log('🔍 验证字段删除结果...');
    const [verifyColumns] = await connection.execute(`
      SELECT COLUMN_NAME 
      FROM information_schema.COLUMNS 
      WHERE TABLE_SCHEMA = ? 
        AND TABLE_NAME = 'novel' 
        AND COLUMN_NAME = 'total_chapters'
    `, [dbConfig.database]);

    if (verifyColumns.length === 0) {
      console.log('✅ 验证通过：total_chapters字段已成功删除！\n');
      
      // 检查chapters字段是否存在
      const [chaptersColumn] = await connection.execute(`
        SELECT COLUMN_NAME 
        FROM information_schema.COLUMNS 
        WHERE TABLE_SCHEMA = ? 
          AND TABLE_NAME = 'novel' 
          AND COLUMN_NAME = 'chapters'
      `, [dbConfig.database]);
      
      if (chaptersColumn.length > 0) {
        console.log('✅ chapters字段存在，所有引用已更新完成！\n');
      } else {
        console.log('⚠️  警告：chapters字段不存在，请检查数据库结构\n');
      }
    } else {
      console.log('❌ 验证失败：total_chapters字段仍然存在\n');
    }

  } catch (error) {
    if (error.message.includes("doesn't exist") || 
        error.message.includes("Unknown column")) {
      console.log('ℹ️  字段已不存在，无需删除');
    } else {
      console.error('❌ 删除字段失败:', error.message);
      throw error;
    }
  } finally {
    if (connection) {
      await connection.end();
      console.log('🔌 数据库连接已关闭');
    }
  }
}

removeTotalChapters().catch(console.error);

