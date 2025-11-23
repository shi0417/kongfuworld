const mysql = require('mysql2/promise');

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '123456',
  database: process.env.DB_NAME || 'kongfuworld'
};

async function fixIdCardLength() {
  let connection;
  try {
    console.log('🔍 开始修复id_card_number字段长度...');
    
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ 数据库连接成功');
    
    // 检查当前字段类型
    const [columns] = await connection.execute(
      "SELECT COLUMN_TYPE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'user_identity_verifications' AND COLUMN_NAME = 'id_card_number'",
      [dbConfig.database]
    );
    
    if (columns.length > 0) {
      console.log('当前字段类型:', columns[0].COLUMN_TYPE);
      
      if (columns[0].COLUMN_TYPE.includes('varchar')) {
        console.log('📝 修改字段类型为TEXT...');
        await connection.execute(
          'ALTER TABLE `user_identity_verifications` MODIFY COLUMN `id_card_number` TEXT DEFAULT NULL COMMENT \'身份证号（加密存储）\''
        );
        console.log('✅ 字段类型修改成功');
      } else {
        console.log('ℹ️  字段类型已经是TEXT，无需修改');
      }
    } else {
      console.log('⚠️  未找到字段，可能表不存在');
    }
    
    console.log('\n✅ 修复完成！');
    
  } catch (error) {
    console.error('❌ 修复失败:', error.message);
  } finally {
    if (connection) await connection.end();
    console.log('🔌 数据库连接已关闭');
  }
}

fixIdCardLength();

