/**
 * 调试脚本：检查 2025-10 编辑基础收入生成的数据情况
 * 只读查询，不修改任何数据
 * 
 * 使用方法：node backend/debug_editor_income_2025_10.js
 */

const mysql = require('mysql2/promise');

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '123456',
  database: process.env.DB_NAME || 'kongfuworld',
  charset: 'utf8mb4'
};

async function debug2025_10() {
  const db = await mysql.createConnection(dbConfig);
  const settlementMonth = '2025-10-01';
  
  try {
    console.log('='.repeat(80));
    console.log('2025-10 编辑基础收入数据检查报告');
    console.log('='.repeat(80));
    console.log(`结算月份: ${settlementMonth}\n`);
    
    // ========== 1. 检查 reader_spending ==========
    console.log('【1. reader_spending 数据检查】');
    console.log('-'.repeat(80));
    
    // 1.1 按 source_type 统计
    const [spendingStats] = await db.execute(
      `SELECT 
         COUNT(*) AS total,
         SUM(amount_usd) AS total_amount_usd,
         source_type
       FROM reader_spending
       WHERE settlement_month = ?
       GROUP BY source_type`,
      [settlementMonth]
    );
    
    console.log('按 source_type 统计:');
    console.table(spendingStats);
    console.log('');
    
    // 1.2 查询所有记录（前20条）
    const [allSpendings] = await db.execute(
      `SELECT 
         id, 
         novel_id, 
         amount_usd, 
         source_type, 
         source_id, 
         settlement_month,
         spend_time
       FROM reader_spending
       WHERE settlement_month = ?
       ORDER BY id
       LIMIT 20`,
      [settlementMonth]
    );
    
    console.log(`前20条 reader_spending 记录（共 ${allSpendings.length} 条）:`);
    console.table(allSpendings);
    console.log('');
    
    // ========== 2. 检查章节解锁链路 ==========
    console.log('【2. 章节解锁链路检查】');
    console.log('-'.repeat(80));
    
    const chapterUnlockSpendings = allSpendings.filter(s => s.source_type === 'chapter_unlock');
    
    if (chapterUnlockSpendings.length > 0) {
      const unlockIds = chapterUnlockSpendings.map(s => s.source_id);
      const sampleUnlockId = unlockIds[0];
      
      // 查询一条完整的链路
      const [unlockChain] = await db.execute(
        `SELECT 
           rs.id AS reader_spending_id,
           rs.novel_id AS reader_spending_novel_id,
           rs.amount_usd,
           rs.source_id AS chapter_unlock_id,
           cu.chapter_id,
           c.id AS chapter_id_confirm,
           c.novel_id AS chapter_novel_id,
           c.editor_admin_id,
           c.chief_editor_admin_id,
           c.word_count,
           c.review_status,
           c.is_released
         FROM reader_spending rs
         LEFT JOIN chapter_unlocks cu ON cu.id = rs.source_id
         LEFT JOIN chapter c ON c.id = cu.chapter_id
         WHERE rs.id = ?
           AND rs.source_type = 'chapter_unlock'`,
        [chapterUnlockSpendings[0].id]
      );
      
      console.log(`示例链路（reader_spending.id = ${chapterUnlockSpendings[0].id}）:`);
      console.table(unlockChain);
      console.log('');
      
      // 检查所有章节解锁的章节信息
      const [allUnlockChapters] = await db.execute(
        `SELECT 
           rs.id AS reader_spending_id,
           rs.novel_id,
           cu.chapter_id,
           c.editor_admin_id,
           c.chief_editor_admin_id,
           c.word_count,
           c.review_status
         FROM reader_spending rs
         LEFT JOIN chapter_unlocks cu ON cu.id = rs.source_id
         LEFT JOIN chapter c ON c.id = cu.chapter_id
         WHERE rs.settlement_month = ?
           AND rs.source_type = 'chapter_unlock'
         ORDER BY rs.id`,
        [settlementMonth]
      );
      
      console.log('所有章节解锁对应的章节信息:');
      console.table(allUnlockChapters);
      console.log('');
    } else {
      console.log('没有章节解锁记录\n');
    }
    
    // ========== 3. 检查合同 ==========
    console.log('【3. novel_editor_contract 合同检查】');
    console.log('-'.repeat(80));
    
    // 获取所有涉及的小说ID
    const novelIds = [...new Set(allSpendings.map(s => s.novel_id))];
    console.log(`涉及的小说ID: ${novelIds.join(', ')}\n`);
    
    // 查询这些小说的所有合同
    const [allContracts] = await db.execute(
      `SELECT 
         id,
         novel_id,
         editor_admin_id,
         role,
         share_type,
         share_percent,
         start_date,
         end_date,
         status,
         start_chapter_id,
         end_chapter_id
       FROM novel_editor_contract
       WHERE novel_id IN (?)
       ORDER BY novel_id, role, status, start_date DESC, id DESC`,
      [novelIds]
    );
    
    console.log('所有相关合同（包括非active）:');
    console.table(allContracts);
    console.log('');
    
    // 查询 active 合同（按代码逻辑）
    const [activeContracts] = await db.execute(
      `SELECT 
         id,
         novel_id,
         editor_admin_id,
         role,
         share_type,
         share_percent,
         start_date,
         end_date,
         status
       FROM novel_editor_contract
       WHERE novel_id IN (?)
         AND share_type = 'percent_of_book'
         AND status = 'active'
       ORDER BY novel_id, role, start_date DESC, id DESC`,
      [novelIds]
    );
    
    console.log('Active 合同（按代码逻辑筛选）:');
    console.table(activeContracts);
    console.log('');
    
    // 按小说分组显示合同
    console.log('按小说分组的合同情况:');
    for (const novelId of novelIds) {
      const novelContracts = activeContracts.filter(c => c.novel_id === novelId);
      const editorContracts = novelContracts.filter(c => c.role === 'editor');
      const chiefContracts = novelContracts.filter(c => c.role === 'chief_editor');
      
      console.log(`\n小说 ${novelId}:`);
      console.log(`  编辑合同: ${editorContracts.length} 条`);
      if (editorContracts.length > 0) {
        editorContracts.forEach(c => {
          console.log(`    - ID: ${c.id}, 编辑ID: ${c.editor_admin_id}, 分成: ${c.share_percent}, 开始日期: ${c.start_date}, 结束日期: ${c.end_date || 'NULL'}`);
        });
      }
      console.log(`  主编合同: ${chiefContracts.length} 条`);
      if (chiefContracts.length > 0) {
        chiefContracts.forEach(c => {
          console.log(`    - ID: ${c.id}, 主编ID: ${c.editor_admin_id}, 分成: ${c.share_percent}, 开始日期: ${c.start_date}, 结束日期: ${c.end_date || 'NULL'}`);
        });
      }
      
      // 检查日期过滤问题
      if (editorContracts.length > 0 || chiefContracts.length > 0) {
        console.log(`  日期检查（结算月: ${settlementMonth}）:`);
        editorContracts.forEach(c => {
          const startDate = new Date(c.start_date);
          const settlementDate = new Date(settlementMonth);
          const isBefore = startDate <= settlementDate;
          console.log(`    编辑合同 ${c.id}: start_date=${c.start_date}, ${isBefore ? '✅ 在结算月之前' : '❌ 在结算月之后'}`);
        });
        chiefContracts.forEach(c => {
          const startDate = new Date(c.start_date);
          const settlementDate = new Date(settlementMonth);
          const isBefore = startDate <= settlementDate;
          console.log(`    主编合同 ${c.id}: start_date=${c.start_date}, ${isBefore ? '✅ 在结算月之前' : '❌ 在结算月之后'}`);
        });
      }
    }
    console.log('');
    
    // ========== 4. 检查 editor_income_monthly ==========
    console.log('【4. editor_income_monthly 现有数据检查】');
    console.log('-'.repeat(80));
    
    // 4.1 检查 2025-10 的记录
    const [month2025_10] = await db.execute(
      `SELECT COUNT(*) AS cnt
       FROM editor_income_monthly
       WHERE month = ?`,
      [settlementMonth]
    );
    
    console.log(`2025-10 的记录数: ${month2025_10[0].cnt}`);
    console.log('');
    
    // 4.2 检查所有月份的记录数
    const [allMonths] = await db.execute(
      `SELECT 
         month,
         COUNT(*) AS record_count,
         SUM(editor_income_usd) AS total_income
       FROM editor_income_monthly
       GROUP BY month
       ORDER BY month DESC
       LIMIT 10`
    );
    
    console.log('最近10个月的记录统计:');
    console.table(allMonths);
    console.log('');
    
    // ========== 5. 问题分析 ==========
    console.log('【5. 问题分析】');
    console.log('-'.repeat(80));
    
    console.log('根据代码逻辑分析:');
    console.log('1. loadNovelRoleContracts 函数查询条件:');
    console.log('   - novel_id IN (?)');
    console.log('   - share_type = \'percent_of_book\'');
    console.log('   - status = \'active\'');
    console.log('   ⚠️ 注意：代码中没有检查 start_date 和 end_date！');
    console.log('');
    console.log('2. 如果日志显示"编辑合同=0, 主编合同=0"，可能的原因:');
    console.log('   a) 这些小说确实没有 active 状态的合同');
    console.log('   b) 合同存在但 share_type 不是 \'percent_of_book\'');
    console.log('   c) 合同存在但 status 不是 \'active\'');
    console.log('');
    console.log('3. 如果合同 start_date > settlementMonth，代码仍然会使用该合同');
    console.log('   （因为代码中没有日期过滤）');
    console.log('');
    
  } catch (error) {
    console.error('查询失败:', error);
  } finally {
    await db.end();
  }
}

// 执行
debug2025_10().catch(console.error);

