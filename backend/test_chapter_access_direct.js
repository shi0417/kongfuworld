// 直接测试章节访问权限检查
const { checkChapterAccess } = require('./check_chapter_access.js');

async function testDirectAccess() {
  try {
    console.log('直接测试章节访问权限...\n');
    
    // 测试用户1访问章节1306（小说10的锁定章节）
    const result = await checkChapterAccess(1, 1306);
    
    console.log('访问权限结果:');
    console.log(`- 是否有访问权限: ${result.hasAccess}`);
    console.log(`- 原因: ${result.reason}`);
    
    if (result.hasAccess) {
      console.log('✅ 用户有访问权限，应该不显示锁定界面');
    } else {
      console.log('❌ 用户无访问权限，应该显示锁定界面');
      if (result.canUnlockWithKey) {
        console.log('- 可以用Key解锁');
      }
      if (result.canBuyWithKarma) {
        console.log('- 可以用Karma购买');
      }
    }
    
  } catch (error) {
    console.error('测试失败:', error);
  }
}

testDirectAccess();
