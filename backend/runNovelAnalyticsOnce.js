require('dotenv').config();
const novelAnalyticsService = require('./services/novelAnalyticsService');

function pad2(n) {
  return String(n).padStart(2, '0');
}

function formatDateLocal(date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function parseDateLocal(dateStr) {
  // Expect YYYY-MM-DD
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateStr || '').trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null;
  if (month < 1 || month > 12) return null;
  if (day < 1 || day > 31) return null;

  const d = new Date(year, month - 1, day);
  // Validate that JS didn't roll over (e.g. 2025-02-31)
  if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) return null;
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDaysLocal(date, days) {
  const d = new Date(date.getTime());
  d.setDate(d.getDate() + days);
  d.setHours(0, 0, 0, 0);
  return d;
}

function getTodayLocal() {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return now;
}

async function main() {
  const [, , startDateArg, dayCountArg] = process.argv;

  if (!startDateArg || !dayCountArg) {
    console.log('用法：node runNovelAnalyticsOnce.js <startDate> <dayCount>');
    console.log('示例：node runNovelAnalyticsOnce.js 2025-11-10 30');
    process.exit(1);
  }

  const startDate = parseDateLocal(startDateArg);
  if (!startDate) {
    console.error(`startDate 格式错误：${startDateArg}（应为 YYYY-MM-DD）`);
    process.exit(1);
  }

  const dayCount = Number(dayCountArg);
  if (!Number.isFinite(dayCount) || !Number.isInteger(dayCount) || dayCount <= 0) {
    console.error(`dayCount 必须是正整数：${dayCountArg}`);
    process.exit(1);
  }

  const theoreticalEnd = addDaysLocal(startDate, dayCount - 1);
  const today = getTodayLocal();
  const endDate = theoreticalEnd.getTime() > today.getTime() ? today : theoreticalEnd;

  const startStr = formatDateLocal(startDate);
  const endStr = formatDateLocal(endDate);

  // 计算实际天数（包含首尾）
  const actualDayCount = Math.floor((endDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000)) + 1;

  console.log(`统计范围：${startStr} 至 ${endStr}，共 ${actualDayCount} 天`);

  let successCount = 0;
  let failCount = 0;
  const failedDates = [];

  for (let i = 0; i < actualDayCount; i++) {
    const currentDate = addDaysLocal(startDate, i);
    const dateStr = formatDateLocal(currentDate);

    console.log(`[${dateStr}] 开始统计...`);
    try {
      await novelAnalyticsService.manualTriggerDailyStats(dateStr);
      console.log(`[${dateStr}] 完成`);
      successCount++;
    } catch (err) {
      failCount++;
      failedDates.push(dateStr);
      console.error(`[${dateStr}] 失败：`, err && err.message ? err.message : err);
      // 继续下一天（不中断整体流程）
    }
  }

  console.log(`统计范围：${startStr} 至 ${endStr}，共 ${actualDayCount} 天`);
  if (failCount === 0) {
    console.log('全部统计完成！');
  } else {
    console.log(`统计完成（成功 ${successCount} 天，失败 ${failCount} 天）`);
    console.log(`失败日期：${failedDates.join(', ')}`);
  }
}

main().catch((err) => {
  console.error('脚本执行失败：', err && err.message ? err.message : err);
  process.exit(1);
});


