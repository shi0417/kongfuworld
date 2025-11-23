const mysql = require('mysql2/promise');
require('dotenv').config({ path: require('path').join(__dirname, 'kongfuworld.env') });

async function createProtagonistTable() {
  let connection;
  
  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'wuxiaworld'
    });

    console.log('✅ 已连接到数据库\n');

    // 1. 创建 protagonist 表
    console.log('📝 创建 protagonist 表...');
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS \`protagonist\` (
        \`id\` int NOT NULL AUTO_INCREMENT COMMENT '主角ID',
        \`novel_id\` int NOT NULL COMMENT '小说ID',
        \`name\` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '主角名',
        \`created_at\` datetime DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
        PRIMARY KEY (\`id\`),
        KEY \`idx_novel_id\` (\`novel_id\`),
        CONSTRAINT \`protagonist_ibfk_novel\` FOREIGN KEY (\`novel_id\`) REFERENCES \`novel\` (\`id\`) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='主角名表'
    `);
    console.log('   ✅ protagonist 表创建成功\n');

    // 2. 验证表结构
    console.log('📊 验证表结构:');
    const [columns] = await connection.execute(
      `SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH, IS_NULLABLE, COLUMN_DEFAULT, COLUMN_COMMENT, ORDINAL_POSITION
       FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = ? 
       AND TABLE_NAME = 'protagonist'
       ORDER BY ORDINAL_POSITION`,
      [process.env.DB_NAME || 'wuxiaworld']
    );

    console.log('\n字段结构:');
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

    // 3. 验证索引
    const [indexes] = await connection.execute(
      `SELECT INDEX_NAME, GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX) as COLUMNS, NON_UNIQUE
       FROM INFORMATION_SCHEMA.STATISTICS 
       WHERE TABLE_SCHEMA = ? 
       AND TABLE_NAME = 'protagonist'
       GROUP BY INDEX_NAME, NON_UNIQUE
       ORDER BY INDEX_NAME`,
      [process.env.DB_NAME || 'wuxiaworld']
    );

    console.log('\n索引列表:');
    indexes.forEach(idx => {
      const type = idx.NON_UNIQUE === 0 ? '唯一索引' : '普通索引';
      console.log(`   ${idx.INDEX_NAME}: ${type} on (${idx.COLUMNS})`);
    });

    // 4. 验证外键约束
    const [fks] = await connection.execute(
      `SELECT CONSTRAINT_NAME, COLUMN_NAME, REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME
       FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
       WHERE TABLE_SCHEMA = ?
       AND TABLE_NAME = 'protagonist'
       AND REFERENCED_TABLE_NAME IS NOT NULL`,
      [process.env.DB_NAME || 'wuxiaworld']
    );

    console.log('\n外键约束:');
    fks.forEach(fk => {
      console.log(`   ${fk.CONSTRAINT_NAME}: ${fk.COLUMN_NAME} -> ${fk.REFERENCED_TABLE_NAME}.${fk.REFERENCED_COLUMN_NAME}`);
    });

    // 5. 测试插入数据（如果有小说数据）
    const [novels] = await connection.execute('SELECT id, title FROM novel LIMIT 1');
    
    if (novels.length > 0) {
      console.log('\n📝 测试插入示例数据...');
      const novelId = novels[0].id;
      
      // 示例：为一本小说添加多个主角
      const testNames = ['主角一', '主角二'];
      
      for (const name of testNames) {
        try {
          await connection.execute(
            'INSERT INTO `protagonist` (`novel_id`, `name`) VALUES (?, ?)',
            [novelId, name]
          );
          console.log(`   ✅ 为小说 ID ${novelId} 添加主角: ${name}`);
        } catch (error) {
          if (error.code === 'ER_DUP_ENTRY') {
            console.log(`   ℹ️  主角 "${name}" 已存在，跳过`);
          } else {
            throw error;
          }
        }
      }

      // 6. 查询示例数据
      console.log('\n📋 查询示例数据:');
      const [rows] = await connection.execute(
        'SELECT p.id, p.novel_id, n.title as novel_title, p.name, p.created_at FROM `protagonist` p LEFT JOIN `novel` n ON p.novel_id = n.id ORDER BY p.novel_id, p.id LIMIT 10'
      );

      if (rows.length > 0) {
        console.log('\n数据列表:');
        console.log('ID\t小说ID\t小说标题\t\t\t主角名\t\t创建时间');
        console.log('─'.repeat(100));
        rows.forEach(row => {
          const date = row.created_at ? new Date(row.created_at).toLocaleString('zh-CN') : 'NULL';
          const title = (row.novel_title || '').substring(0, 20).padEnd(20);
          console.log(`${row.id}\t${row.novel_id}\t${title}\t${row.name.padEnd(15)}\t${date}`);
        });
        console.log(`\n总计: ${rows.length} 条记录`);
      }
    } else {
      console.log('\nℹ️  表中暂无小说数据，跳过测试数据插入');
    }

    // 7. 验证一本小说可以有多个主角
    if (novels.length > 0) {
      const novelId = novels[0].id;
      const [count] = await connection.execute(
        'SELECT COUNT(*) as count FROM `protagonist` WHERE `novel_id` = ?',
        [novelId]
      );
      
      if (count[0].count > 1) {
        console.log(`\n✅ 验证通过：小说 ID ${novelId} 有 ${count[0].count} 个主角记录（支持多主角）`);
      }
    }

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

createProtagonistTable();

