// 在novel表中添加review_status字段
const mysql = require('mysql2/promise');
require('dotenv').config({ path: require('path').join(__dirname, 'kongfuworld.env') });

// 数据库连接配置
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '123456',
  database: process.env.DB_NAME || 'kongfuworld',
  charset: 'utf8mb4'
};

async function addReviewStatusToNovel() {
  let db;
  try {
    console.log('开始为novel表添加review_status字段...\n');
    
    // 创建数据库连接
    db = await mysql.createConnection(dbConfig);
    console.log('✅ 数据库连接成功');
    
    // 检查字段是否已存在
    const [columns] = await db.execute(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = ? 
      AND TABLE_NAME = 'novel' 
      AND COLUMN_NAME = 'review_status'
    `, [dbConfig.database]);
    
    if (columns.length > 0) {
      console.log('⚠️  review_status字段已存在，跳过添加');
      return;
    }
    
    // 添加review_status字段
    console.log('1. 添加review_status字段到novel表...');
    await db.execute(`
      ALTER TABLE \`novel\` 
      ADD COLUMN \`review_status\` enum('submitted','reviewing','approved','rejected') 
      DEFAULT 'submitted' 
      COMMENT '审核状态: submitted=提交中, reviewing=审核中, approved=审核通过, rejected=审核不通过'
      AFTER \`licensed_from\`
    `);
    console.log('✅ review_status字段添加成功');
    
    // 添加索引以提高查询性能
    console.log('2. 添加review_status字段索引...');
    await db.execute(`
      ALTER TABLE \`novel\` 
      ADD INDEX \`idx_review_status\` (\`review_status\`)
    `);
    console.log('✅ review_status字段索引添加成功');
    
    // 为现有小说设置默认审核状态
    console.log('3. 为现有小说设置默认审核状态...');
    const [updateResult] = await db.execute(`
      UPDATE \`novel\` 
      SET \`review_status\` = 'approved' 
      WHERE \`review_status\` IS NULL OR \`review_status\` = 'submitted'
    `);
    console.log(`✅ 已为 ${updateResult.affectedRows} 本现有小说设置默认审核状态为"审核通过"`);
    
    // 验证字段添加结果
    console.log('4. 验证字段添加结果...');
    const [newColumns] = await db.execute(`
      SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT, COLUMN_COMMENT, COLUMN_TYPE
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = ? 
      AND TABLE_NAME = 'novel' 
      AND COLUMN_NAME = 'review_status'
    `, [dbConfig.database]);
    
    if (newColumns.length > 0) {
      const column = newColumns[0];
      console.log('✅ review_status字段验证成功:');
      console.log(`   字段名: ${column.COLUMN_NAME}`);
      console.log(`   数据类型: ${column.DATA_TYPE}`);
      console.log(`   完整类型: ${column.COLUMN_TYPE}`);
      console.log(`   允许空值: ${column.IS_NULLABLE}`);
      console.log(`   默认值: ${column.COLUMN_DEFAULT}`);
      console.log(`   注释: ${column.COLUMN_COMMENT}`);
    } else {
      console.error('❌ review_status字段添加失败');
    }
    
    // 检查小说数据
    const [novels] = await db.execute(`
      SELECT id, title, review_status 
      FROM novel 
      ORDER BY id 
      LIMIT 5
    `);
    console.log('\n📊 小说数据示例:');
    novels.forEach((novel, index) => {
      const statusMap = {
        'submitted': '提交中',
        'reviewing': '审核中', 
        'approved': '审核通过',
        'rejected': '审核不通过'
      };
      console.log(`   ${index + 1}. ID: ${novel.id}, 标题: ${novel.title}, 审核状态: ${statusMap[novel.review_status] || novel.review_status}`);
    });
    
    // 统计各状态的数量
    const [statusCounts] = await db.execute(`
      SELECT review_status, COUNT(*) as count 
      FROM novel 
      GROUP BY review_status
    `);
    console.log('\n📈 审核状态统计:');
    statusCounts.forEach((status) => {
      const statusMap = {
        'submitted': '提交中',
        'reviewing': '审核中',
        'approved': '审核通过', 
        'rejected': '审核不通过'
      };
      console.log(`   ${statusMap[status.review_status] || status.review_status}: ${status.count} 本小说`);
    });
    
    console.log('\n🎉 review_status字段添加完成！');
    
  } catch (error) {
    console.error('❌ 添加review_status字段时出错:', error);
    if (error.code === 'ER_DUP_FIELDNAME') {
      console.error('   错误：字段已存在');
    } else if (error.code === 'ER_DUP_KEYNAME') {
      console.error('   错误：索引已存在');
    }
  } finally {
    if (db) {
      await db.end();
      console.log('\n✅ 数据库连接已关闭');
    }
  }
}

// 运行脚本
if (require.main === module) {
  addReviewStatusToNovel();
}

module.exports = { addReviewStatusToNovel };

