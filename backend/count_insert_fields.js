/**
 * 统计 INSERT 语句中的列数和参数数量
 */

const fs = require('fs');
const content = fs.readFileSync('services/unifiedPaymentService.js', 'utf8');

// 提取 INSERT 语句
const insertMatch = content.match(/INSERT INTO user_champion_subscription_record\s*\(([\s\S]*?)\)\s*VALUES\s*\(([\s\S]*?)\)/);
if (insertMatch) {
  const columnsPart = insertMatch[1];
  const valuesPart = insertMatch[2];
  
  // 统计列数
  const columns = columnsPart.split(',').map(c => c.trim()).filter(c => c);
  console.log('列数:', columns.length);
  console.log('列名列表:');
  columns.forEach((col, i) => console.log(`  ${i + 1}. ${col}`));
  
  // 统计占位符数
  const placeholders = (valuesPart.match(/\?/g) || []).length;
  console.log('\n占位符数:', placeholders);
  
  // 提取 params 数组
  const paramsMatch = content.match(/const params = \[([\s\S]*?)\];/);
  if (paramsMatch) {
    const paramsContent = paramsMatch[1];
    const params = paramsContent.split(',').filter(p => p.trim() && !p.trim().startsWith('//'));
    console.log('参数数:', params.length);
  }
  
  console.log('\n匹配情况:');
  if (columns.length === placeholders) {
    console.log('✅ 列数和占位符数匹配');
  } else {
    console.log('❌ 列数和占位符数不匹配');
    console.log(`   列数: ${columns.length}, 占位符数: ${placeholders}`);
  }
}

