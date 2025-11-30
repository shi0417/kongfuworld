/**
 * 调试脚本：检查 2025-10 编辑基础收入生成的数据情况
 * 重点检查 reader_spending.id=286 这条记录的数据链路
 */

const mysql = require('mysql2/promise');

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '123456',
  database: process.env.DB_NAME || 'kongfuworld',
  charset: 'utf8mb4'
};

async function checkData() {
  const db = await mysql.createConnection(dbConfig);
  const settlementMonth = '2025-10-01';
  
  try {
    console.log('='.repeat(80));
    console.log('检查 reader_spending.id=286 的数据链路');
    console.log('='.repeat(80));
    console.log('');
    
    // 1. 查询 reader_spending.id=286
    const [spending286] = await db.execute(
      `SELECT id, novel_id, amount_usd, source_type, source_id, spend_time, settlement_month
       FROM reader_spending
       WHERE id = 286`,
      []
    );
    
    console.log('【1. reader_spending.id=286】');
    console.table(spending286);
    console.log('');
    
    if (spending286.length === 0) {
      console.log('未找到 reader_spending.id=286 的记录');
      return;
    }
    
    const spending = spending286[0];
    
    // 2. 查询对应的 chapter_unlocks
    const [unlocks] = await db.execute(
      `SELECT id, chapter_id, user_id, unlock_method, cost, unlocked_at
       FROM chapter_unlocks
       WHERE id = ?`,
      [spending.source_id]
    );
    
    console.log('【2. chapter_unlocks (source_id=' + spending.source_id + ')】');
    console.table(unlocks);
    console.log('');
    
    if (unlocks.length === 0) {
      console.log('未找到对应的 chapter_unlocks 记录');
      return;
    }
    
    const unlock = unlocks[0];
    
    // 3. 查询对应的 chapter
    const [chapters] = await db.execute(
      `SELECT 
         id,
         novel_id,
         editor_admin_id,
         chief_editor_admin_id,
         word_count,
         review_status,
         is_released,
         CHAR_LENGTH(content) AS content_length,
         CASE
           WHEN (word_count IS NULL OR word_count = 0) THEN
             CHAR_LENGTH(content)
           ELSE
             word_count
         END AS effective_word_count
       FROM chapter
       WHERE id = ?`,
      [unlock.chapter_id]
    );
    
    console.log('【3. chapter.id=' + unlock.chapter_id + '】');
    console.table(chapters);
    console.log('');
    
    if (chapters.length === 0) {
      console.log('未找到对应的 chapter 记录');
      return;
    }
    
    const chapter = chapters[0];
    
    // 4. 查询 novel_id=13 的所有合同
    console.log('【4. novel_id=' + chapter.novel_id + ' 的所有合同（包括非active）】');
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
         status
       FROM novel_editor_contract
       WHERE novel_id = ?
       ORDER BY role, status, start_date DESC, id DESC`,
      [chapter.novel_id]
    );
    
    console.table(allContracts);
    console.log('');
    
    // 5. 查询 novel_id=13 的 active 合同（按当前代码逻辑）
    console.log('【5. novel_id=' + chapter.novel_id + ' 的 active 合同（按当前代码逻辑，不考虑日期）】');
    const [activeContractsNoDate] = await db.execute(
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
       WHERE novel_id = ?
         AND share_type = 'percent_of_book'
         AND status = 'active'
       ORDER BY role, start_date DESC, id DESC`,
      [chapter.novel_id]
    );
    
    console.table(activeContractsNoDate);
    console.log('');
    
    // 6. 查询 novel_id=13 的 active 合同（按修复后的代码逻辑，考虑日期）
    console.log('【6. novel_id=' + chapter.novel_id + ' 的 active 合同（修复后：考虑日期，settlementMonth=' + settlementMonth + '）】');
    const [activeContractsWithDate] = await db.execute(
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
       WHERE novel_id = ?
         AND share_type = 'percent_of_book'
         AND status = 'active'
         AND (start_date IS NULL OR start_date <= ?)
         AND (end_date IS NULL OR end_date >= ?)
       ORDER BY role, start_date DESC, id DESC`,
      [chapter.novel_id, settlementMonth, settlementMonth]
    );
    
    console.table(activeContractsWithDate);
    console.log('');
    
    // 7. 分析
    console.log('【7. 数据分析】');
    console.log('');
    console.log('数据链路：');
    console.log(`  reader_spending.id = ${spending.id}`);
    console.log(`  -> chapter_unlocks.id = ${unlock.id}`);
    console.log(`  -> chapter.id = ${chapter.id}`);
    console.log(`  -> chapter.novel_id = ${chapter.novel_id}`);
    console.log(`  -> chapter.editor_admin_id = ${chapter.editor_admin_id}`);
    console.log(`  -> chapter.chief_editor_admin_id = ${chapter.chief_editor_admin_id || 'NULL'}`);
    console.log('');
    
    console.log('合同情况：');
    console.log(`  novel_id=${chapter.novel_id} 的所有合同数: ${allContracts.length}`);
    console.log(`  novel_id=${chapter.novel_id} 的 active 合同数（不考虑日期）: ${activeContractsNoDate.length}`);
    console.log(`  novel_id=${chapter.novel_id} 的 active 合同数（考虑日期）: ${activeContractsWithDate.length}`);
    console.log('');
    
    if (activeContractsWithDate.length > 0) {
      const editorContracts = activeContractsWithDate.filter(c => c.role === 'editor');
      const chiefContracts = activeContractsWithDate.filter(c => c.role === 'chief_editor');
      
      console.log('  编辑合同:');
      editorContracts.forEach(c => {
        console.log(`    - ID: ${c.id}, editor_admin_id: ${c.editor_admin_id}, share_percent: ${c.share_percent}, start_date: ${c.start_date}, end_date: ${c.end_date || 'NULL'}`);
      });
      
      console.log('  主编合同:');
      chiefContracts.forEach(c => {
        console.log(`    - ID: ${c.id}, editor_admin_id: ${c.editor_admin_id}, share_percent: ${c.share_percent}, start_date: ${c.start_date}, end_date: ${c.end_date || 'NULL'}`);
      });
      
      console.log('');
      console.log('问题分析：');
      console.log(`  - 章节的 editor_admin_id = ${chapter.editor_admin_id}`);
      console.log(`  - 合同的 editor_admin_id = ${editorContracts.length > 0 ? editorContracts[0].editor_admin_id : 'NULL'}`);
      console.log(`  - 代码逻辑：按 novel_id + role 查找合同，不检查 chapter.editor_admin_id 是否匹配合同的 editor_admin_id`);
      console.log(`  - 结论：即使章节的 editor_admin_id=${chapter.editor_admin_id}，也应该使用 novel_id=${chapter.novel_id} 的编辑合同（editor_admin_id=${editorContracts.length > 0 ? editorContracts[0].editor_admin_id : 'NULL'}）来计算收入`);
    } else {
      console.log('  ⚠️ 没有找到符合条件的 active 合同！');
      console.log('');
      console.log('可能的原因：');
      console.log('  1. 合同 start_date > settlementMonth（合同在结算月之后才生效）');
      console.log('  2. 合同 end_date < settlementMonth（合同在结算月之前已结束）');
      console.log('  3. 合同 status != "active"');
      console.log('  4. 合同 share_type != "percent_of_book"');
    }
    
    // 8. 检查其他相关记录
    console.log('');
    console.log('【8. 检查其他 reader_spending 记录（前10条）】');
    const [otherSpendings] = await db.execute(
      `SELECT 
         rs.id,
         rs.novel_id,
         rs.source_id,
         cu.chapter_id,
         c.editor_admin_id,
         c.chief_editor_admin_id
       FROM reader_spending rs
       LEFT JOIN chapter_unlocks cu ON cu.id = rs.source_id
       LEFT JOIN chapter c ON c.id = cu.chapter_id
       WHERE rs.settlement_month = ?
         AND rs.source_type = 'chapter_unlock'
       ORDER BY rs.id
       LIMIT 10`,
      [settlementMonth]
    );
    
    console.table(otherSpendings);
    console.log('');
    
  } catch (error) {
    console.error('查询失败:', error);
  } finally {
    await db.end();
  }
}

// 执行
checkData().catch(console.error);

