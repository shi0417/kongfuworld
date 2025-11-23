const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

// 数据库配置
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '123456',
  database: process.env.DB_NAME || 'kongfuworld',
  multipleStatements: true
};

async function executeMigration() {
  let connection;
  try {
    console.log('🔍 开始执行个人信息表迁移...');
    
    // 读取SQL文件
    const sqlPath = path.join(__dirname, 'create_personal_info_tables.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    // 连接数据库
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ 数据库连接成功');
    
    // 执行SQL
    console.log('📝 执行SQL语句...');
    await connection.query(sql);
    
    console.log('✅ 迁移完成！');
    console.log('\n📊 已创建的表和字段：');
    console.log('  - user表新增字段: qq_number, wechat_number, emergency_contact_relationship, emergency_contact_phone, is_real_name_verified, phone_number');
    console.log('  - user_addresses: 收货地址表');
    console.log('  - user_identity_verifications: 实名认证表');
    console.log('  - user_bank_card_bindings: 银行卡绑定表');
    console.log('  - user_bank_card_change_logs: 银行卡变更记录表');
    
  } catch (error) {
    console.error('❌ 迁移失败:', error.message);
    
    // 如果是字段已存在的错误，忽略
    if (error.message.includes('Duplicate column name') || 
        error.message.includes('already exists')) {
      console.log('⚠️  部分字段或表已存在，跳过...');
    } else {
      throw error;
    }
  } finally {
    if (connection) {
      await connection.end();
      console.log('🔌 数据库连接已关闭');
    }
  }
}

// 执行迁移
executeMigration().catch(console.error);

