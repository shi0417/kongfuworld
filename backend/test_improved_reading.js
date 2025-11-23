// 测试改进的章节阅读逻辑
const fetch = require('node-fetch');

const BASE_URL = 'http://localhost:5000';

// 测试用例
const testCases = [
  {
    name: '测试1: 免费章节首次阅读',
    userId: 1,
    chapterId: 1,
    expected: {
      isNewChapter: true,
      unlockMethod: 'free'
    }
  },
  {
    name: '测试2: 付费章节未解锁',
    userId: 1,
    chapterId: 2,
    expected: {
      isNewChapter: false,
      reason: '章节未解锁'
    }
  },
  {
    name: '测试3: 重复阅读同一章节',
    userId: 1,
    chapterId: 1,
    expected: {
      isNewChapter: false,
      reason: '重复阅读'
    }
  },
  {
    name: '测试4: Champion会员解锁章节',
    userId: 1,
    chapterId: 3,
    expected: {
      isNewChapter: true,
      unlockMethod: 'champion'
    }
  }
];

async function runTests() {
  console.log('🧪 开始测试改进的章节阅读逻辑...\n');
  
  for (const testCase of testCases) {
    console.log(`📋 ${testCase.name}`);
    
    try {
      const response = await fetch(`${BASE_URL}/api/user/${testCase.userId}/read-chapter`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chapterId: testCase.chapterId
        })
      });
      
      const result = await response.json();
      
      console.log(`   状态码: ${response.status}`);
      console.log(`   响应: ${JSON.stringify(result, null, 2)}`);
      
      // 验证结果
      if (testCase.expected.isNewChapter !== undefined) {
        if (result.isNewChapter === testCase.expected.isNewChapter) {
          console.log(`   ✅ 新章节判断正确`);
        } else {
          console.log(`   ❌ 新章节判断错误，期望: ${testCase.expected.isNewChapter}, 实际: ${result.isNewChapter}`);
        }
      }
      
      if (testCase.expected.unlockMethod) {
        if (result.unlockMethod === testCase.expected.unlockMethod) {
          console.log(`   ✅ 解锁方法正确`);
        } else {
          console.log(`   ❌ 解锁方法错误，期望: ${testCase.expected.unlockMethod}, 实际: ${result.unlockMethod}`);
        }
      }
      
      if (testCase.expected.reason) {
        if (result.reason === testCase.expected.reason) {
          console.log(`   ✅ 原因正确`);
        } else {
          console.log(`   ❌ 原因错误，期望: ${testCase.expected.reason}, 实际: ${result.reason}`);
        }
      }
      
    } catch (error) {
      console.log(`   ❌ 测试失败: ${error.message}`);
    }
    
    console.log(''); // 空行分隔
  }
  
  console.log('🏁 测试完成！');
}

// 运行测试
runTests().catch(console.error);
