// 创建举报表（report）的迁移脚本
// 用于存储用户举报的评论信息

const mysql = require('mysql2/promise');

async function createReportTable() {
  let connection;
  
  try {
    // 创建数据库连接
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '123456',
      database: process.env.DB_NAME || 'kongfuworld',
      charset: 'utf8mb4'
    });

    console.log('开始创建 report 表...');

    // 创建 report 表
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS \`report\` (
        \`id\` int NOT NULL AUTO_INCREMENT COMMENT '主键，自增',
        \`user_id\` int NOT NULL COMMENT '举报用户的ID',
        \`type\` enum('review','comment','paragraph_comment') NOT NULL COMMENT '举报类型：review=评价, comment=评论, paragraph_comment=段落评论',
        \`remark_id\` int NOT NULL COMMENT '被举报内容的ID（根据type对应review.id、comment.id或paragraph_comment.id）',
        \`report\` enum('Spoilers','Abuse or harassment','Spam','Copyright infringement','Discrimination (racism, sexism, etc.)','Request to delete a comment that you created') NOT NULL COMMENT '举报原因',
        \`created_at\` datetime DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
        PRIMARY KEY (\`id\`),
        KEY \`idx_user_id\` (\`user_id\`),
        KEY \`idx_type_remark_id\` (\`type\`, \`remark_id\`),
        KEY \`idx_created_at\` (\`created_at\`),
        CONSTRAINT \`report_ibfk_user\` FOREIGN KEY (\`user_id\`) REFERENCES \`user\` (\`id\`) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户举报表';
    `;

    await connection.execute(createTableSQL);
    console.log('✅ report 表创建成功！');

    // 验证表结构
    const [columns] = await connection.execute('DESCRIBE report');
    console.log('\n📋 report 表结构:');
    console.table(columns);

  } catch (error) {
    console.error('❌ 创建 report 表失败:', error);
    throw error;
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n数据库连接已关闭');
    }
  }
}

// 如果直接运行此脚本，执行迁移
if (require.main === module) {
  createReportTable()
    .then(() => {
      console.log('\n✅ 迁移完成！');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ 迁移失败:', error);
      process.exit(1);
    });
}

module.exports = createReportTable;

