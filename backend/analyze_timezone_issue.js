/**
 * 分析时区和月份边界计算问题
 */

// 模拟当前代码的月份边界计算
const month = '2025-11';
const monthStart = `${month}-01 00:00:00`;
const nextMonth = new Date(new Date(monthStart).setMonth(new Date(monthStart).getMonth() + 1));
const monthEnd = nextMonth.toISOString().split('T')[0] + ' 00:00:00';

console.log('当前代码的月份边界计算:');
console.log(`  monthStart 字符串: ${monthStart}`);
console.log(`  new Date(monthStart): ${new Date(monthStart).toString()}`);
console.log(`  new Date(monthStart).toISOString(): ${new Date(monthStart).toISOString()}`);
console.log(`  monthEnd 字符串: ${monthEnd}`);
console.log(`  new Date(monthEnd): ${new Date(monthEnd).toString()}`);
console.log(`  new Date(monthEnd).toISOString(): ${new Date(monthEnd).toISOString()}`);

// 模拟数据库中的日期时间
const dbStartDate = '2025-11-02 22:03:15';
const dbEndDate = '2025-12-02 22:03:15';

console.log('\n数据库中的日期时间:');
console.log(`  start_date: ${dbStartDate}`);
console.log(`  new Date('${dbStartDate}'): ${new Date(dbStartDate).toString()}`);
console.log(`  new Date('${dbStartDate}').toISOString(): ${new Date(dbStartDate).toISOString()}`);

// 计算重叠
const serviceStart = new Date(dbStartDate);
const serviceEnd = new Date(dbEndDate);
const monthStartDate = new Date(monthStart);
const monthEndDate = new Date(monthEnd);

console.log('\n重叠计算:');
console.log(`  serviceStart: ${serviceStart.toISOString()}`);
console.log(`  serviceEnd: ${serviceEnd.toISOString()}`);
console.log(`  monthStartDate: ${monthStartDate.toISOString()}`);
console.log(`  monthEndDate: ${monthEndDate.toISOString()}`);

const overlapStart = serviceStart < monthStartDate ? monthStartDate : serviceStart;
const overlapEnd = serviceEnd > monthEndDate ? monthEndDate : serviceEnd;

console.log(`  overlapStart: ${overlapStart.toISOString()}`);
console.log(`  overlapEnd: ${overlapEnd.toISOString()}`);

const diffMs = overlapEnd.getTime() - overlapStart.getTime();
const overlapDays = diffMs / (1000 * 60 * 60 * 24);

console.log(`  重叠毫秒数: ${diffMs}`);
console.log(`  重叠天数: ${overlapDays.toFixed(10)}`);

// 检查是否有时区不一致的问题
console.log('\n⚠️  时区问题检查:');
console.log(`  月份开始时间字符串: "${monthStart}"`);
console.log(`  解析为本地时间: ${new Date(monthStart).toString()}`);
console.log(`  转换为UTC: ${new Date(monthStart).toISOString()}`);
console.log(`  数据库日期字符串: "${dbStartDate}"`);
console.log(`  解析为本地时间: ${new Date(dbStartDate).toString()}`);
console.log(`  转换为UTC: ${new Date(dbStartDate).toISOString()}`);

// 正确的月份边界应该是 UTC 时间的 00:00:00
console.log('\n✅ 正确的月份边界计算应该是:');
const correctMonthStartUTC = new Date(Date.UTC(2025, 10, 1, 0, 0, 0, 0)); // 11月 = 月份索引 10
const correctMonthEndUTC = new Date(Date.UTC(2025, 11, 1, 0, 0, 0, 0)); // 12月 = 月份索引 11
console.log(`  11月开始 (UTC): ${correctMonthStartUTC.toISOString()}`);
console.log(`  11月结束 (UTC): ${correctMonthEndUTC.toISOString()}`);

const correctOverlapStart = serviceStart < correctMonthStartUTC ? correctMonthStartUTC : serviceStart;
const correctOverlapEnd = serviceEnd > correctMonthEndUTC ? correctMonthEndUTC : serviceEnd;
const correctOverlapDays = (correctOverlapEnd.getTime() - correctOverlapStart.getTime()) / (1000 * 60 * 60 * 24);

console.log(`  正确重叠天数: ${correctOverlapDays.toFixed(10)}`);
console.log(`  当前计算重叠天数: ${overlapDays.toFixed(10)}`);
console.log(`  差异: ${Math.abs(correctOverlapDays - overlapDays).toFixed(10)} 天`);

