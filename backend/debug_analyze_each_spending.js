/**
 * 详细分析每条 reader_spending 记录，找出为什么只生成了10条记录
 */

const mysql = require('mysql2/promise');

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '123456',
  database: process.env.DB_NAME || 'kongfuworld',
  charset: 'utf8mb4'
};

async function analyzeEachSpending() {
  const db = await mysql.createConnection(dbConfig);
  const settlementMonth = '2025-10-01';
  
  try {
    // 1. 查询所有 2025-10 的 reader_spending 记录
    const [spendings] = await db.execute(
      `SELECT id, novel_id, amount_usd, source_type, source_id, spend_time
       FROM reader_spending
       WHERE settlement_month = ?
       ORDER BY id`,
      [settlementMonth]
    );
    
    console.log('='.repeat(100));
    console.log(`分析 ${spendings.length} 条 reader_spending 记录`);
    console.log('='.repeat(100));
    console.log('');
    
    // 2. 预加载所有章节解锁上下文
    const unlockIds = [...new Set(spendings.map(s => s.source_id))];
    const unlockPlaceholders = unlockIds.map(() => '?').join(',');
    
    const [chapterUnlocks] = await db.query(
      `SELECT id, chapter_id FROM chapter_unlocks WHERE id IN (${unlockPlaceholders})`,
      unlockIds
    );
    
    const unlockMap = new Map();
    chapterUnlocks.forEach(cu => unlockMap.set(cu.id, cu.chapter_id));
    
    const chapterIds = [...new Set(chapterUnlocks.map(cu => cu.chapter_id))];
    const chapterPlaceholders = chapterIds.map(() => '?').join(',');
    
    const [chapters] = await db.query(
      `SELECT
         id,
         novel_id,
         editor_admin_id,
         chief_editor_admin_id,
         review_status,
         is_released,
         word_count,
         CASE
           WHEN (word_count IS NULL OR word_count = 0) THEN
             CHAR_LENGTH(content)
           ELSE
             word_count
         END AS effective_word_count
       FROM chapter
       WHERE id IN (${chapterPlaceholders})`,
      chapterIds
    );
    
    const chapterMap = new Map();
    chapters.forEach(ch => {
      chapterMap.set(ch.id, {
        novel_id: ch.novel_id,
        editor_admin_id: ch.editor_admin_id,
        chief_editor_admin_id: ch.chief_editor_admin_id,
        review_status: ch.review_status,
        is_released: ch.is_released,
        effective_word_count: parseInt(ch.effective_word_count) || 0
      });
    });
    
    // 3. 预加载所有合同
    const novelIds = [...new Set(spendings.map(s => s.novel_id))];
    const novelPlaceholders = novelIds.map(() => '?').join(',');
    
    const [contracts] = await db.execute(
      `SELECT
         id,
         novel_id,
         editor_admin_id,
         role,
         share_type,
         share_percent,
         status,
         start_date,
         end_date
       FROM novel_editor_contract
       WHERE novel_id IN (${novelPlaceholders})
         AND share_type = 'percent_of_book'
         AND status = 'active'
         AND (start_date IS NULL OR start_date <= ?)
         AND (end_date IS NULL OR end_date >= ?)
       ORDER BY novel_id, role, start_date DESC, id DESC`,
      [...novelIds, settlementMonth, settlementMonth]
    );
    
    const contractMap = new Map();
    novelIds.forEach(nid => {
      contractMap.set(nid, { editorContract: null, chiefContract: null });
    });
    
    contracts.forEach(contract => {
      const nc = contractMap.get(contract.novel_id);
      if (!nc) return;
      
      if (contract.role === 'editor' && !nc.editorContract) {
        nc.editorContract = contract;
      } else if (contract.role === 'chief_editor' && !nc.chiefContract) {
        nc.chiefContract = contract;
      }
    });
    
    // 4. 逐条分析
    let totalShouldGenerate = 0;
    let totalActuallyGenerated = 0;
    
    console.log('【逐条分析结果】');
    console.log('');
    
    for (const spending of spendings) {
      const chapterId = unlockMap.get(spending.source_id);
      const chapter = chapterId ? chapterMap.get(chapterId) : null;
      const contracts = contractMap.get(spending.novel_id);
      
      console.log(`--- reader_spending.id = ${spending.id} ---`);
      console.log(`  novel_id: ${spending.novel_id}`);
      console.log(`  amount_usd: ${spending.amount_usd}`);
      console.log(`  source_id (chapter_unlocks.id): ${spending.source_id}`);
      
      if (!chapterId) {
        console.log(`  ❌ 找不到对应的 chapter_unlocks.id=${spending.source_id}`);
        console.log('');
        continue;
      }
      
      console.log(`  chapter_id: ${chapterId}`);
      
      if (!chapter) {
        console.log(`  ❌ 找不到对应的 chapter.id=${chapterId}`);
        console.log('');
        continue;
      }
      
      console.log(`  chapter.editor_admin_id: ${chapter.editor_admin_id || 'NULL'}`);
      console.log(`  chapter.chief_editor_admin_id: ${chapter.chief_editor_admin_id || 'NULL'}`);
      console.log(`  chapter.review_status: ${chapter.review_status}`);
      console.log(`  chapter.is_released: ${chapter.is_released}`);
      
      // 检查编辑收入
      let shouldGenerateEditor = false;
      let shouldGenerateChief = false;
      
      if (chapter.editor_admin_id && chapter.editor_admin_id !== null) {
        if (contracts?.editorContract) {
          shouldGenerateEditor = true;
          console.log(`  ✅ 应该生成编辑收入:`);
          console.log(`      editor_admin_id: ${chapter.editor_admin_id}`);
          console.log(`      合同ID: ${contracts.editorContract.id}`);
          console.log(`      分成比例: ${contracts.editorContract.share_percent}`);
          console.log(`      收入: ${(parseFloat(spending.amount_usd) * parseFloat(contracts.editorContract.share_percent)).toFixed(6)}`);
          totalShouldGenerate++;
        } else {
          console.log(`  ❌ 不应该生成编辑收入: 没有编辑合同`);
          console.log(`      novel_id=${spending.novel_id} 没有 active 编辑合同`);
        }
      } else {
        console.log(`  ⚠️  不应该生成编辑收入: chapter.editor_admin_id 为 NULL`);
      }
      
      // 检查主编收入
      if (chapter.chief_editor_admin_id && chapter.chief_editor_admin_id !== null) {
        if (contracts?.chiefContract) {
          shouldGenerateChief = true;
          console.log(`  ✅ 应该生成主编收入:`);
          console.log(`      chief_editor_admin_id: ${chapter.chief_editor_admin_id}`);
          console.log(`      合同ID: ${contracts.chiefContract.id}`);
          console.log(`      分成比例: ${contracts.chiefContract.share_percent}`);
          console.log(`      收入: ${(parseFloat(spending.amount_usd) * parseFloat(contracts.chiefContract.share_percent)).toFixed(6)}`);
          totalShouldGenerate++;
        } else {
          console.log(`  ❌ 不应该生成主编收入: 没有主编合同`);
          console.log(`      novel_id=${spending.novel_id} 没有 active 主编合同`);
        }
      } else {
        console.log(`  ⚠️  不应该生成主编收入: chapter.chief_editor_admin_id 为 NULL`);
      }
      
      if (shouldGenerateEditor || shouldGenerateChief) {
        totalActuallyGenerated += (shouldGenerateEditor ? 1 : 0) + (shouldGenerateChief ? 1 : 0);
      }
      
      console.log('');
    }
    
    console.log('='.repeat(100));
    console.log('【汇总统计】');
    console.log(`  总 reader_spending 记录数: ${spendings.length}`);
    console.log(`  应该生成的 editor_income_monthly 记录数: ${totalShouldGenerate}`);
    console.log(`  实际生成的记录数: ${totalActuallyGenerated}`);
    console.log(`  缺失的记录数: ${totalShouldGenerate - totalActuallyGenerated}`);
    console.log('='.repeat(100));
    
  } catch (error) {
    console.error('分析失败:', error);
    console.error(error.stack);
  } finally {
    await db.end();
  }
}

analyzeEachSpending().catch(console.error);

