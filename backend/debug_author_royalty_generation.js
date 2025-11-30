/**
 * 调试脚本：排查 author_royalty 生成问题
 * 
 * 使用方法：
 * node backend/debug_author_royalty_generation.js
 */

const mysql = require('mysql2/promise');

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '123456',
  database: process.env.DB_NAME || 'kongfuworld',
  charset: 'utf8mb4'
};

async function debugAuthorRoyaltyGeneration() {
  let db;
  
  try {
    console.log('🔍 开始排查 author_royalty 生成问题...\n');
    
    db = await mysql.createConnection(dbConfig);
    
    const month = '2025-11';
    const settlementMonth = `${month}-01`;
    
    console.log('📅 月份参数:');
    console.log(`  前端传入: ${month}`);
    console.log(`  转换后 settlement_month: ${settlementMonth}\n`);
    
    // Step 1: 检查 reader_spending 数据
    console.log('📊 Step 1: 检查 reader_spending 数据');
    const [spendings] = await db.execute(
      `SELECT 
        rs.id,
        rs.user_id,
        rs.novel_id,
        rs.amount_usd,
        rs.spend_time,
        rs.source_type,
        rs.settlement_month
      FROM reader_spending rs
      WHERE rs.settlement_month = ?
      ORDER BY rs.spend_time`,
      [settlementMonth]
    );
    
    console.log(`  查询到的记录数: ${spendings.length}`);
    if (spendings.length === 0) {
      console.log('  ❌ 没有找到 reader_spending 数据！');
      console.log('  请先运行「生成基础收入数据」功能。');
      return;
    }
    
    console.log(`  ✅ 找到 ${spendings.length} 条 reader_spending 记录\n`);
    
    // 显示前几条记录
    console.log('  前 5 条记录详情:');
    spendings.slice(0, 5).forEach((rs, idx) => {
      console.log(`    [${idx + 1}] id=${rs.id}, novel_id=${rs.novel_id}, amount_usd=${rs.amount_usd}, source_type=${rs.source_type}`);
    });
    console.log('');
    
    // Step 2: 检查 novel 表的作者ID
    console.log('📚 Step 2: 检查 novel 表的作者ID');
    const novelIds = [...new Set(spendings.map(s => s.novel_id))];
    console.log(`  涉及的 novel_id: ${novelIds.join(', ')}\n`);
    
    const [novels] = await db.execute(
      `SELECT id, user_id, title FROM novel WHERE id IN (${novelIds.map(() => '?').join(',')})`,
      novelIds
    );
    
    console.log(`  查询到的 novel 记录数: ${novels.length}`);
    
    const novelMap = new Map();
    novels.forEach(n => {
      novelMap.set(n.id, n);
      console.log(`    novel_id=${n.id}, user_id=${n.user_id || 'NULL'}, title=${n.title || '未知'}`);
    });
    console.log('');
    
    // Step 3: 检查哪些记录会被跳过
    console.log('⚠️  Step 3: 检查哪些记录会被跳过');
    let validCount = 0;
    let skippedCount = 0;
    const skippedDetails = [];
    
    for (const spending of spendings) {
      const novel = novelMap.get(spending.novel_id);
      if (!novel || !novel.user_id) {
        skippedCount++;
        skippedDetails.push({
          spending_id: spending.id,
          novel_id: spending.novel_id,
          reason: !novel ? 'novel 不存在' : 'novel.user_id 为 NULL'
        });
      } else {
        validCount++;
      }
    }
    
    console.log(`  有效记录数: ${validCount}`);
    console.log(`  跳过记录数: ${skippedCount}`);
    
    if (skippedDetails.length > 0) {
      console.log('\n  跳过的记录详情:');
      skippedDetails.forEach(detail => {
        console.log(`    reader_spending.id=${detail.spending_id}, novel_id=${detail.novel_id}, 原因: ${detail.reason}`);
      });
    }
    console.log('');
    
    // Step 4: 检查 author_royalty_plan（默认方案）
    console.log('💰 Step 4: 检查 author_royalty_plan（默认方案）');
    const [defaultPlans] = await db.execute(
      'SELECT id, name, royalty_percent, is_default, start_date FROM author_royalty_plan WHERE is_default = 1 ORDER BY start_date DESC LIMIT 1'
    );
    
    if (defaultPlans.length > 0) {
      const plan = defaultPlans[0];
      console.log(`  ✅ 找到默认方案:`);
      console.log(`    id=${plan.id}, name=${plan.name}, royalty_percent=${plan.royalty_percent}, start_date=${plan.start_date}`);
    } else {
      console.log(`  ⚠️  没有找到默认方案（is_default=1），将使用硬编码的 50%`);
    }
    console.log('');
    
    // Step 5: 检查是否已经生成过 author_royalty
    console.log('📋 Step 5: 检查是否已经生成过 author_royalty');
    const [existing] = await db.execute(
      'SELECT COUNT(*) as count FROM author_royalty WHERE settlement_month = ?',
      [settlementMonth]
    );
    
    console.log(`  已存在的 author_royalty 记录数: ${existing[0].count}`);
    if (existing[0].count > 0) {
      console.log(`  ⚠️  该月份数据已存在，需要先删除才能重新生成`);
      
      // 显示已存在的记录
      const [existingRecords] = await db.execute(
        `SELECT id, author_id, novel_id, gross_amount_usd, author_amount_usd 
         FROM author_royalty 
         WHERE settlement_month = ? 
         LIMIT 5`,
        [settlementMonth]
      );
      console.log('\n  前 5 条已存在的记录:');
      existingRecords.forEach((ar, idx) => {
        console.log(`    [${idx + 1}] id=${ar.id}, author_id=${ar.author_id}, novel_id=${ar.novel_id}, gross=${ar.gross_amount_usd}, author=${ar.author_amount_usd}`);
      });
    }
    console.log('');
    
    // Step 6: 模拟生成过程（不实际插入）
    if (validCount > 0 && existing[0].count === 0) {
      console.log('🧪 Step 6: 模拟生成过程（不实际插入）');
      console.log('  将处理的有效记录:');
      
      let processedCount = 0;
      for (const spending of spendings) {
        const novel = novelMap.get(spending.novel_id);
        if (!novel || !novel.user_id) {
          continue;
        }
        
        processedCount++;
        const authorId = novel.user_id;
        
        // 查找合同（简化版，不查时间）
        const [contracts] = await db.execute(
          `SELECT plan_id 
           FROM novel_royalty_contract 
           WHERE novel_id = ? AND author_id = ?
           ORDER BY effective_from DESC LIMIT 1`,
          [spending.novel_id, authorId]
        );
        
        let royaltyPercent = 0.5;
        if (contracts.length > 0 && defaultPlans.length > 0) {
          // 简化：假设使用默认方案
          royaltyPercent = parseFloat(defaultPlans[0].royalty_percent);
        }
        
        const grossAmountUsd = parseFloat(spending.amount_usd);
        const authorAmountUsd = grossAmountUsd * royaltyPercent;
        
        console.log(`    [${processedCount}] reader_spending.id=${spending.id}, novel_id=${spending.novel_id}, author_id=${authorId}`);
        console.log(`        gross_amount_usd=${grossAmountUsd}, royalty_percent=${royaltyPercent}, author_amount_usd=${authorAmountUsd.toFixed(8)}`);
        
        if (processedCount >= 5) {
          console.log(`    ... (还有 ${validCount - processedCount} 条记录)`);
          break;
        }
      }
      console.log('');
    }
    
    // 总结
    console.log('📝 总结:');
    console.log(`  1. reader_spending 记录数: ${spendings.length}`);
    console.log(`  2. 有效的记录数（有作者）: ${validCount}`);
    console.log(`  3. 跳过的记录数（无作者）: ${skippedCount}`);
    console.log(`  4. 已存在的 author_royalty 记录数: ${existing[0].count}`);
    
    if (spendings.length === 0) {
      console.log('\n  ❌ 问题：没有 reader_spending 数据，请先运行「生成基础收入数据」');
    } else if (validCount === 0) {
      console.log('\n  ❌ 问题：所有 reader_spending 记录对应的 novel 都没有作者（user_id 为 NULL）');
      console.log('  解决方案：检查 novel 表，确保对应的 novel.user_id 有值');
    } else if (existing[0].count > 0) {
      console.log('\n  ⚠️  问题：该月份数据已存在，需要先删除才能重新生成');
      console.log('  解决方案：在「作者基础收入表」页面点击「删除」按钮');
    } else {
      console.log('\n  ✅ 理论上应该可以生成数据');
      console.log('  如果仍然无法生成，请检查后端服务器日志中的错误信息');
    }
    
  } catch (error) {
    console.error('\n❌ 调试过程出错:', error);
    console.error('错误堆栈:', error.stack);
  } finally {
    if (db) {
      await db.end();
      console.log('\n🔌 数据库连接已关闭');
    }
  }
}

debugAuthorRoyaltyGeneration();

