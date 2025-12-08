/**
 * 检查环境变量配置
 */

require('dotenv').config({ path: './kongfuworld.env' });

const requiredConfigs = {
  'OPENAI_API_KEY': 'OpenAI API Key（必需）',
  'OPENAI_MODEL': 'OpenAI 模型名称',
  'KFW_AI_TRANSLATION_ENABLED': 'AI 翻译功能开关',
};

const newConfigs = {
  'KFW_AI_RPM_LIMIT': '每分钟请求限制（RPM）',
  'KFW_AI_MAX_CONCURRENT': '最大并发数',
  'KFW_AI_PRIMARY_MODEL': '主模型',
  'KFW_AI_SECONDARY_MODEL': '备用模型',
  'KFW_AI_MAX_CHARS_PER_CHAPTER': '单章最大字符数',
};

console.log('\n📋 AI 翻译环境变量配置检查\n');
console.log('='.repeat(60));

// 检查必需配置
console.log('\n✅ 基础配置：');
let allOk = true;
for (const [key, desc] of Object.entries(requiredConfigs)) {
  const value = process.env[key];
  if (value) {
    const displayValue = key.includes('KEY') || key.includes('SECRET') 
      ? value.substring(0, 20) + '...' 
      : value;
    console.log(`  ✓ ${key}: ${displayValue} (${desc})`);
  } else {
    console.log(`  ✗ ${key}: 未配置 (${desc})`);
    allOk = false;
  }
}

// 检查新增配置
console.log('\n📦 LangChain 流水线配置：');
for (const [key, desc] of Object.entries(newConfigs)) {
  const value = process.env[key];
  if (value) {
    console.log(`  ✓ ${key}: ${value} (${desc})`);
  } else {
    console.log(`  ⚠ ${key}: 未配置，将使用默认值 (${desc})`);
  }
}

console.log('\n' + '='.repeat(60));

// 显示配置摘要
const config = {
  rpmLimit: parseInt(process.env.KFW_AI_RPM_LIMIT) || 3,
  maxConcurrent: parseInt(process.env.KFW_AI_MAX_CONCURRENT) || 1,
  primaryModel: process.env.KFW_AI_PRIMARY_MODEL || 'gpt-4o-mini',
  secondaryModel: process.env.KFW_AI_SECONDARY_MODEL || 'gpt-4o-mini',
  maxCharsPerChapter: parseInt(process.env.KFW_AI_MAX_CHARS_PER_CHAPTER) || 12000,
};

console.log('\n📊 当前配置摘要：');
console.log(`  速率限制: ${config.rpmLimit} RPM`);
console.log(`  最大并发: ${config.maxConcurrent}`);
console.log(`  主模型: ${config.primaryModel}`);
console.log(`  备用模型: ${config.secondaryModel}`);
console.log(`  单章最大字符数: ${config.maxCharsPerChapter}`);

if (allOk) {
  console.log('\n✅ 所有必需配置已就绪！');
} else {
  console.log('\n⚠️  部分必需配置缺失，请检查 kongfuworld.env 文件');
}

console.log('');

