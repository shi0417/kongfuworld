/**
 * 执行迁移脚本：fix_reader_spending_unique_constraint.sql
 * 修复 reader_spending 表的唯一约束，支持订阅跨月拆分
 * 
 * 使用方法：
 * node backend/migrations/execute_fix_reader_spending_unique_constraint.js
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
    console.log('🔌 正在连接数据库...');
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ 数据库连接成功\n');
    
    // 读取迁移SQL文件
    const sqlPath = path.join(__dirname, 'fix_reader_spending_unique_constraint.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    console.log('📝 开始执行迁移脚本：fix_reader_spending_unique_constraint.sql\n');
    console.log('将执行以下操作：');
    console.log('  1. 删除旧的唯一约束 uniq_source');
    console.log('  2. 添加新的唯一约束 uniq_source_month (包含 settlement_month)\n');
    
    // 检查当前约束
    console.log('🔍 检查当前状态...');
    const [indexes] = await connection.execute(
      `SELECT INDEX_NAME, COLUMN_NAME, SEQ_IN_INDEX
       FROM INFORMATION_SCHEMA.STATISTICS 
       WHERE TABLE_SCHEMA = ? 
       AND TABLE_NAME = 'reader_spending'
       AND INDEX_NAME IN ('uniq_source', 'uniq_source_month')
       ORDER BY INDEX_NAME, SEQ_IN_INDEX`,
      [dbConfig.database]
    );
    
    console.log('当前唯一约束：');
    const currentIndexes = {};
    indexes.forEach(idx => {
      if (!currentIndexes[idx.INDEX_NAME]) {
        currentIndexes[idx.INDEX_NAME] = [];
      }
      currentIndexes[idx.INDEX_NAME].push(idx.COLUMN_NAME);
    });
    
    Object.keys(currentIndexes).forEach(indexName => {
      console.log(`  ${indexName}: (${currentIndexes[indexName].join(', ')})`);
    });
    
    // 检查是否有重复数据（可能导致迁移失败）
    console.log('\n🔍 检查是否有重复数据...');
    const [duplicates] = await connection.execute(
      `SELECT source_type, source_id, COUNT(*) as count
       FROM reader_spending
       GROUP BY source_type, source_id
       HAVING count > 1`
    );
    
    if (duplicates.length > 0) {
      console.log(`⚠️  发现 ${duplicates.length} 组重复数据（同一 source_type + source_id 有多条记录）`);
      console.log('   这些记录可能来自之前的跨月拆分逻辑');
      console.log('   如果这些记录的 settlement_month 不同，迁移可以继续');
      console.log('   如果 settlement_month 相同，需要先清理重复数据\n');
      
      // 检查是否有 settlement_month 也重复的情况
      const [monthDuplicates] = await connection.execute(
        `SELECT source_type, source_id, settlement_month, COUNT(*) as count
         FROM reader_spending
         GROUP BY source_type, source_id, settlement_month
         HAVING count > 1`
      );
      
      if (monthDuplicates.length > 0) {
        console.log(`❌ 发现 ${monthDuplicates.length} 组完全重复的数据（source_type + source_id + settlement_month 都相同）`);
        console.log('   这些记录需要先清理，否则无法创建唯一约束');
        console.log('\n建议：');
        console.log('   1. 先删除 reader_spending 表中 settlement_month 相同的重复记录');
        console.log('   2. 然后重新运行此迁移脚本');
        process.exit(1);
      } else {
        console.log('✅ 所有重复记录的 settlement_month 都不同，可以继续迁移\n');
      }
    } else {
      console.log('✅ 没有发现重复数据\n');
    }
    
    console.log('⚙️  执行SQL语句...\n');
    
    // 执行SQL
    await connection.query(sql);
    
    console.log('✅ 迁移脚本执行成功！');
    console.log('📊 验证迁移结果...\n');
    
    // 验证约束是否已更新
    const [verifyIndexes] = await connection.execute(
      `SELECT INDEX_NAME, COLUMN_NAME, SEQ_IN_INDEX
       FROM INFORMATION_SCHEMA.STATISTICS 
       WHERE TABLE_SCHEMA = ? 
       AND TABLE_NAME = 'reader_spending'
       AND INDEX_NAME IN ('uniq_source', 'uniq_source_month')
       ORDER BY INDEX_NAME, SEQ_IN_INDEX`,
      [dbConfig.database]
    );
    
    const verifyIndexMap = {};
    verifyIndexes.forEach(idx => {
      if (!verifyIndexMap[idx.INDEX_NAME]) {
        verifyIndexMap[idx.INDEX_NAME] = [];
      }
      verifyIndexMap[idx.INDEX_NAME].push(idx.COLUMN_NAME);
    });
    
    if (verifyIndexMap['uniq_source']) {
      console.log('⚠️  旧的 uniq_source 约束仍然存在');
    } else {
      console.log('✅ 旧的 uniq_source 约束已删除');
    }
    
    if (verifyIndexMap['uniq_source_month']) {
      console.log(`✅ 新的 uniq_source_month 约束已创建`);
      console.log(`   字段: (${verifyIndexMap['uniq_source_month'].join(', ')})`);
    } else {
      throw new Error('uniq_source_month 约束未找到，迁移可能失败');
    }
    
    console.log('\n✅ 迁移完成！');
    console.log('现在同一个订阅记录可以在不同月份有多条 reader_spending 记录');
    
  } catch (error) {
    console.error('\n❌ 迁移失败:', error.message);
    
    if (error.code === 'ER_DUP_ENTRY') {
      console.error('   错误：存在重复数据，无法创建唯一约束');
      console.error('   请先清理重复数据，然后重新运行迁移脚本');
    } else if (error.code === 'ER_CANT_DROP_FIELD_OR_KEY') {
      console.error('   错误：无法删除索引，可能索引不存在或名称不正确');
    } else {
      console.error('   错误详情:', error);
    }
    
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

