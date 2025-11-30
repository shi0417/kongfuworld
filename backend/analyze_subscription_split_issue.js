/**
 * 分析订阅拆分金额不匹配的根本原因
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

async function analyzeIssue() {
  let db;
  
  try {
    db = await mysql.createConnection(dbConfig);
    
    // 分析记录 ID=21
    const [record21] = await db.execute(
      `SELECT id, payment_amount, start_date, end_date, subscription_duration_days
       FROM user_champion_subscription_record
       WHERE id = 21`
    );
    
    const [spending21] = await db.execute(
      `SELECT id, amount_usd, settlement_month
       FROM reader_spending
       WHERE source_type = 'subscription' AND source_id = 21
       ORDER BY settlement_month`
    );
    
    const record = record21[0];
    const serviceStart = new Date(record.start_date);
    const serviceEnd = new Date(record.end_date);
    
    console.log('='.repeat(100));
    console.log('🔍 详细分析记录 ID=21\n');
    console.log(`原始数据:`);
    console.log(`  payment_amount: ${record.payment_amount}`);
    console.log(`  start_date: ${record.start_date} (Date对象: ${serviceStart.toISOString()})`);
    console.log(`  end_date: ${record.end_date} (Date对象: ${serviceEnd.toISOString()})`);
    console.log(`  subscription_duration_days: ${record.subscription_duration_days}`);
    
    const actualDays = diffDays(serviceStart, serviceEnd);
    const totalDays = record.subscription_duration_days || actualDays;
    
    console.log(`\n计算:`);
    console.log(`  实际日期差: ${actualDays.toFixed(10)} 天`);
    console.log(`  使用的总天数: ${totalDays.toFixed(10)} 天`);
    
    // 分析 11 月
    const novStart = new Date('2025-11-01T00:00:00.000Z');
    const novEnd = new Date('2025-12-01T00:00:00.000Z');
    const novOverlapStart = serviceStart < novStart ? novStart : serviceStart;
    const novOverlapEnd = serviceEnd > novEnd ? novEnd : serviceEnd;
    const novOverlapDays = diffDays(novOverlapStart, novOverlapEnd);
    const novAmount = new Decimal(record.payment_amount).mul(novOverlapDays).div(totalDays);
    
    console.log(`\n  11月拆分:`);
    console.log(`    月份范围: ${novStart.toISOString()} ~ ${novEnd.toISOString()}`);
    console.log(`    重叠范围: ${novOverlapStart.toISOString()} ~ ${novOverlapEnd.toISOString()}`);
    console.log(`    重叠天数: ${novOverlapDays.toFixed(10)}`);
    console.log(`    计算金额: ${novAmount.toFixed(10)} (${novAmount.toString()})`);
    console.log(`    实际金额: ${spending21[0]?.amount_usd || 'N/A'}`);
    
    // 分析 12 月
    const decStart = new Date('2025-12-01T00:00:00.000Z');
    const decEnd = new Date('2026-01-01T00:00:00.000Z');
    const decOverlapStart = serviceStart < decStart ? decStart : serviceStart;
    const decOverlapEnd = serviceEnd > decEnd ? decEnd : serviceEnd;
    const decOverlapDays = diffDays(decOverlapStart, decOverlapEnd);
    const decAmount = new Decimal(record.payment_amount).mul(decOverlapDays).div(totalDays);
    
    console.log(`\n  12月拆分:`);
    console.log(`    月份范围: ${decStart.toISOString()} ~ ${decEnd.toISOString()}`);
    console.log(`    重叠范围: ${decOverlapStart.toISOString()} ~ ${decOverlapEnd.toISOString()}`);
    console.log(`    重叠天数: ${decOverlapDays.toFixed(10)}`);
    console.log(`    计算金额: ${decAmount.toFixed(10)} (${decAmount.toString()})`);
    console.log(`    实际金额: ${spending21[1]?.amount_usd || 'N/A'}`);
    
    const totalCalculated = novAmount.add(decAmount);
    const totalActual = spending21.reduce((sum, s) => sum.add(new Decimal(s.amount_usd)), new Decimal(0));
    
    console.log(`\n  汇总:`);
    console.log(`    原始金额: ${record.payment_amount}`);
    console.log(`    计算总和: ${totalCalculated.toFixed(10)}`);
    console.log(`    实际总和: ${totalActual.toFixed(10)}`);
    console.log(`    差异: ${totalCalculated.sub(totalActual).toFixed(10)}`);
    
    // 检查时区问题
    console.log(`\n  ⚠️  时区检查:`);
    console.log(`    start_date 原始字符串: ${record.start_date}`);
    console.log(`    start_date Date对象: ${serviceStart.toString()}`);
    console.log(`    start_date ISO: ${serviceStart.toISOString()}`);
    console.log(`    月份开始时间 (UTC): ${novStart.toISOString()}`);
    console.log(`    月份开始时间 (本地): ${new Date('2025-11-01T00:00:00').toString()}`);
    
    // 检查月份边界计算
    console.log(`\n  ⚠️  月份边界计算检查:`);
    const monthStartStr = '2025-11-01 00:00:00';
    const monthStartDate = new Date(monthStartStr);
    console.log(`    月份开始字符串: ${monthStartStr}`);
    console.log(`    月份开始 Date对象: ${monthStartDate.toString()}`);
    console.log(`    月份开始 ISO: ${monthStartDate.toISOString()}`);
    console.log(`    服务开始时间: ${serviceStart.toString()}`);
    console.log(`    服务开始 ISO: ${serviceStart.toISOString()}`);
    console.log(`    比较: serviceStart < monthStartDate? ${serviceStart < monthStartDate}`);
    
  } catch (error) {
    console.error('错误:', error);
  } finally {
    if (db) await db.end();
  }
}

analyzeIssue();

