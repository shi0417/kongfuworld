const mysql = require('mysql2/promise');
const fs = require('fs');

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '123456',
  database: process.env.DB_NAME || 'kongfuworld',
  charset: 'utf8mb4',
  multipleStatements: true
};

async function createTables() {
  let db;
  try {
    db = await mysql.createConnection(dbConfig);
    
    const sql = `
CREATE TABLE IF NOT EXISTS \`user_referral_code\` (
  \`id\` BIGINT PRIMARY KEY AUTO_INCREMENT,
  \`user_id\` INT NOT NULL COMMENT '用户ID',
  \`code\` VARCHAR(32) NOT NULL COMMENT '推广码，如 ABC123',
  \`link_type\` ENUM('reader','author') NOT NULL COMMENT '链接类型：读者推广/作者推广',
  \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  \`updated_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY \`uniq_code\` (\`code\`),
  UNIQUE KEY \`uniq_user_type\` (\`user_id\`, \`link_type\`),
  KEY \`idx_user_id\` (\`user_id\`),
  CONSTRAINT \`fk_urc_user\` FOREIGN KEY (\`user_id\`) REFERENCES \`user\`(\`id\`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户推广码表';

CREATE TABLE IF NOT EXISTS \`referral_clicks\` (
  \`id\` BIGINT PRIMARY KEY AUTO_INCREMENT,
  \`referral_code\` VARCHAR(32) NOT NULL COMMENT '推广码',
  \`ip_address\` VARCHAR(45) NULL COMMENT 'IP地址',
  \`user_agent\` VARCHAR(255) NULL COMMENT '用户代理',
  \`clicked_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY \`idx_code\` (\`referral_code\`),
  KEY \`idx_clicked_at\` (\`clicked_at\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='推广点击统计表';
    `;
    
    await db.query(sql);
    console.log('✅ 推广码表创建成功！');
  } catch (error) {
    console.error('❌ 创建表失败:', error);
    process.exit(1);
  } finally {
    if (db) await db.end();
  }
}

createTables();

