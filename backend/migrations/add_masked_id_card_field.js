const mysql = require('mysql2/promise');

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '123456',
  database: process.env.DB_NAME || 'kongfuworld'
};

async function addMaskedIdCardField() {
  let connection;
  try {
    console.log('🔍 开始添加masked_id_card字段...');
    
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ 数据库连接成功');
    
    // 检查字段是否已存在
    const [columns] = await connection.execute(
      "SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'user_identity_verifications' AND COLUMN_NAME = 'masked_id_card'",
      [dbConfig.database]
    );
    
    if (columns.length > 0) {
      console.log('ℹ️  字段已存在，跳过');
      return;
    }
    
    // 添加字段
    await connection.execute(
      "ALTER TABLE `user_identity_verifications` ADD COLUMN `masked_id_card` VARCHAR(20) DEFAULT NULL COMMENT '脱敏后的身份证号（用于显示）' AFTER `id_card_number`"
    );
    console.log('✅ 字段添加成功');
    
    // 为现有数据生成脱敏身份证号（如果可能的话）
    // 注意：由于现有数据是加密的，无法解密，所以只能留空或使用占位符
    console.log('ℹ️  现有数据的脱敏身份证号字段已设置为NULL（无法从加密数据还原）');
    
    console.log('\n✅ 迁移完成！');
    
  } catch (error) {
    console.error('❌ 迁移失败:', error.message);
  } finally {
    if (connection) await connection.end();
    console.log('🔌 数据库连接已关闭');
  }
}

addMaskedIdCardField();

