// 为user表添加手机号验证字段
const mysql = require('mysql2/promise');

// 数据库配置
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '123456',
  database: process.env.DB_NAME || 'kongfuworld',
  charset: 'utf8mb4'
};

async function addPhoneVerificationFields() {
  let db;
  try {
    db = await mysql.createConnection(dbConfig);
    
    console.log('\n📱 为user表添加手机号验证字段\n');
    
    // 1. 添加手机号字段
    console.log('📝 添加字段: phone_number (手机号)');
    try {
      await db.execute(`
        ALTER TABLE user 
        ADD COLUMN phone_number VARCHAR(20) NULL COMMENT '手机号码'
      `);
      console.log('✅ 字段 phone_number 添加成功');
    } catch (error) {
      if (error.code === 'ER_DUP_FIELDNAME') {
        console.log('⚠️  字段 phone_number 已存在');
      } else {
        console.error('❌ 添加字段 phone_number 失败:', error.message);
      }
    }
    
    // 2. 添加手机号验证状态字段
    console.log('\n📝 添加字段: phone_verified (手机号验证状态)');
    try {
      await db.execute(`
        ALTER TABLE user 
        ADD COLUMN phone_verified TINYINT(1) DEFAULT 0 COMMENT '手机号是否已验证'
      `);
      console.log('✅ 字段 phone_verified 添加成功');
    } catch (error) {
      if (error.code === 'ER_DUP_FIELDNAME') {
        console.log('⚠️  字段 phone_verified 已存在');
      } else {
        console.error('❌ 添加字段 phone_verified 失败:', error.message);
      }
    }
    
    // 3. 添加手机号验证时间字段
    console.log('\n📝 添加字段: phone_verified_at (手机号验证时间)');
    try {
      await db.execute(`
        ALTER TABLE user 
        ADD COLUMN phone_verified_at DATETIME NULL COMMENT '手机号验证时间'
      `);
      console.log('✅ 字段 phone_verified_at 添加成功');
    } catch (error) {
      if (error.code === 'ER_DUP_FIELDNAME') {
        console.log('⚠️  字段 phone_verified_at 已存在');
      } else {
        console.error('❌ 添加字段 phone_verified_at 失败:', error.message);
      }
    }
    
    // 4. 查看更新后的表结构
    console.log('\n📊 更新后的user表结构:');
    const [columns] = await db.execute(`DESCRIBE user`);
    
    columns.forEach(column => {
      console.log(`   ${column.Field}: ${column.Type} ${column.Null === 'NO' ? 'NOT NULL' : 'NULL'} ${column.Key ? `(${column.Key})` : ''} ${column.Default ? `DEFAULT ${column.Default}` : ''} ${column.Comment ? `COMMENT '${column.Comment}'` : ''}`);
    });
    
    console.log('\n🎯 字段说明:');
    console.log('   phone_number: 用户手机号码');
    console.log('   phone_verified: 手机号是否已验证 (0=未验证, 1=已验证)');
    console.log('   phone_verified_at: 手机号验证时间');
    
    // 5. 创建手机号验证记录表
    console.log('\n📝 创建手机号验证记录表:');
    try {
      await db.execute(`
        CREATE TABLE IF NOT EXISTS phone_verification_log (
          id INT PRIMARY KEY AUTO_INCREMENT,
          user_id INT NOT NULL,
          phone_number VARCHAR(20) NOT NULL,
          verification_sid VARCHAR(100) NULL,
          verification_type ENUM('sms', 'call') DEFAULT 'sms',
          status ENUM('pending', 'approved', 'failed', 'canceled') DEFAULT 'pending',
          attempts INT DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          verified_at DATETIME NULL,
          FOREIGN KEY (user_id) REFERENCES user(id) ON DELETE CASCADE,
          INDEX idx_user_id (user_id),
          INDEX idx_phone_number (phone_number),
          INDEX idx_status (status),
          INDEX idx_created_at (created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
      console.log('✅ 手机号验证记录表创建成功');
    } catch (error) {
      console.error('❌ 创建手机号验证记录表失败:', error.message);
    }
    
    console.log('\n✅ 手机号验证字段添加完成');
    
  } catch (error) {
    console.error('❌ 添加字段失败:', error);
  } finally {
    if (db) await db.end();
  }
}

// 运行脚本
addPhoneVerificationFields();

