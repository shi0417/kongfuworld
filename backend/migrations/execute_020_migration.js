/**
 * 执行 020 号迁移：为 novel_editor_contract 表添加唯一活跃合同约束触发器
 */

const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '123456',
  database: process.env.DB_NAME || 'kongfuworld',
  charset: 'utf8mb4',
  multipleStatements: true
};

async function executeMigration() {
  let connection;
  try {
    console.log('开始执行 020 号迁移：添加合同唯一活跃约束触发器...');
    
    connection = await mysql.createConnection(dbConfig);
    
    // 读取 SQL 文件
    const sqlFile = path.join(__dirname, '020_add_contract_unique_active_constraints.sql');
    const sql = fs.readFileSync(sqlFile, 'utf8');
    
    // 执行 SQL
    await connection.query(sql);
    
    console.log('✅ 020 号迁移执行成功：合同唯一活跃约束触发器已创建');
    
  } catch (error) {
    console.error('❌ 020 号迁移执行失败:', error.message);
    if (error.code === 'ER_TRG_ALREADY_EXISTS') {
      console.log('⚠️  触发器已存在，跳过创建');
    } else {
      throw error;
    }
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  executeMigration()
    .then(() => {
      console.log('迁移完成');
      process.exit(0);
    })
    .catch((error) => {
      console.error('迁移失败:', error);
      process.exit(1);
    });
}

module.exports = executeMigration;

