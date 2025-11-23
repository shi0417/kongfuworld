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

async function runMigration() {
  let connection;
  try {
    console.log('🔄 开始执行数据库迁移...');
    console.log('📋 迁移内容：将支付系统改为"一个用户一个月一笔支付单"模型');
    console.log('   - 取消100美元门槛');
    console.log('   - 取消user_payout_item表');
    console.log('   - 加入USD/CNY双币支付+汇率记录\n');
    
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ 数据库连接成功\n');
    
    // 读取SQL文件
    const sqlFile = path.join(__dirname, 'migrate_payout_to_one_per_month.sql');
    const sql = fs.readFileSync(sqlFile, 'utf8');
    
    // 分割SQL语句（按分号和换行）
    // 移除注释行（以--开头的行）
    const lines = sql.split('\n').filter(line => {
      const trimmed = line.trim();
      return trimmed.length > 0 && !trimmed.startsWith('--');
    });
    
    // 重新组合并分割SQL语句
    const sqlWithoutComments = lines.join('\n');
    const statements = sqlWithoutComments
      .split(';')
      .map(s => s.trim())
      .filter(s => {
        // 过滤掉空语句和只包含注释的语句
        const cleaned = s.replace(/--.*$/gm, '').trim();
        return cleaned.length > 0 && !cleaned.match(/^[\s\n]*$/);
      });
    
    console.log(`📝 找到 ${statements.length} 条SQL语句\n`);
    
    let successCount = 0;
    let skipCount = 0;
    let errorCount = 0;
    
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      
      // 跳过注释和空语句
      if (statement.startsWith('--') || statement.length === 0) {
        continue;
      }
      
      try {
        // 检查是否是注释掉的语句
        if (statement.includes('-- DROP') || statement.includes('-- ALTER') || statement.includes('-- UPDATE')) {
          console.log(`⏭️  跳过注释掉的语句: ${statement.substring(0, 50)}...`);
          skipCount++;
          continue;
        }
        
        await connection.query(statement);
        successCount++;
        console.log(`✅ [${i + 1}/${statements.length}] 执行成功`);
        
        // 显示关键操作
        if (statement.includes('ALTER TABLE')) {
          const tableMatch = statement.match(/ALTER TABLE `?(\w+)`?/i);
          if (tableMatch) {
            console.log(`   📊 修改表: ${tableMatch[1]}`);
          }
        } else if (statement.includes('ADD COLUMN')) {
          const columnMatch = statement.match(/ADD COLUMN `?(\w+)`?/i);
          if (columnMatch) {
            console.log(`   ➕ 添加字段: ${columnMatch[1]}`);
          }
        } else if (statement.includes('ADD UNIQUE KEY')) {
          const keyMatch = statement.match(/ADD UNIQUE KEY `?(\w+)`?/i);
          if (keyMatch) {
            console.log(`   🔑 添加唯一索引: ${keyMatch[1]}`);
          }
        } else if (statement.includes('UPDATE')) {
          const tableMatch = statement.match(/UPDATE `?(\w+)`?/i);
          if (tableMatch) {
            console.log(`   🔄 更新数据: ${tableMatch[1]}`);
          }
        }
      } catch (error) {
        // 如果是字段已存在的错误，跳过
        if (error.code === 'ER_DUP_FIELDNAME' || error.code === 'ER_DUP_KEYNAME') {
          console.log(`⚠️  [${i + 1}/${statements.length}] 字段/索引已存在，跳过: ${error.message.split('\n')[0]}`);
          skipCount++;
        } else {
          console.error(`❌ [${i + 1}/${statements.length}] 执行失败:`, error.message);
          console.error(`   SQL: ${statement.substring(0, 100)}...`);
          errorCount++;
        }
      }
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('📊 迁移结果统计:');
    console.log(`   ✅ 成功: ${successCount}`);
    console.log(`   ⏭️  跳过: ${skipCount}`);
    console.log(`   ❌ 失败: ${errorCount}`);
    console.log('='.repeat(60) + '\n');
    
    // 验证表结构
    console.log('🔍 验证表结构...\n');
    
    // 检查 user_payout 表的新字段
    const [payoutColumns] = await connection.query(`
      SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_COMMENT
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'user_payout'
      AND COLUMN_NAME IN ('month', 'income_monthly_id', 'base_amount_usd', 'payout_currency', 'payout_amount', 'fx_rate')
      ORDER BY ORDINAL_POSITION
    `, [dbConfig.database]);
    
    if (payoutColumns.length > 0) {
      console.log('✅ user_payout 表新字段:');
      payoutColumns.forEach(col => {
        console.log(`   - ${col.COLUMN_NAME} (${col.DATA_TYPE}) - ${col.COLUMN_COMMENT || ''}`);
      });
    }
    
    // 检查 payout_gateway_transaction 表的新字段
    const [gatewayColumns] = await connection.query(`
      SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_COMMENT
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'payout_gateway_transaction'
      AND COLUMN_NAME IN ('base_amount_usd', 'payout_currency', 'payout_amount', 'fx_rate')
      ORDER BY ORDINAL_POSITION
    `, [dbConfig.database]);
    
    if (gatewayColumns.length > 0) {
      console.log('\n✅ payout_gateway_transaction 表新字段:');
      gatewayColumns.forEach(col => {
        console.log(`   - ${col.COLUMN_NAME} (${col.DATA_TYPE}) - ${col.COLUMN_COMMENT || ''}`);
      });
    }
    
    // 检查 user_income_monthly 表的 payout_id 字段
    const [incomeColumns] = await connection.query(`
      SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_COMMENT
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'user_income_monthly'
      AND COLUMN_NAME = 'payout_id'
    `, [dbConfig.database]);
    
    if (incomeColumns.length > 0) {
      console.log('\n✅ user_income_monthly 表新字段:');
      console.log(`   - payout_id (${incomeColumns[0].DATA_TYPE}) - ${incomeColumns[0].COLUMN_COMMENT || ''}`);
    }
    
    // 检查唯一索引
    const [indexes] = await connection.query(`
      SELECT INDEX_NAME, COLUMN_NAME
      FROM INFORMATION_SCHEMA.STATISTICS
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'user_payout'
      AND INDEX_NAME = 'uniq_user_month_payout'
    `, [dbConfig.database]);
    
    if (indexes.length > 0) {
      console.log('\n✅ user_payout 表唯一索引:');
      indexes.forEach(idx => {
        console.log(`   - ${idx.INDEX_NAME} (${idx.COLUMN_NAME})`);
      });
    }
    
    console.log('\n✅ 迁移完成！');
    
  } catch (error) {
    console.error('❌ 迁移失败:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n数据库连接已关闭');
    }
  }
}

// 执行迁移
runMigration().catch(error => {
  console.error('❌ 执行迁移时发生错误:', error);
  process.exit(1);
});

