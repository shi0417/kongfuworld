// 测试Key变动记录系统
const mysql = require('mysql2/promise');
const { recordKeyTransaction, getUserKeyTransactions, getUserKeyStats } = require('./key_transaction_helper');

// 数据库配置
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '123456',
  database: process.env.DB_NAME || 'kongfuworld',
  charset: 'utf8mb4'
};

async function testKeyTransactionSystem() {
  let db;
  try {
    db = await mysql.createConnection(dbConfig);
    
    console.log('\n🔑 测试Key变动记录系统\n');
    
    const userId = 1;
    
    // 1. 测试签到奖励
    console.log('📝 测试签到奖励:');
    try {
      const checkinResult = await recordKeyTransaction(
        db, 
        userId, 
        'checkin', 
        5, 
        null, 
        'daily_checkin', 
        '每日签到奖励: +5 keys'
      );
      console.log(`   ✅ 签到奖励成功: 变动前${checkinResult.balanceBefore}, 变动后${checkinResult.balanceAfter}`);
    } catch (error) {
      console.log(`   ❌ 签到奖励失败: ${error.message}`);
    }
    
    // 2. 测试任务奖励
    console.log('\n📝 测试任务奖励:');
    try {
      const missionResult = await recordKeyTransaction(
        db, 
        userId, 
        'mission', 
        2, 
        1, 
        'mission', 
        '完成任务奖励: +2 keys'
      );
      console.log(`   ✅ 任务奖励成功: 变动前${missionResult.balanceBefore}, 变动后${missionResult.balanceAfter}`);
    } catch (error) {
      console.log(`   ❌ 任务奖励失败: ${error.message}`);
    }
    
    // 3. 测试解锁消费
    console.log('\n📝 测试解锁消费:');
    try {
      const unlockResult = await recordKeyTransaction(
        db, 
        userId, 
        'unlock', 
        -1, 
        100, 
        'chapter', 
        '解锁章节消费: -1 keys'
      );
      console.log(`   ✅ 解锁消费成功: 变动前${unlockResult.balanceBefore}, 变动后${unlockResult.balanceAfter}`);
    } catch (error) {
      console.log(`   ❌ 解锁消费失败: ${error.message}`);
    }
    
    // 4. 测试余额不足的情况
    console.log('\n📝 测试余额不足:');
    try {
      const insufficientResult = await recordKeyTransaction(
        db, 
        userId, 
        'unlock', 
        -1000, 
        101, 
        'chapter', 
        '测试余额不足: -1000 keys'
      );
      console.log(`   ❌ 余额不足测试失败: 应该失败但成功了`);
    } catch (error) {
      console.log(`   ✅ 余额不足测试成功: ${error.message}`);
    }
    
    // 5. 获取用户Key变动记录
    console.log('\n📊 获取用户Key变动记录:');
    try {
      const transactions = await getUserKeyTransactions(db, userId, 10, 0);
      console.log(`   📋 最近${transactions.length}条记录:`);
      transactions.forEach((tx, index) => {
        console.log(`   ${index + 1}. ${tx.transaction_description} - 余额: ${tx.balance_before} → ${tx.balance_after} (${tx.created_at})`);
      });
    } catch (error) {
      console.log(`   ❌ 获取变动记录失败: ${error.message}`);
    }
    
    // 6. 获取用户Key统计信息
    console.log('\n📊 获取用户Key统计信息:');
    try {
      const stats = await getUserKeyStats(db, userId);
      console.log(`   💰 当前余额: ${stats.currentBalance}`);
      console.log(`   📈 总收入: ${stats.totalEarned}`);
      console.log(`   📉 总支出: ${stats.totalSpent}`);
      console.log(`   🔢 总交易数: ${stats.totalTransactions}`);
      console.log(`   ⏰ 最后交易时间: ${stats.lastTransactionTime}`);
    } catch (error) {
      console.log(`   ❌ 获取统计信息失败: ${error.message}`);
    }
    
    // 7. 查看key_transaction表结构
    console.log('\n📊 查看key_transaction表结构:');
    try {
      const [columns] = await db.execute(`DESCRIBE key_transaction`);
      console.log('   表结构:');
      columns.forEach(column => {
        console.log(`   ${column.Field}: ${column.Type} ${column.Null === 'NO' ? 'NOT NULL' : 'NULL'} ${column.Default ? `DEFAULT ${column.Default}` : ''}`);
      });
    } catch (error) {
      console.log(`   ❌ 查看表结构失败: ${error.message}`);
    }
    
    // 8. 查看最近几条记录
    console.log('\n📊 查看最近几条记录:');
    try {
      const [recentRecords] = await db.execute(`
        SELECT 
          kt.*,
          u.username,
          CASE 
            WHEN kt.transaction_type = 'checkin' THEN CONCAT('签到奖励: +', kt.amount, ' keys')
            WHEN kt.transaction_type = 'mission' THEN CONCAT('任务奖励: +', kt.amount, ' keys')
            WHEN kt.transaction_type = 'unlock' THEN CONCAT('解锁章节: -', ABS(kt.amount), ' keys')
            WHEN kt.transaction_type = 'purchase' THEN CONCAT('购买获得: +', kt.amount, ' keys')
            WHEN kt.transaction_type = 'refund' THEN CONCAT('退款: +', kt.amount, ' keys')
            ELSE CONCAT('其他: ', IF(kt.amount > 0, '+', ''), kt.amount, ' keys')
          END as transaction_description
        FROM key_transaction kt
        JOIN user u ON kt.user_id = u.id
        WHERE kt.user_id = ?
        ORDER BY kt.created_at DESC
        LIMIT 5
      `, [userId]);
      
      console.log('   最近记录:');
      recentRecords.forEach((record, index) => {
        console.log(`   ${index + 1}. ${record.transaction_description} - 余额: ${record.balance_before} → ${record.balance_after} (${record.created_at})`);
      });
    } catch (error) {
      console.log(`   ❌ 查看最近记录失败: ${error.message}`);
    }
    
    console.log('\n✅ Key变动记录系统测试完成');
    
  } catch (error) {
    console.error('测试失败:', error);
  } finally {
    if (db) await db.end();
  }
}

// 运行测试
testKeyTransactionSystem();
