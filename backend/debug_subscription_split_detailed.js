/**
 * 详细调试脚本：对比计算值和实际数据库值
 */

const mysql = require('mysql2/promise');
const Decimal = require('decimal.js');

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '123456',
  database: process.env.DB_NAME || 'kongfuworld',
  charset: 'utf8mb4'
};

function diffDays(a, b) {
  const ms = b.getTime() - a.getTime();
  return ms / (1000 * 60 * 60 * 24);
}

async function debugDetailed() {
  let db;
  
  try {
    db = await mysql.createConnection(dbConfig);
    
    const recordIds = [21, 22, 23, 27];
    const placeholders = recordIds.map(() => '?').join(',');
    
    // 查询订阅记录
    const [records] = await db.execute(
      `SELECT id, payment_amount, start_date, end_date, subscription_duration_days
       FROM user_champion_subscription_record
       WHERE id IN (${placeholders})`,
      recordIds
    );
    
    // 查询 reader_spending 记录
    const [spendingRecords] = await db.execute(
      `SELECT source_id, amount_usd, settlement_month
       FROM reader_spending
       WHERE source_type = 'subscription' AND source_id IN (${placeholders})
       ORDER BY source_id, settlement_month`,
      recordIds
    );
    
    console.log('='.repeat(100));
    console.log('详细对比分析\n');
    
    for (const record of records) {
      console.log(`\n📋 订阅记录 ID=${record.id}`);
      console.log(`   payment_amount: ${record.payment_amount} (原始类型: ${typeof record.payment_amount})`);
      console.log(`   start_date: ${record.start_date}`);
      console.log(`   end_date: ${record.end_date}`);
      console.log(`   subscription_duration_days: ${record.subscription_duration_days}`);
      
      const serviceStart = new Date(record.start_date);
      const serviceEnd = new Date(record.end_date);
      const actualDays = diffDays(serviceStart, serviceEnd);
      const totalDays = record.subscription_duration_days || actualDays;
      
      console.log(`   实际日期差: ${actualDays.toFixed(10)} 天`);
      console.log(`   使用的总天数: ${totalDays.toFixed(10)} 天`);
      
      // 找出所有相关月份
      const startMonth = new Date(serviceStart.getFullYear(), serviceStart.getMonth(), 1);
      const endMonth = new Date(serviceEnd.getFullYear(), serviceEnd.getMonth(), 1);
      const months = [];
      let current = new Date(startMonth);
      while (current <= endMonth) {
        months.push(new Date(current));
        current = new Date(current.getFullYear(), current.getMonth() + 1, 1);
      }
      
      const relatedSpending = spendingRecords.filter(r => r.source_id === record.id);
      console.log(`\n   已生成的 reader_spending 记录: ${relatedSpending.length} 条`);
      
      let totalCalculated = new Decimal(0);
      let totalActual = new Decimal(0);
      
      for (const month of months) {
        const monthStr = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}`;
        const monthStart = new Date(month.getFullYear(), month.getMonth(), 1, 0, 0, 0, 0);
        const monthEnd = new Date(month.getFullYear(), month.getMonth() + 1, 1, 0, 0, 0, 0);
        
        const overlapStart = serviceStart < monthStart ? monthStart : serviceStart;
        const overlapEnd = serviceEnd > monthEnd ? monthEnd : serviceEnd;
        const overlapDays = diffDays(overlapStart, overlapEnd);
        
        if (overlapDays <= 0) continue;
        
        // 计算应该的金额
        const calculatedAmount = new Decimal(record.payment_amount)
          .mul(overlapDays)
          .div(totalDays);
        
        // 查找实际记录
        const actualRecord = relatedSpending.find(r => r.settlement_month === `${monthStr}-01`);
        const actualAmount = actualRecord ? new Decimal(actualRecord.amount_usd) : new Decimal(0);
        
        totalCalculated = totalCalculated.add(calculatedAmount);
        totalActual = totalActual.add(actualAmount);
        
        console.log(`\n   ${monthStr}:`);
        console.log(`     重叠天数: ${overlapDays.toFixed(10)}`);
        console.log(`     计算金额: ${calculatedAmount.toFixed(10)} (Decimal: ${calculatedAmount.toString()})`);
        console.log(`     实际金额: ${actualAmount.toFixed(10)} (Decimal: ${actualAmount.toString()})`);
        if (actualRecord) {
          console.log(`     差异: ${calculatedAmount.sub(actualAmount).toFixed(10)}`);
        }
      }
      
      const paymentAmount = new Decimal(record.payment_amount);
      console.log(`\n   汇总:`);
      console.log(`     原始金额: ${paymentAmount.toFixed(10)} (Decimal: ${paymentAmount.toString()})`);
      console.log(`     计算总和: ${totalCalculated.toFixed(10)} (Decimal: ${totalCalculated.toString()})`);
      console.log(`     实际总和: ${totalActual.toFixed(10)} (Decimal: ${totalActual.toString()})`);
      console.log(`     计算总和 vs 原始: ${totalCalculated.sub(paymentAmount).toFixed(10)}`);
      console.log(`     实际总和 vs 原始: ${totalActual.sub(paymentAmount).toFixed(10)}`);
      
      // 测试 toNumber() 精度损失
      console.log(`\n   ⚠️  精度测试:`);
      const testAmount = new Decimal('2.808107639');
      console.log(`     Decimal('2.808107639').toNumber(): ${testAmount.toNumber()}`);
      console.log(`     Decimal('2.808107639').toString(): ${testAmount.toString()}`);
      console.log(`     数据库存储精度: DECIMAL(20,8)`);
      
      console.log('\n' + '-'.repeat(100));
    }
    
  } catch (error) {
    console.error('错误:', error);
  } finally {
    if (db) await db.end();
  }
}

debugDetailed();

