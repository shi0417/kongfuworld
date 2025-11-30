/**
 * 调试脚本：分析 Champion 订阅拆分到 reader_spending 的金额计算问题
 * 
 * 使用方法：
 * node backend/debug_subscription_split.js
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

// 工具函数：计算两个日期之间的天数差（毫秒精度）
function diffDays(a, b) {
  const ms = b.getTime() - a.getTime();
  return ms / (1000 * 60 * 60 * 24);
}

async function debugSubscriptionSplit() {
  let db;
  
  try {
    console.log('🔌 正在连接数据库...');
    db = await mysql.createConnection(dbConfig);
    console.log('✅ 数据库连接成功\n');
    
    // 需要分析的订阅记录ID
    const recordIds = [21, 22, 23, 27];
    
    // 查询这些订阅记录的详细信息
    const placeholders = recordIds.map(() => '?').join(',');
    const [records] = await db.execute(
      `SELECT
         id,
         user_id,
         novel_id,
         payment_amount,
         start_date,
         end_date,
         subscription_duration_days,
         created_at
       FROM user_champion_subscription_record
       WHERE id IN (${placeholders})
       ORDER BY id`,
      recordIds
    );
    
    console.log(`📊 找到 ${records.length} 条订阅记录\n`);
    console.log('='.repeat(80));
    
    for (const record of records) {
      console.log(`\n📋 分析订阅记录 ID=${record.id}`);
      console.log('-'.repeat(80));
      
      const serviceStart = new Date(record.start_date);
      const serviceEnd = new Date(record.end_date);
      
      // 计算实际日期差
      const actualDaysFromDates = diffDays(serviceStart, serviceEnd);
      
      // 当前逻辑：优先使用 subscription_duration_days
      const totalDays = record.subscription_duration_days && record.subscription_duration_days > 0
        ? record.subscription_duration_days
        : actualDaysFromDates;
      
      console.log(`原始数据:`);
      console.log(`  payment_amount: ${record.payment_amount}`);
      console.log(`  start_date: ${record.start_date}`);
      console.log(`  end_date: ${record.end_date}`);
      console.log(`  subscription_duration_days: ${record.subscription_duration_days}`);
      console.log(`\n计算得到:`);
      console.log(`  actualDaysFromDates (实际日期差): ${actualDaysFromDates.toFixed(8)} 天`);
      console.log(`  totalDays (使用的总天数): ${totalDays.toFixed(8)} 天`);
      console.log(`  差异: ${Math.abs(actualDaysFromDates - totalDays).toFixed(8)} 天`);
      
      // 找出这个订阅记录跨越的所有月份
      const startMonth = new Date(serviceStart.getFullYear(), serviceStart.getMonth(), 1);
      const endMonth = new Date(serviceEnd.getFullYear(), serviceEnd.getMonth(), 1);
      
      const months = [];
      let currentMonth = new Date(startMonth);
      while (currentMonth <= endMonth) {
        months.push(new Date(currentMonth));
        currentMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1);
      }
      
      console.log(`\n跨越的月份: ${months.length} 个月`);
      months.forEach((month, idx) => {
        const monthStr = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}`;
        console.log(`  ${idx + 1}. ${monthStr}`);
      });
      
      // 查询 reader_spending 中已生成的记录
      const [spendingRecords] = await db.execute(
        `SELECT
           id,
           source_id,
           amount_usd,
           settlement_month,
           spend_time
         FROM reader_spending
         WHERE source_type = 'subscription'
           AND source_id = ?
         ORDER BY settlement_month`,
        [record.id]
      );
      
      console.log(`\n已生成的 reader_spending 记录: ${spendingRecords.length} 条`);
      
      let totalSpent = new Decimal(0);
      const monthBreakdown = [];
      
      for (const month of months) {
        const monthStr = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}`;
        const monthStart = new Date(month.getFullYear(), month.getMonth(), 1, 0, 0, 0, 0);
        const monthEnd = new Date(month.getFullYear(), month.getMonth() + 1, 1, 0, 0, 0, 0);
        
        // 计算重叠
        const overlapStart = serviceStart < monthStart ? monthStart : serviceStart;
        const overlapEnd = serviceEnd > monthEnd ? monthEnd : serviceEnd;
        const overlapDays = diffDays(overlapStart, overlapEnd);
        
        // 计算应该分配的金额（使用当前逻辑）
        const amountForMonth = new Decimal(record.payment_amount)
          .mul(overlapDays)
          .div(totalDays);
        
        // 查找实际生成的记录
        const actualRecord = spendingRecords.find(r => r.settlement_month === `${monthStr}-01`);
        const actualAmount = actualRecord ? new Decimal(actualRecord.amount_usd) : new Decimal(0);
        
        totalSpent = totalSpent.add(amountForMonth);
        
        const breakdown = {
          month: monthStr,
          monthStart: monthStart.toISOString(),
          monthEnd: monthEnd.toISOString(),
          overlapStart: overlapStart.toISOString(),
          overlapEnd: overlapEnd.toISOString(),
          overlapDays: overlapDays,
          calculatedAmount: amountForMonth.toNumber(),
          actualAmount: actualAmount.toNumber(),
          difference: amountForMonth.sub(actualAmount).toNumber()
        };
        
        monthBreakdown.push(breakdown);
        
        console.log(`\n  ${monthStr}:`);
        console.log(`    月份范围: ${monthStart.toISOString()} ~ ${monthEnd.toISOString()}`);
        console.log(`    重叠范围: ${overlapStart.toISOString()} ~ ${overlapEnd.toISOString()}`);
        console.log(`    重叠天数: ${overlapDays.toFixed(8)} 天`);
        console.log(`    计算金额: ${amountForMonth.toFixed(8)} USD`);
        if (actualRecord) {
          console.log(`    实际金额: ${actualAmount.toFixed(8)} USD`);
          console.log(`    差异: ${breakdown.difference.toFixed(8)} USD`);
        } else {
          console.log(`    实际金额: (未生成)`);
        }
      }
      
      // 汇总
      const paymentAmount = new Decimal(record.payment_amount);
      const totalCalculated = totalSpent;
      const totalActual = spendingRecords.reduce((sum, r) => sum.add(new Decimal(r.amount_usd)), new Decimal(0));
      
      console.log(`\n📊 汇总:`);
      console.log(`  原始 payment_amount: ${paymentAmount.toFixed(8)} USD`);
      console.log(`  计算总和 (按当前逻辑): ${totalCalculated.toFixed(8)} USD`);
      console.log(`  实际总和 (reader_spending): ${totalActual.toFixed(8)} USD`);
      console.log(`  计算总和 vs 原始金额: ${totalCalculated.sub(paymentAmount).toFixed(8)} USD`);
      console.log(`  实际总和 vs 原始金额: ${totalActual.sub(paymentAmount).toFixed(8)} USD`);
      
      // 分析问题
      console.log(`\n🔍 问题分析:`);
      
      if (Math.abs(actualDaysFromDates - totalDays) > 0.0001) {
        console.log(`  ⚠️  问题1: subscription_duration_days (${totalDays}) 与实际日期差 (${actualDaysFromDates.toFixed(8)}) 不一致`);
        console.log(`     这会导致比例计算错误`);
      }
      
      const totalOverlapDays = monthBreakdown.reduce((sum, b) => sum + b.overlapDays, 0);
      if (Math.abs(totalOverlapDays - totalDays) > 0.0001) {
        console.log(`  ⚠️  问题2: 各月重叠天数总和 (${totalOverlapDays.toFixed(8)}) 与总天数 (${totalDays.toFixed(8)}) 不一致`);
        console.log(`     这会导致金额分配不完整`);
      }
      
      if (Math.abs(totalCalculated.toNumber() - paymentAmount.toNumber()) > 0.0001) {
        console.log(`  ⚠️  问题3: 计算总和 (${totalCalculated.toFixed(8)}) 与原始金额 (${paymentAmount.toFixed(8)}) 不一致`);
        console.log(`     差异: ${totalCalculated.sub(paymentAmount).toFixed(8)} USD`);
      }
      
      if (Math.abs(totalActual.toNumber() - paymentAmount.toNumber()) > 0.0001) {
        console.log(`  ⚠️  问题4: 实际总和 (${totalActual.toFixed(8)}) 与原始金额 (${paymentAmount.toFixed(8)}) 不一致`);
        console.log(`     差异: ${totalActual.sub(paymentAmount).toFixed(8)} USD`);
      }
      
      console.log('\n' + '='.repeat(80));
    }
    
    console.log('\n✅ 分析完成');
    
  } catch (error) {
    console.error('\n❌ 分析失败:', error);
    process.exit(1);
  } finally {
    if (db) {
      await db.end();
      console.log('\n🔌 数据库连接已关闭');
    }
  }
}

// 执行分析
debugSubscriptionSplit();

