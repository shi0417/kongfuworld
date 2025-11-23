/**
 * 测试定时发布功能
 * 用于手动触发定时发布任务，测试功能是否正常
 * 
 * 使用方法：
 * node scripts/testScheduledRelease.js
 */

const scheduledReleaseService = require('../services/scheduledReleaseService');

async function testScheduledRelease() {
  console.log('='.repeat(50));
  console.log('开始测试定时发布功能...');
  console.log('='.repeat(50));
  
  try {
    await scheduledReleaseService.manualTrigger();
    console.log('='.repeat(50));
    console.log('测试完成！');
    console.log('='.repeat(50));
    process.exit(0);
  } catch (error) {
    console.error('测试失败:', error);
    process.exit(1);
  }
}

testScheduledRelease();

