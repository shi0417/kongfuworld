/**
 * 调试脚本：检查合同加载逻辑
 */

const mysql = require('mysql2/promise');

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '123456',
  database: process.env.DB_NAME || 'kongfuworld',
  charset: 'utf8mb4'
};

async function checkContracts() {
  const db = await mysql.createConnection(dbConfig);
  const settlementMonth = '2025-10-01';
  
  try {
    // 1. 查询所有 2025-10 的 reader_spending
    const [spendings] = await db.execute(
      `SELECT id, novel_id, amount_usd, source_type, source_id
       FROM reader_spending
       WHERE settlement_month = ?`,
      [settlementMonth]
    );
    
    console.log('【1. 2025-10 的所有 reader_spending】');
    console.log(`总数: ${spendings.length}`);
    const novelIds = [...new Set(spendings.map(s => s.novel_id))];
    console.log(`涉及的小说ID: ${novelIds.join(', ')}`);
    console.log('');
    
    // 2. 查询这些小说的所有合同（按当前代码逻辑）
    console.log('【2. 这些小说的所有合同（按当前代码逻辑）】');
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
         end_date,
         start_chapter_id,
         end_chapter_id
       FROM novel_editor_contract
       WHERE novel_id IN (?)
         AND share_type = 'percent_of_book'
         AND status = 'active'
         AND (start_date IS NULL OR start_date <= ?)
         AND (end_date IS NULL OR end_date >= ?)
       ORDER BY novel_id, role, start_date DESC, id DESC`,
      [novelIds, settlementMonth, settlementMonth]
    );
    
    console.log(`查询到的合同总数: ${contracts.length}`);
    console.table(contracts);
    console.log('');
    
    // 3. 按 novel_id + role 分组
    console.log('【3. 按 novel_id + role 分组后的合同】');
    const contractMap = new Map();
    
    for (const novelId of novelIds) {
      contractMap.set(novelId, {
        editorContract: null,
        chiefContract: null
      });
    }
    
    for (const contract of contracts) {
      const nc = contractMap.get(contract.novel_id);
      if (!nc) continue;
      
      if (contract.role === 'editor' && !nc.editorContract) {
        nc.editorContract = contract;
      } else if (contract.role === 'chief_editor' && !nc.chiefContract) {
        nc.chiefContract = contract;
      }
    }
    
    for (const [novelId, nc] of contractMap.entries()) {
      console.log(`novel_id=${novelId}:`);
      if (nc.editorContract) {
        console.log(`  编辑合同: ID=${nc.editorContract.id}, editor_admin_id=${nc.editorContract.editor_admin_id}, share_percent=${nc.editorContract.share_percent}`);
      } else {
        console.log(`  编辑合同: 无`);
      }
      if (nc.chiefContract) {
        console.log(`  主编合同: ID=${nc.chiefContract.id}, editor_admin_id=${nc.chiefContract.editor_admin_id}, share_percent=${nc.chiefContract.share_percent}`);
      } else {
        console.log(`  主编合同: 无`);
      }
    }
    console.log('');
    
    // 4. 统计
    const editorContractCount = Array.from(contractMap.values()).filter(nc => nc.editorContract).length;
    const chiefContractCount = Array.from(contractMap.values()).filter(nc => nc.chiefContract).length;
    
    console.log('【4. 统计结果】');
    console.log(`小说数: ${novelIds.length}`);
    console.log(`其中有编辑合同: ${editorContractCount}`);
    console.log(`有主编合同: ${chiefContractCount}`);
    console.log('');
    
    // 5. 检查为什么没有找到合同
    if (contracts.length === 0) {
      console.log('【5. 为什么没有找到合同？检查所有相关合同】');
      const [allContracts] = await db.execute(
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
         WHERE novel_id IN (?)
         ORDER BY novel_id, role, start_date DESC, id DESC`,
        [novelIds]
      );
      
      console.log(`所有相关合同（包括非active）: ${allContracts.length}`);
      console.table(allContracts);
      console.log('');
      
      // 分析每个合同为什么不符合条件
      for (const contract of allContracts) {
        console.log(`合同 ID=${contract.id}, novel_id=${contract.novel_id}, role=${contract.role}:`);
        if (contract.share_type !== 'percent_of_book') {
          console.log(`  ❌ share_type='${contract.share_type}' != 'percent_of_book'`);
        }
        if (contract.status !== 'active') {
          console.log(`  ❌ status='${contract.status}' != 'active'`);
        }
        if (contract.start_date && new Date(contract.start_date) > new Date(settlementMonth)) {
          console.log(`  ❌ start_date='${contract.start_date}' > settlementMonth='${settlementMonth}'`);
        }
        if (contract.end_date && new Date(contract.end_date) < new Date(settlementMonth)) {
          console.log(`  ❌ end_date='${contract.end_date}' < settlementMonth='${settlementMonth}'`);
        }
        if (contract.share_type === 'percent_of_book' && 
            contract.status === 'active' &&
            (!contract.start_date || new Date(contract.start_date) <= new Date(settlementMonth)) &&
            (!contract.end_date || new Date(contract.end_date) >= new Date(settlementMonth))) {
          console.log(`  ✅ 符合所有条件！`);
        }
      }
    }
    
  } catch (error) {
    console.error('查询失败:', error);
  } finally {
    await db.end();
  }
}

// 执行
checkContracts().catch(console.error);

