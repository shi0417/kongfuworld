// 测试时区系统
const timezoneHandler = require('./utils/timezone');

console.log('🌍 时区系统测试\n');

// 1. 测试不同时区的"今天"
console.log('1. 测试不同时区的"今天":');
const timezones = ['UTC', 'Asia/Shanghai', 'America/New_York', 'Europe/London'];

timezones.forEach(tz => {
  const today = timezoneHandler.getUserToday(tz);
  const now = timezoneHandler.getUserNow(tz);
  const info = timezoneHandler.getTimezoneInfo(tz);
  
  console.log(`   ${tz}:`);
  console.log(`     今天: ${today}`);
  console.log(`     现在: ${info.currentTime}`);
  console.log(`     时差: ${info.utcOffset}`);
  console.log(`     夏令时: ${info.isDST ? '是' : '否'}`);
  console.log('');
});

// 2. 测试重置时间
console.log('2. 测试重置时间:');
timezones.forEach(tz => {
  const resetTime = timezoneHandler.getNextResetTime(tz);
  const timeUntilReset = timezoneHandler.getTimeUntilReset(tz);
  
  console.log(`   ${tz}: 下次重置 ${timeUntilReset} 小时后`);
});

// 3. 测试支持的时区列表
console.log('\n3. 支持的时区列表:');
const supportedTimezones = timezoneHandler.getSupportedTimezones();
supportedTimezones.forEach(tz => {
  console.log(`   ${tz.value} (${tz.offset})`);
});

// 4. 模拟不同时区用户的签到场景
console.log('\n4. 模拟签到场景:');
console.log('   场景1: 北京用户 (Asia/Shanghai)');
const beijingToday = timezoneHandler.getUserToday('Asia/Shanghai');
console.log(`   北京今天: ${beijingToday}`);

console.log('\n   场景2: 纽约用户 (America/New_York)');
const nyToday = timezoneHandler.getUserToday('America/New_York');
console.log(`   纽约今天: ${nyToday}`);

console.log('\n   场景3: 伦敦用户 (Europe/London)');
const londonToday = timezoneHandler.getUserToday('Europe/London');
console.log(`   伦敦今天: ${londonToday}`);

// 5. 时区转换测试
console.log('\n5. 时区转换测试:');
const utcTime = new Date('2025-10-07T12:00:00Z');
console.log(`   UTC时间: ${utcTime.toISOString()}`);

timezones.forEach(tz => {
  const localTime = timezoneHandler.formatToUserTimezone(utcTime, tz);
  console.log(`   ${tz}: ${localTime}`);
});

console.log('\n✅ 时区系统测试完成！');
