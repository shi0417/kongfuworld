// 为 chapter 表的 review_status 字段添加 'draft' 枚举值
const mysql = require('mysql2/promise');

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '123456',
  database: process.env.DB_NAME || 'kongfuworld',
  charset: 'utf8mb4'
};

async function addDraftToReviewStatus() {
  let db;
  try {
    db = await mysql.createConnection(dbConfig);
    console.log('数据库连接成功');

    // 修改 review_status 字段，添加 'draft' 枚举值
    console.log('修改 review_status 字段，添加 draft 枚举值...');
    await db.execute(`
      ALTER TABLE \`chapter\` 
      MODIFY COLUMN \`review_status\` ENUM('submitted','reviewing','approved','rejected','draft') 
      DEFAULT 'submitted' 
      COMMENT '审核状态: submitted=提交中, reviewing=审核中, approved=审核通过, rejected=审核不通过, draft=草稿'
    `);
    console.log('✅ review_status 字段修改成功，已添加 draft 枚举值');

    console.log('\n✅ 所有操作完成！');
  } catch (error) {
    console.error('❌ 操作失败:', error);
    throw error;
  } finally {
    if (db) {
      await db.end();
      console.log('数据库连接已关闭');
    }
  }
}

// 执行修改
addDraftToReviewStatus().catch(console.error);

