// 在user表中添加checkinday字段
const mysql = require('mysql2/promise');

// 数据库连接配置
const dbConfig = {
  host: 'localhost',
  user: 'root',
  password: '123456',
  database: 'kongfuworld',
  charset: 'utf8mb4'
};

async function addCheckindayField() {
  let db;
  try {
    console.log('开始添加checkinday字段...\n');
    
    // 创建数据库连接
    db = await mysql.createConnection(dbConfig);
    console.log('✅ 数据库连接成功');
    
    // 检查字段是否已存在
    const [columns] = await db.execute(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = 'kongfuworld' 
      AND TABLE_NAME = 'user' 
      AND COLUMN_NAME = 'checkinday'
    `);
    
    if (columns.length > 0) {
      console.log('⚠️  checkinday字段已存在，跳过添加');
      return;
    }
    
    // 添加checkinday字段
    console.log('1. 添加checkinday字段到user表...');
    await db.execute(`
      ALTER TABLE \`user\` 
      ADD COLUMN \`checkinday\` date DEFAULT NULL COMMENT '最后签到日期'
    `);
    console.log('✅ checkinday字段添加成功');
    
    // 添加索引以提高查询性能
    console.log('2. 添加checkinday字段索引...');
    await db.execute(`
      ALTER TABLE \`user\` 
      ADD INDEX \`idx_checkinday\` (\`checkinday\`)
    `);
    console.log('✅ checkinday字段索引添加成功');
    
    // 验证字段添加结果
    console.log('3. 验证字段添加结果...');
    const [newColumns] = await db.execute(`
      SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT, COLUMN_COMMENT
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = 'kongfuworld' 
      AND TABLE_NAME = 'user' 
      AND COLUMN_NAME = 'checkinday'
    `);
    
    if (newColumns.length > 0) {
      const column = newColumns[0];
      console.log('✅ checkinday字段验证成功:');
      console.log(`   字段名: ${column.COLUMN_NAME}`);
      console.log(`   数据类型: ${column.DATA_TYPE}`);
      console.log(`   允许空值: ${column.IS_NULLABLE}`);
      console.log(`   默认值: ${column.COLUMN_DEFAULT}`);
      console.log(`   注释: ${column.COLUMN_COMMENT}`);
    } else {
      console.error('❌ checkinday字段添加失败');
    }
    
    console.log('\n🎉 checkinday字段添加完成！');
    
  } catch (error) {
    console.error('❌ 添加checkinday字段时出错:', error);
  } finally {
    if (db) {
      await db.end();
    }
  }
}

// 运行脚本
if (require.main === module) {
  addCheckindayField();
}

module.exports = { addCheckindayField };
