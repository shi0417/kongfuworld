/**
 * 修复脚本：清理并重新生成错误的 subscription reader_spending 记录
 * 
 * 问题：由于之前的时区处理错误，导致订阅拆分金额不匹配
 * 解决：删除所有 subscription 类型的 reader_spending 记录，然后重新生成
 * 
 * 使用方法：
 * node backend/migrations/fix_subscription_reader_spending.js
 * 
 * ⚠️ 警告：此脚本会删除所有 subscription 类型的 reader_spending 记录
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

// 工具函数：将日期时间归一化到 UTC 00:00:00（只按日期算，忽略时间部分）
function normalizeToUTCDate(dateTimeStr) {
  const d = new Date(dateTimeStr);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0));
}

// 工具函数：计算两个日期之间的自然日数差（整数）
// 使用半开区间 [startDate, endDate)，即 endDate 当天不算在服务期内
function diffDays(startDate, endDate) {
  const MS_PER_DAY = 24 * 60 * 60 * 1000;
  return Math.round((endDate.getTime() - startDate.getTime()) / MS_PER_DAY);
}

async function fixSubscriptionReaderSpending() {
  let db;
  
  try {
    console.log('🔌 正在连接数据库...');
    db = await mysql.createConnection(dbConfig);
    console.log('✅ 数据库连接成功\n');
    
    // 1. 查询所有受影响的月份
    const [affectedMonths] = await db.execute(
      `SELECT DISTINCT settlement_month
       FROM reader_spending
       WHERE source_type = 'subscription'
       ORDER BY settlement_month`
    );
    
    console.log(`📊 发现 ${affectedMonths.length} 个月份有 subscription 记录\n`);
    
    if (affectedMonths.length === 0) {
      console.log('✅ 没有需要修复的数据');
      return;
    }
    
    // 2. 统计要删除的记录数
    const [deleteCount] = await db.execute(
      `SELECT COUNT(*) as count FROM reader_spending WHERE source_type = 'subscription'`
    );
    
    console.log(`⚠️  将删除 ${deleteCount[0].count} 条 subscription reader_spending 记录\n`);
    console.log('按 Enter 键继续，或 Ctrl+C 取消...');
    
    // 等待用户确认（在实际环境中可以移除这个等待）
    // await new Promise(resolve => process.stdin.once('data', resolve));
    
    // 3. 删除所有 subscription 类型的 reader_spending 记录
    console.log('\n🗑️  删除旧的 subscription reader_spending 记录...');
    await db.execute(`DELETE FROM reader_spending WHERE source_type = 'subscription'`);
    console.log('✅ 删除完成\n');
    
    // 4. 重新生成每个月份的数据
    console.log('🔄 开始重新生成数据...\n');
    
    for (const monthRow of affectedMonths) {
      const settlementMonth = monthRow.settlement_month;
      const monthStr = settlementMonth.toISOString().slice(0, 7); // 例如: "2025-11"
      
      console.log(`处理月份: ${monthStr}`);
      
      // 使用 UTC 时间创建月份边界
      const [year, monthNum] = monthStr.split('-').map(Number);
      const monthStartDateUTC = new Date(Date.UTC(year, monthNum - 1, 1, 0, 0, 0, 0));
      const monthEndDateUTC = new Date(Date.UTC(year, monthNum, 1, 0, 0, 0, 0));
      const monthStart = monthStartDateUTC.toISOString().slice(0, 19).replace('T', ' ');
      const monthEnd = monthEndDateUTC.toISOString().slice(0, 19).replace('T', ' ');
      
      // 查询该月份的订阅记录
      const [subscriptions] = await db.execute(
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
         WHERE payment_status = 'completed'
           AND payment_amount > 0
           AND end_date > ?
           AND start_date < ?
         ORDER BY start_date`,
        [monthStart, monthEnd]
      );
      
      let generatedCount = 0;
      
      for (const row of subscriptions) {
        // 【日期归一化：去掉时间部分，只按日期算】
        // 订阅服务期使用半开区间：[serviceStart, serviceEnd)
        const serviceStart = normalizeToUTCDate(row.start_date);
        const serviceEnd = normalizeToUTCDate(row.end_date);
        
        // 【服务总天数 totalDays 的算法】
        // 使用半开区间 [serviceStart, serviceEnd)，计算自然日数（整数）
        const totalDays = diffDays(serviceStart, serviceEnd);
        
        // 【每个月 overlapDays 的算法 - 按自然日计算】
        // 月份区间也是半开区间：[monthStartDateUTC, monthEndDateUTC)
        const overlapStart = serviceStart > monthStartDateUTC ? serviceStart : monthStartDateUTC;
        const overlapEnd = serviceEnd < monthEndDateUTC ? serviceEnd : monthEndDateUTC;
        
        // 计算重叠天数（整数，自然日）
        let overlapDays = 0;
        if (overlapEnd > overlapStart) {
          overlapDays = diffDays(overlapStart, overlapEnd);
        }
        
        // 跳过没有重叠或总天数为0的记录
        if (overlapDays <= 0 || totalDays <= 0) continue;
        
        // 【金额拆分比例：使用整数天数做比例】
        const ratio = new Decimal(overlapDays).div(totalDays);
        const amountForMonth = new Decimal(row.payment_amount).mul(ratio);
        
        // 插入 reader_spending
        await db.execute(
          `INSERT INTO reader_spending 
           (user_id, novel_id, karma_amount, amount_usd, source_type, source_id, spend_time, settlement_month, days)
           VALUES (?, ?, 0, ?, 'subscription', ?, ?, ?, ?)`,
          [
            row.user_id,
            row.novel_id,
            amountForMonth.toNumber(),
            row.id,
            overlapStart, // 使用重叠开始时间
            settlementMonth,
            overlapDays // 保存自然日数
          ]
        );
        
        generatedCount++;
      }
      
      console.log(`  ✅ ${monthStr}: 生成 ${generatedCount} 条记录`);
    }
    
    console.log('\n✅ 修复完成！');
    
    // 5. 验证修复结果
    console.log('\n📊 验证修复结果...');
    
    // 按 source_id 汇总，检查金额是否匹配
    const [verifyRecords] = await db.execute(
      `SELECT 
         rs.source_id,
         r.payment_amount,
         SUM(rs.amount_usd) as total_split_amount,
         COUNT(*) as split_count
       FROM reader_spending rs
       INNER JOIN user_champion_subscription_record r ON rs.source_id = r.id
       WHERE rs.source_type = 'subscription'
       GROUP BY rs.source_id, r.payment_amount
       HAVING ABS(SUM(rs.amount_usd) - r.payment_amount) > 0.01
       LIMIT 20`
    );
    
    if (verifyRecords.length > 0) {
      console.log(`⚠️  发现 ${verifyRecords.length} 条记录仍有金额不匹配问题:`);
      verifyRecords.forEach(v => {
        const diff = parseFloat(v.total_split_amount) - parseFloat(v.payment_amount);
        console.log(`  source_id=${v.source_id}: payment_amount=${v.payment_amount}, 拆分总和=${v.total_split_amount}, 差异=${diff.toFixed(8)}`);
      });
    } else {
      console.log('✅ 所有记录的金额都匹配！');
    }
    
  } catch (error) {
    console.error('\n❌ 修复失败:', error);
    process.exit(1);
  } finally {
    if (db) {
      await db.end();
      console.log('\n🔌 数据库连接已关闭');
    }
  }
}

// 执行修复
fixSubscriptionReaderSpending();

