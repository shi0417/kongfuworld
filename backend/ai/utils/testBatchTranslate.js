/**
 * 测试批量标题翻译功能
 * 用于验证 batchTranslateTitles 的分批逻辑和实际调用
 */

const { batchTranslateTitles } = require('../langchain/chapterTranslationPipeline');

async function testBatchTranslate() {
  console.log('=== 测试批量标题翻译功能 ===\n');

  // 生成 20 个虚拟标题（长度不一，模拟真实场景）
  const testTitles = [
    '第一章 初入江湖',
    '第二章 奇遇',
    '第三章 修炼',
    '第四章 突破',
    '第五章 初战',
    '第六章 胜利',
    '第七章 新的挑战',
    '第八章 危机',
    '第九章 转机',
    '第十章 突破',
    '第十一章 新的境界',
    '第十二章 更强的敌人',
    '第十三章 苦战',
    '第十四章 胜利的代价',
    '第十五章 新的开始',
    '第十六章 更深的秘密',
    '第十七章 真相',
    '第十八章 选择',
    '第十九章 决战',
    '第二十章 结局',
  ];

  // 构造输入数组
  const items = testTitles.map((title, idx) => ({
    index: idx + 1,
    chineseTitle: title,
    englishContentSummary: '', // 可选，这里不提供
  }));

  console.log(`准备翻译 ${items.length} 个标题\n`);

  try {
    // 调用批量翻译（使用较小的批次大小以便观察分批效果）
    const results = await batchTranslateTitles(items, {
      maxCharsPerBatch: 200, // 故意设置较小，方便观察分批
      maxItemsPerBatch: 5,   // 每批最多 5 个
    });

    console.log('\n=== 翻译结果 ===');
    console.log(`成功翻译 ${results.length} 个标题：\n`);
    
    results.forEach((result, idx) => {
      const original = items.find(item => item.index === result.index);
      console.log(`${idx + 1}. [${result.index}] ${original.chineseTitle} → ${result.translatedTitle}`);
    });

    console.log('\n=== 测试完成 ===');

  } catch (error) {
    console.error('测试失败:', error.message);
    console.error(error.stack);
  }
}

// 如果直接运行此文件，执行测试
if (require.main === module) {
  testBatchTranslate().catch(console.error);
}

module.exports = { testBatchTranslate };

