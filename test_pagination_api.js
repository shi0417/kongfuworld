const mysql = require('mysql2/promise');

// 测试分页API功能
async function testPaginationAPI() {
  console.log('🧪 测试分页API功能...\n');

  const dbConfig = {
    host: 'localhost',
    user: 'root',
    password: '123456',
    database: 'kongfuworld',
    charset: 'utf8mb4'
  };

  let db;
  try {
    db = await mysql.createConnection(dbConfig);

    // 1. 检查总记录数
    console.log('1. 检查总记录数...');
    const [countResult] = await db.execute(
      `SELECT COUNT(*) as total FROM key_transaction WHERE user_id = ?`,
      [1]
    );
    const totalRecords = countResult[0].total;
    console.log(`   总记录数: ${totalRecords}`);

    // 2. 测试分页查询
    console.log('\n2. 测试分页查询...');
    const page = 1;
    const limit = 10;
    const offset = (page - 1) * limit;

    const [transactions] = await db.execute(`
      SELECT 
        id,
        transaction_type,
        amount,
        balance_before,
        balance_after,
        reference_id,
        reference_type,
        description,
        created_at
      FROM key_transaction 
      WHERE user_id = ? 
      ORDER BY id DESC
      LIMIT ? OFFSET ?
    `, [1, limit, offset]);

    console.log(`   第${page}页记录数: ${transactions.length}`);
    console.log(`   每页限制: ${limit}`);
    console.log(`   偏移量: ${offset}`);

    // 3. 计算分页信息
    const totalPages = Math.ceil(totalRecords / limit);
    console.log(`   总页数: ${totalPages}`);

    // 4. 显示分页状态
    console.log('\n3. 分页状态...');
    if (totalPages > 1) {
      console.log(`   ✅ 应该显示分页 (总页数: ${totalPages})`);
      console.log(`   📊 分页信息:`);
      console.log(`      - 当前页: ${page}`);
      console.log(`      - 总页数: ${totalPages}`);
      console.log(`      - 总记录数: ${totalRecords}`);
      console.log(`      - 每页记录数: ${limit}`);
    } else {
      console.log(`   ❌ 不需要显示分页 (总页数: ${totalPages})`);
    }

    // 5. 显示前几条记录
    console.log('\n4. 前几条记录...');
    transactions.slice(0, 3).forEach((transaction, index) => {
      console.log(`   ${index + 1}. ID: ${transaction.id}, Type: ${transaction.transaction_type}, Amount: ${transaction.amount}`);
    });

  } catch (error) {
    console.error('❌ 测试失败:', error.message);
  } finally {
    if (db) await db.end();
  }
}

testPaginationAPI();
