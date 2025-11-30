/**
 * 调试脚本：直接查询合同
 */

const mysql = require('mysql2/promise');

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '123456',
  database: process.env.DB_NAME || 'kongfuworld',
  charset: 'utf8mb4'
};

async function checkContractsDirect() {
  const db = await mysql.createConnection(dbConfig);
  const settlementMonth = '2025-10-01';
  
  try {
    // 1. 直接查询 novel_id=13 的所有合同
    console.log('【1. novel_id=13 的所有合同（不设任何条件）】');
    const [allContracts13] = await db.execute(
      `SELECT * FROM novel_editor_contract WHERE novel_id = 13`,
      []
    );
    console.log(`总数: ${allContracts13.length}`);
    console.table(allContracts13);
    console.log('');
    
    // 2. 查询 novel_id IN (13, 11, 7, 10, 1) 的所有合同
    console.log('【2. novel_id IN (13, 11, 7, 10, 1) 的所有合同（不设任何条件）】');
    const [allContracts] = await db.execute(
      `SELECT * FROM novel_editor_contract WHERE novel_id IN (13, 11, 7, 10, 1)`,
      []
    );
    console.log(`总数: ${allContracts.length}`);
    console.table(allContracts);
    console.log('');
    
    // 3. 检查日期比较
    if (allContracts.length > 0) {
      console.log('【3. 检查日期比较（settlementMonth=' + settlementMonth + '）】');
      for (const contract of allContracts) {
        console.log(`合同 ID=${contract.id}, novel_id=${contract.novel_id}:`);
        console.log(`  share_type: ${contract.share_type}`);
        console.log(`  status: ${contract.status}`);
        console.log(`  start_date: ${contract.start_date} (类型: ${typeof contract.start_date})`);
        console.log(`  end_date: ${contract.end_date} (类型: ${typeof contract.end_date})`);
        
        if (contract.start_date) {
          const startDate = new Date(contract.start_date);
          const settlementDate = new Date(settlementMonth);
          console.log(`  start_date <= settlementMonth: ${startDate <= settlementDate} (${startDate.toISOString()} <= ${settlementDate.toISOString()})`);
        }
        
        if (contract.end_date) {
          const endDate = new Date(contract.end_date);
          const settlementDate = new Date(settlementMonth);
          console.log(`  end_date >= settlementMonth: ${endDate >= settlementDate} (${endDate.toISOString()} >= ${settlementDate.toISOString()})`);
        }
        
        // 检查是否符合条件
        const matchesShareType = contract.share_type === 'percent_of_book';
        const matchesStatus = contract.status === 'active';
        const matchesStartDate = !contract.start_date || new Date(contract.start_date) <= new Date(settlementMonth);
        const matchesEndDate = !contract.end_date || new Date(contract.end_date) >= new Date(settlementMonth);
        
        console.log(`  符合 share_type='percent_of_book': ${matchesShareType}`);
        console.log(`  符合 status='active': ${matchesStatus}`);
        console.log(`  符合 start_date 条件: ${matchesStartDate}`);
        console.log(`  符合 end_date 条件: ${matchesEndDate}`);
        console.log(`  总体符合: ${matchesShareType && matchesStatus && matchesStartDate && matchesEndDate}`);
        console.log('');
      }
    }
    
    // 4. 使用 SQL 直接测试查询
    console.log('【4. 使用 SQL 直接测试查询】');
    const [testContracts] = await db.execute(
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
       WHERE novel_id IN (13, 11, 7, 10, 1)
         AND share_type = 'percent_of_book'
         AND status = 'active'
         AND (start_date IS NULL OR start_date <= ?)
         AND (end_date IS NULL OR end_date >= ?)`,
      [settlementMonth, settlementMonth]
    );
    console.log(`查询结果数: ${testContracts.length}`);
    console.table(testContracts);
    console.log('');
    
  } catch (error) {
    console.error('查询失败:', error);
    console.error(error.stack);
  } finally {
    await db.end();
  }
}

// 执行
checkContractsDirect().catch(console.error);

