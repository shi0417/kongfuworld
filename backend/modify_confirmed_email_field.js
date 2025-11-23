// 修改confirmed_email字段类型，从tinyint改为varchar
const mysql = require('mysql2/promise');

const dbConfig = {
  host: 'localhost',
  user: 'root',
  password: '123456',
  database: 'kongfuworld',
  charset: 'utf8mb4'
};

async function modifyConfirmedEmailField() {
  let connection;
  
  try {
    console.log('🔗 正在连接数据库...');
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ 数据库连接成功\n');

    // 检查字段当前类型
    console.log('🔍 检查confirmed_email字段当前类型...');
    const [columns] = await connection.execute(`
      SELECT COLUMN_NAME, COLUMN_TYPE, COLUMN_DEFAULT, COLUMN_COMMENT
      FROM information_schema.COLUMNS 
      WHERE TABLE_SCHEMA = ? 
        AND TABLE_NAME = 'user' 
        AND COLUMN_NAME = 'confirmed_email'
    `, [dbConfig.database]);

    if (columns.length === 0) {
      console.log('❌ confirmed_email字段不存在');
      return;
    }

    const currentColumn = columns[0];
    console.log(`当前类型: ${currentColumn.COLUMN_TYPE}`);
    console.log(`当前注释: ${currentColumn.COLUMN_COMMENT || '无'}\n`);

    // 如果已经是varchar类型，检查是否需要修改
    if (currentColumn.COLUMN_TYPE.includes('varchar')) {
      console.log('ℹ️  confirmed_email字段已经是varchar类型，无需修改');
      
      // 检查字段大小是否足够
      const match = currentColumn.COLUMN_TYPE.match(/varchar\((\d+)\)/);
      const size = match ? parseInt(match[1]) : 0;
      
      if (size < 100) {
        console.log(`⚠️  字段大小为${size}，建议改为100\n`);
        console.log('⏳ 正在扩展字段大小到100...');
        await connection.execute(`
          ALTER TABLE \`user\` 
          MODIFY COLUMN \`confirmed_email\` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '已验证的邮箱地址'
        `);
        console.log('✅ 字段大小已更新\n');
      } else {
        console.log(`✅ 字段大小足够 (${size})\n`);
      }
    } else {
      // 需要修改类型
      console.log('⏳ 正在修改字段类型...');
      
      // 先备份现有数据（值为1的记录对应的email）
      const [usersWithConfirmed] = await connection.execute(`
        SELECT id, email, confirmed_email 
        FROM user 
        WHERE confirmed_email = 1 OR confirmed_email IS NOT NULL
      `);
      
      // 先修改字段类型（必须先改类型才能存储字符串）
      console.log('  步骤1: 修改字段类型为varchar...');
      await connection.execute(`
        ALTER TABLE \`user\` 
        MODIFY COLUMN \`confirmed_email\` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '已验证的邮箱地址'
      `);
      console.log('  ✅ 字段类型已修改为varchar(100)\n');
      
      // 然后更新数据：将原来值为1的记录更新为email值
      if (usersWithConfirmed.length > 0) {
        console.log(`  步骤2: 更新 ${usersWithConfirmed.length} 条记录的confirmed_email值...`);
        
        for (const user of usersWithConfirmed) {
          if (user.email) {
            await connection.execute(
              'UPDATE user SET confirmed_email = ? WHERE id = ?',
              [user.email, user.id]
            );
            console.log(`    ✓ 用户 ${user.id}: confirmed_email 更新为 ${user.email}`);
          } else {
            // 如果没有email，设置为NULL
            await connection.execute(
              'UPDATE user SET confirmed_email = NULL WHERE id = ?',
              [user.id]
            );
            console.log(`    ✓ 用户 ${user.id}: confirmed_email 设置为 NULL（无email）`);
          }
        }
        console.log('');
      }
      
      console.log('✅ confirmed_email字段修改完成\n');
    }

    // 验证修改结果
    console.log('🔍 验证修改结果...');
    const [verifyColumns] = await connection.execute(`
      SELECT COLUMN_NAME, COLUMN_TYPE, COLUMN_COMMENT
      FROM information_schema.COLUMNS 
      WHERE TABLE_SCHEMA = ? 
        AND TABLE_NAME = 'user' 
        AND COLUMN_NAME = 'confirmed_email'
    `, [dbConfig.database]);

    if (verifyColumns.length > 0) {
      const col = verifyColumns[0];
      console.log('✅ 字段修改成功:');
      console.log(`   类型: ${col.COLUMN_TYPE}`);
      console.log(`   注释: ${col.COLUMN_COMMENT || '无'}`);
    }

    console.log('\n🎉 字段修改完成！');

  } catch (error) {
    console.error('❌ 修改字段失败:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n🔌 数据库连接已关闭');
    }
  }
}

modifyConfirmedEmailField().catch(console.error);

