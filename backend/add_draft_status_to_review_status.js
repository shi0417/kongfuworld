// 在chapter表的review_status字段中添加'draft'状态
const mysql = require('mysql2/promise');

// 数据库连接配置
const dbConfig = {
  host: 'localhost',
  user: 'root',
  password: '123456',
  database: 'kongfuworld',
  charset: 'utf8mb4'
};

async function addDraftStatusToReviewStatus() {
  let db;
  try {
    console.log('开始添加draft状态到review_status字段...\n');
    
    // 创建数据库连接
    db = await mysql.createConnection(dbConfig);
    console.log('✅ 数据库连接成功');
    
    // 检查当前enum值
    const [columns] = await db.execute(`
      SELECT COLUMN_TYPE 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = 'kongfuworld' 
      AND TABLE_NAME = 'chapter' 
      AND COLUMN_NAME = 'review_status'
    `);
    
    if (columns.length === 0) {
      console.log('⚠️  review_status字段不存在，请先添加该字段');
      return;
    }
    
    const currentEnum = columns[0].COLUMN_TYPE;
    console.log('当前review_status枚举值:', currentEnum);
    
    // 检查是否已包含draft
    if (currentEnum.includes("'draft'")) {
      console.log('⚠️  draft状态已存在，跳过添加');
      return;
    }
    
    // 修改enum添加draft状态
    console.log('1. 修改review_status字段添加draft状态...');
    await db.execute(`
      ALTER TABLE \`chapter\` 
      MODIFY COLUMN \`review_status\` 
      enum('submitted','reviewing','approved','rejected','draft') 
      DEFAULT 'submitted' 
      COMMENT '审核状态: submitted=提交中, reviewing=审核中, approved=审核通过, rejected=审核不通过, draft=草稿'
    `);
    console.log('✅ draft状态添加成功');
    
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

// 执行函数
addDraftStatusToReviewStatus()
  .then(() => {
    console.log('脚本执行完成');
    process.exit(0);
  })
  .catch((error) => {
    console.error('脚本执行失败:', error);
    process.exit(1);
  });

