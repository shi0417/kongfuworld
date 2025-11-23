// 创建randomNotes表（随记表）
const mysql = require('mysql2/promise');

// 数据库连接配置
const dbConfig = {
  host: 'localhost',
  user: 'root',
  password: '123456',
  database: 'kongfuworld',
  charset: 'utf8mb4'
};

async function createRandomNotesTable() {
  let db;
  try {
    console.log('开始创建randomNotes表...\n');
    
    // 创建数据库连接
    db = await mysql.createConnection(dbConfig);
    console.log('✅ 数据库连接成功');
    
    // 检查表是否已存在
    const [tables] = await db.execute(`
      SELECT TABLE_NAME 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_SCHEMA = 'kongfuworld' 
      AND TABLE_NAME = 'randomNotes'
    `);
    
    if (tables.length > 0) {
      console.log('⚠️  randomNotes表已存在，跳过创建');
      return;
    }
    
    // 创建randomNotes表
    console.log('1. 创建randomNotes表...');
    await db.execute(`
      CREATE TABLE IF NOT EXISTS \`randomNotes\` (
        \`id\` int NOT NULL AUTO_INCREMENT COMMENT '随记ID',
        \`user_id\` int NOT NULL COMMENT '用户ID',
        \`novel_id\` int NOT NULL COMMENT '小说ID',
        \`random_note\` text COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '随记内容',
        \`created_at\` datetime DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
        \`updated_at\` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
        PRIMARY KEY (\`id\`),
        KEY \`idx_user_id\` (\`user_id\`),
        KEY \`idx_novel_id\` (\`novel_id\`),
        KEY \`idx_user_novel\` (\`user_id\`, \`novel_id\`),
        CONSTRAINT \`randomNotes_ibfk_1\` FOREIGN KEY (\`user_id\`) REFERENCES \`user\` (\`id\`) ON DELETE CASCADE,
        CONSTRAINT \`randomNotes_ibfk_2\` FOREIGN KEY (\`novel_id\`) REFERENCES \`novel\` (\`id\`) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='随记表'
    `);
    console.log('✅ randomNotes表创建成功');
    
    // 验证表结构
    console.log('\n2. 验证表结构...');
    const [columns] = await db.execute(`
      SELECT 
        COLUMN_NAME, 
        DATA_TYPE, 
        CHARACTER_MAXIMUM_LENGTH, 
        IS_NULLABLE, 
        COLUMN_DEFAULT, 
        COLUMN_COMMENT,
        EXTRA
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = 'kongfuworld' 
      AND TABLE_NAME = 'randomNotes'
      ORDER BY ORDINAL_POSITION
    `);
    
    console.log('\n字段结构:');
    console.log('字段名\t\t\t类型\t\t\t可空\t默认值\t\t注释');
    console.log('─'.repeat(80));
    columns.forEach(col => {
      const length = col.CHARACTER_MAXIMUM_LENGTH ? `(${col.CHARACTER_MAXIMUM_LENGTH})` : '';
      const type = `${col.DATA_TYPE}${length}`;
      const nullable = col.IS_NULLABLE === 'YES' ? '是' : '否';
      const defaultValue = col.COLUMN_DEFAULT || 'NULL';
      const extra = col.EXTRA ? ` (${col.EXTRA})` : '';
      console.log(`${col.COLUMN_NAME.padEnd(20)}\t${type.padEnd(20)}\t${nullable}\t${defaultValue.toString().padEnd(15)}\t${col.COLUMN_COMMENT || ''}${extra}`);
    });
    
    // 验证索引
    console.log('\n3. 验证索引...');
    const [indexes] = await db.execute(`
      SELECT 
        INDEX_NAME,
        COLUMN_NAME,
        NON_UNIQUE,
        SEQ_IN_INDEX
      FROM INFORMATION_SCHEMA.STATISTICS
      WHERE TABLE_SCHEMA = 'kongfuworld'
      AND TABLE_NAME = 'randomNotes'
      ORDER BY INDEX_NAME, SEQ_IN_INDEX
    `);
    
    console.log('\n索引信息:');
    const indexMap = {};
    indexes.forEach(idx => {
      if (!indexMap[idx.INDEX_NAME]) {
        indexMap[idx.INDEX_NAME] = {
          columns: [],
          unique: idx.NON_UNIQUE === 0
        };
      }
      indexMap[idx.INDEX_NAME].columns.push(idx.COLUMN_NAME);
    });
    
    Object.keys(indexMap).forEach(indexName => {
      const index = indexMap[indexName];
      const type = index.unique ? '唯一索引' : '普通索引';
      console.log(`${indexName} (${type}): ${index.columns.join(', ')}`);
    });
    
    console.log('\n✅ 所有操作完成！');
  } catch (error) {
    console.error('❌ 操作失败:', error);
    throw error;
  } finally {
    if (db) {
      await db.end();
      console.log('数据库连接已关闭');
    }
  }
}

// 执行函数
createRandomNotesTable()
  .then(() => {
    console.log('\n脚本执行完成');
    process.exit(0);
  })
  .catch((error) => {
    console.error('脚本执行失败:', error);
    process.exit(1);
  });

