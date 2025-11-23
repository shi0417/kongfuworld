// 在user表中添加referrer_id字段
const mysql = require('mysql2/promise');

// 数据库连接配置
const dbConfig = {
  host: 'localhost',
  user: 'root',
  password: '123456',
  database: 'kongfuworld',
  charset: 'utf8mb4'
};

async function addReferrerIdField() {
  let db;
  try {
    console.log('开始添加referrer_id字段...\n');
    
    // 创建数据库连接
    db = await mysql.createConnection(dbConfig);
    console.log('✅ 数据库连接成功');
    
    // 检查字段是否已存在
    const [columns] = await db.execute(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = 'kongfuworld' 
      AND TABLE_NAME = 'user' 
      AND COLUMN_NAME = 'referrer_id'
    `);
    
    if (columns.length > 0) {
      console.log('⚠️  referrer_id字段已存在，跳过添加');
      return;
    }
    
    // 添加referrer_id字段
    console.log('1. 添加referrer_id字段到user表...');
    await db.execute(`
      ALTER TABLE \`user\` 
      ADD COLUMN \`referrer_id\` int DEFAULT NULL COMMENT '推荐人用户ID'
    `);
    console.log('✅ referrer_id字段添加成功');
    
    // 添加外键约束（可选，确保数据完整性）
    console.log('2. 添加referrer_id外键约束...');
    try {
      await db.execute(`
        ALTER TABLE \`user\` 
        ADD CONSTRAINT \`fk_user_referrer\` 
        FOREIGN KEY (\`referrer_id\`) REFERENCES \`user\`(\`id\`) 
        ON DELETE SET NULL ON UPDATE CASCADE
      `);
      console.log('✅ referrer_id外键约束添加成功');
    } catch (fkError) {
      console.log('⚠️  外键约束添加失败（可能已存在或数据不兼容）:', fkError.message);
    }
    
    // 添加索引以提高查询性能
    console.log('3. 添加referrer_id字段索引...');
    await db.execute(`
      ALTER TABLE \`user\` 
      ADD INDEX \`idx_referrer_id\` (\`referrer_id\`)
    `);
    console.log('✅ referrer_id字段索引添加成功');
    
    // 验证字段添加结果
    console.log('4. 验证字段添加结果...');
    const [newColumns] = await db.execute(`
      SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT, COLUMN_COMMENT
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = 'kongfuworld' 
      AND TABLE_NAME = 'user' 
      AND COLUMN_NAME = 'referrer_id'
    `);
    
    if (newColumns.length > 0) {
      const column = newColumns[0];
      console.log('✅ referrer_id字段验证成功:');
      console.log(`   字段名: ${column.COLUMN_NAME}`);
      console.log(`   数据类型: ${column.DATA_TYPE}`);
      console.log(`   允许空值: ${column.IS_NULLABLE}`);
      console.log(`   默认值: ${column.COLUMN_DEFAULT}`);
      console.log(`   注释: ${column.COLUMN_COMMENT}`);
    } else {
      console.error('❌ referrer_id字段添加失败');
    }
    
    // 检查用户数据
    const [users] = await db.execute('SELECT id, username, referrer_id FROM user LIMIT 5');
    console.log('\n📊 用户数据示例:');
    users.forEach((user, index) => {
      console.log(`   ${index + 1}. ID: ${user.id}, 用户名: ${user.username}, 推荐人ID: ${user.referrer_id || '无'}`);
    });
    
    console.log('\n🎉 referrer_id字段添加完成！');
    
  } catch (error) {
    console.error('❌ 添加referrer_id字段时出错:', error);
  } finally {
    if (db) {
      await db.end();
    }
  }
}

// 运行脚本
if (require.main === module) {
  addReferrerIdField();
}

module.exports = { addReferrerIdField };
