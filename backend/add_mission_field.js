// 在user表中添加mission字段
const mysql = require('mysql2/promise');

// 数据库连接配置
const dbConfig = {
  host: 'localhost',
  user: 'root',
  password: '123456',
  database: 'kongfuworld',
  charset: 'utf8mb4'
};

async function addMissionField() {
  let db;
  try {
    console.log('开始添加mission字段...\n');
    
    // 创建数据库连接
    db = await mysql.createConnection(dbConfig);
    console.log('✅ 数据库连接成功');
    
    // 检查字段是否已存在
    const [columns] = await db.execute(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = 'kongfuworld' 
      AND TABLE_NAME = 'user' 
      AND COLUMN_NAME = 'mission'
    `);
    
    if (columns.length > 0) {
      console.log('⚠️  mission字段已存在，跳过添加');
      return;
    }
    
    // 添加mission字段
    console.log('1. 添加mission字段到user表...');
    await db.execute(`
      ALTER TABLE \`user\` 
      ADD COLUMN \`mission\` varchar(50) DEFAULT NULL COMMENT '任务状态: YYYY-MM-DD completed/uncompleted'
    `);
    console.log('✅ mission字段添加成功');
    
    // 为现有用户设置默认值
    console.log('2. 为现有用户设置默认任务状态...');
    await db.execute(`
      UPDATE \`user\` 
      SET \`mission\` = CONCAT(CURDATE(), ' uncompleted') 
      WHERE \`mission\` IS NULL
    `);
    console.log('✅ 已为现有用户设置默认任务状态');
    
    // 验证字段添加结果
    console.log('3. 验证字段添加结果...');
    const [newColumns] = await db.execute(`
      SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT, COLUMN_COMMENT
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = 'kongfuworld' 
      AND TABLE_NAME = 'user' 
      AND COLUMN_NAME = 'mission'
    `);
    
    if (newColumns.length > 0) {
      const column = newColumns[0];
      console.log('✅ mission字段信息:');
      console.log(`   字段名: ${column.COLUMN_NAME}`);
      console.log(`   数据类型: ${column.DATA_TYPE}`);
      console.log(`   是否可空: ${column.IS_NULLABLE}`);
      console.log(`   默认值: ${column.COLUMN_DEFAULT}`);
      console.log(`   注释: ${column.COLUMN_COMMENT}`);
    }
    
    // 检查用户数据
    const [users] = await db.execute('SELECT id, username, mission FROM user LIMIT 5');
    console.log('\n📊 用户数据示例:');
    users.forEach((user, index) => {
      console.log(`   ${index + 1}. ID: ${user.id}, 用户名: ${user.username}, 任务状态: ${user.mission}`);
    });
    
    console.log('\n✅ mission字段添加完成！');
    
  } catch (error) {
    console.error('❌ 添加mission字段失败:', error.message);
  } finally {
    if (db) await db.end();
  }
}

addMissionField();
