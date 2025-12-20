// 执行数据库迁移脚本：初始化签约政策和公告示例数据
// 执行方式: node backend/migrations/execute_20251218_migration.js

const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

// 数据库配置
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
    console.log('🔍 开始执行签约政策和公告数据初始化迁移...');
    console.log('1. 检查并处理现有 writer_contract_policy 记录');
    console.log('2. 插入签约政策示例数据（英文版）');
    console.log('3. 插入公告示例数据（用于测试）\n');
    
    // 连接数据库
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ 数据库连接成功');
    
    // 检查是否已有 is_current=1 的记录
    console.log('\n📊 检查现有数据...');
    const [existingRows] = await connection.query(
      `SELECT id, title, status, is_current 
       FROM site_legal_documents 
       WHERE doc_key = 'writer_contract_policy' AND language = 'en' AND is_current = 1`
    );
    
    if (existingRows.length > 0) {
      console.log(`⚠️  发现 ${existingRows.length} 条已存在的 is_current=1 记录：`);
      existingRows.forEach(row => {
        console.log(`   - ID: ${row.id}, Title: ${row.title}, Status: ${row.status}`);
      });
      console.log('\n💡 建议：如需插入新记录，请先通过后台 set-current 流程处理，或手动执行：');
      console.log('   UPDATE site_legal_documents SET is_current = 0 WHERE doc_key = \'writer_contract_policy\' AND language = \'en\';');
      console.log('\n⚠️  继续执行将插入新记录（is_current=1），但不会自动置 0 旧记录');
      console.log('   如需自动处理，请取消注释 SQL 文件中的 UPDATE 语句\n');
    } else {
      console.log('✓ 未发现冲突记录，可以安全插入\n');
    }
    
    // 读取SQL文件
    const sqlPath = path.join(__dirname, '20251218_init_writer_contract_policy.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    // 执行SQL
    console.log('📝 执行SQL迁移...');
    await connection.query(sql);
    
    console.log('✅ 迁移脚本执行成功！');
    console.log('📊 验证迁移结果...');
    
    // 验证签约政策是否插入成功
    const [policyRows] = await connection.query(`
      SELECT id, title, version, status, is_current 
      FROM site_legal_documents 
      WHERE doc_key = 'writer_contract_policy' AND language = 'en'
      ORDER BY id DESC
      LIMIT 1
    `);
    
    if (policyRows.length > 0) {
      const policy = policyRows[0];
      console.log(`✓ 签约政策已插入：ID=${policy.id}, Title="${policy.title}", Version=${policy.version}, Status=${policy.status}, is_current=${policy.is_current}`);
    } else {
      console.log('⚠️  签约政策可能未插入（请检查 SQL 文件）');
    }
    
    // 验证公告是否插入成功
    const [announcementRows] = await connection.query(`
      SELECT COUNT(*) as count 
      FROM homepage_announcements
      WHERE title IN ('Writer Program Update', 'Copyright Operations Update', 'Writer Achievement System Launched')
    `);
    
    const announcementCount = announcementRows[0].count;
    console.log(`✓ 公告示例数据：插入了 ${announcementCount} 条记录`);
    
    if (announcementCount >= 3) {
      console.log('✓ 所有公告示例数据插入成功');
    } else {
      console.log(`⚠️  预期插入 3 条公告，实际插入 ${announcementCount} 条`);
    }
    
    // 显示公告列表
    const [announcements] = await connection.query(`
      SELECT id, title, is_active, display_order 
      FROM homepage_announcements 
      WHERE title IN ('Writer Program Update', 'Copyright Operations Update', 'Writer Achievement System Launched')
      ORDER BY display_order
    `);
    
    console.log('\n📋 插入的公告列表：');
    announcements.forEach(ann => {
      console.log(`  - ID: ${ann.id}, Title: "${ann.title}", Active: ${ann.is_active}, Order: ${ann.display_order}`);
    });
    
    console.log('\n✅ 数据库迁移完成！');
    console.log('\n💡 下一步：');
    console.log('   1. 登录 admin 后台，进入"站点政策管理"');
    console.log('   2. 确认 writer_contract_policy 记录已存在且 status=published, is_current=1');
    console.log('   3. 访问 /contract-policy 页面验证显示');
    console.log('   4. 访问 /writers-zone 页面验证"官方动态"区块');
    
  } catch (error) {
    console.error('❌ 迁移执行失败:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n🔌 数据库连接已关闭');
    }
  }
}

// 执行迁移
executeMigration();

