// 检查用户章节访问权限的完整逻辑
const mysql = require('mysql2');

// 数据库连接配置
const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: '123456',
  database: 'kongfuworld',
  charset: 'utf8mb4'
});

/**
 * 检查用户是否有权限访问章节
 * @param {number} userId - 用户ID
 * @param {number} chapterId - 章节ID
 * @returns {Object} - 访问权限结果
 */
async function checkChapterAccess(userId, chapterId) {
  try {
    console.log(`检查用户 ${userId} 对章节 ${chapterId} 的访问权限...`);
    
    // 1. 获取章节信息
    const chapter = await new Promise((resolve, reject) => {
      db.query(`
        SELECT 
          c.*,
          n.title as novel_title,
          n.id as novel_id
        FROM chapter c
        LEFT JOIN novel n ON c.novel_id = n.id
        WHERE c.id = ?
      `, [chapterId], (err, results) => {
        if (err) reject(err);
        else resolve(results[0]);
      });
    });

    if (!chapter) {
      return { hasAccess: false, reason: '章节不存在' };
    }

    // 2. 如果章节不是锁定状态，直接允许访问
    if (!chapter.is_locked) {
      return { hasAccess: true, reason: '免费章节' };
    }

    // 3. 获取用户信息
    const user = await new Promise((resolve, reject) => {
      db.query(`
        SELECT 
          id, 
          points, 
          karma_count, 
          subscription_status, 
          subscription_end_date
        FROM user 
        WHERE id = ?
      `, [userId], (err, results) => {
        if (err) reject(err);
        else resolve(results[0]);
      });
    });

    if (!user) {
      return { hasAccess: false, reason: '用户不存在' };
    }

    // 4. 检查用户是否已解锁该章节
    const existingUnlock = await new Promise((resolve, reject) => {
      db.query(`
        SELECT * FROM chapter_unlocks 
        WHERE user_id = ? AND chapter_id = ?
      `, [userId, chapterId], (err, results) => {
        if (err) reject(err);
        else resolve(results[0]);
      });
    });

    if (existingUnlock) {
      return { 
        hasAccess: true, 
        reason: '用户已解锁该章节',
        unlockMethod: existingUnlock.unlock_method 
      };
    }

    // 5. 检查用户Champion订阅状态（针对该小说）
    const championSubscription = await new Promise((resolve, reject) => {
      db.query(`
        SELECT * FROM user_champion_subscription 
        WHERE user_id = ? AND novel_id = ? AND is_active = 1 AND end_date > NOW()
      `, [userId, chapter.novel_id], (err, results) => {
        if (err) reject(err);
        else resolve(results[0]);
      });
    });

    if (championSubscription) {
      return { 
        hasAccess: true, 
        reason: '用户拥有该小说的Champion订阅',
        subscriptionTier: championSubscription.tier_level 
      };
    }

    // 6. 检查全局Champion订阅
    const isGlobalSubscribed = user.subscription_status !== 'none' && 
                              user.subscription_end_date && 
                              new Date(user.subscription_end_date) > new Date();

    if (isGlobalSubscribed) {
      return { 
        hasAccess: true, 
        reason: '用户拥有全局Champion订阅' 
      };
    }

    // 7. 暂时不使用时间解锁功能
    // const now = new Date();
    // const isTimeUnlocked = chapter.free_unlock_time && 
    //                       new Date(chapter.free_unlock_time) <= now;

    // 8. 所有条件都不满足，章节被锁定
    return { 
      hasAccess: false, 
      reason: '章节被锁定，需要解锁',
      canUnlockWithKey: user.points >= (chapter.key_cost || 1),
      canBuyWithKarma: (chapter.unlock_price || 13) > 0
    };

  } catch (error) {
    console.error('检查章节访问权限失败:', error);
    return { hasAccess: false, reason: '检查权限时出错' };
  }
}

// 测试函数
async function testChapterAccess() {
  console.log('开始测试章节访问权限...\n');
  
  // 测试用例
  const testCases = [
    { userId: 1, chapterId: 1478, description: '用户1访问章节1478' },
    { userId: 2, chapterId: 1478, description: '用户2访问章节1478' },
    { userId: 1, chapterId: 1477, description: '用户1访问章节1477' }
  ];
  
  for (const testCase of testCases) {
    console.log(`\n测试: ${testCase.description}`);
    const result = await checkChapterAccess(testCase.userId, testCase.chapterId);
    console.log('结果:', result);
  }
  
  db.end();
}

// 如果直接运行此文件，执行测试
if (require.main === module) {
  testChapterAccess();
}

module.exports = { checkChapterAccess };
