/**
 * 迁移脚本：将admin表中的明文密码转换为bcrypt哈希
 * 
 * 使用方法：
 * node backend/migrations/006_migrate_admin_passwords.js
 */

const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '123456',
  database: process.env.DB_NAME || 'kongfuworld',
  charset: 'utf8mb4'
};

async function migratePasswords() {
  let connection;
  try {
    connection = await mysql.createConnection(dbConfig);
    
    console.log('开始迁移admin密码...');
    
    // 获取所有admin记录
    const [admins] = await connection.execute('SELECT id, name, password FROM admin');
    
    console.log(`找到 ${admins.length} 个管理员账号`);
    
    for (const admin of admins) {
      // 检查密码是否已经是哈希格式（bcrypt哈希通常以$2a$、$2b$、$2y$开头，长度60）
      const isHashed = admin.password && admin.password.length === 60 && admin.password.startsWith('$2');
      
      if (isHashed) {
        console.log(`跳过 ${admin.name} (密码已哈希)`);
        continue;
      }
      
      // 哈希密码
      const hashedPassword = await bcrypt.hash(admin.password, 10);
      
      // 更新数据库
      await connection.execute(
        'UPDATE admin SET password = ? WHERE id = ?',
        [hashedPassword, admin.id]
      );
      
      console.log(`✓ ${admin.name} 密码已哈希`);
    }
    
    console.log('密码迁移完成！');
    
  } catch (error) {
    console.error('迁移失败:', error);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

// 执行迁移
migratePasswords();

