// 任务管理系统 - 基于user.mission字段的任务管理
const mysql = require('mysql2/promise');

// 数据库连接配置
const dbConfig = {
  host: 'localhost',
  user: 'root',
  password: '123456',
  database: 'kongfuworld',
  charset: 'utf8mb4'
};

/**
 * 检查并初始化用户今日任务
 * @param {number} userId - 用户ID
 * @returns {Object} 任务状态信息
 */
async function checkAndInitializeTodayMissions(userId) {
  let db;
  try {
    db = await mysql.createConnection(dbConfig);
    
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD格式
    
    // 1. 获取用户任务状态
    const [userResults] = await db.execute(
      'SELECT mission FROM user WHERE id = ?',
      [userId]
    );
    
    if (userResults.length === 0) {
      return { success: false, message: '用户不存在' };
    }
    
    const userMission = userResults[0].mission;
    console.log(`[DEBUG] 用户 ${userId} 当前任务状态: ${userMission}`);
    
    // 2. 检查任务状态
    if (userMission && userMission.startsWith(today)) {
      // 今天已经有任务状态，检查是否有任务记录
      const status = userMission.split(' ')[1]; // completed 或 uncompleted
      console.log(`[DEBUG] 用户 ${userId} 今天任务状态: ${status}`);
      
      // 检查今天是否有任务记录
      const [todayProgress] = await db.execute(`
        SELECT COUNT(*) as count FROM user_mission_progress 
        WHERE user_id = ? AND progress_date = ?
      `, [userId, today]);
      
      if (todayProgress[0].count === 0) {
        console.log(`[DEBUG] 用户 ${userId} 今天没有任务记录，需要重新初始化...`);
        // 继续执行初始化逻辑
      } else {
        return {
          success: true,
          isToday: true,
          status: status,
          message: status === 'completed' ? '今日任务已完成' : '今日任务进行中'
        };
      }
    }
    
    // 3. 今天没有任务状态，需要初始化任务
    console.log(`[DEBUG] 用户 ${userId} 今天没有任务状态，开始初始化任务...`);
    
    // 获取所有活跃的每日任务配置
    const [missionConfigs] = await db.execute(`
      SELECT id, mission_key, title, target_value, reward_keys, reward_karma
      FROM mission_config 
      WHERE mission_type = 'daily' AND is_active = 1
      ORDER BY id ASC
    `);
    
    if (missionConfigs.length === 0) {
      return { success: false, message: '没有可用的每日任务配置' };
    }
    
    // 4. 为今天创建任务进度记录
    console.log(`[DEBUG] 为用户 ${userId} 创建 ${missionConfigs.length} 个任务...`);
    
    for (const mission of missionConfigs) {
      await db.execute(`
        INSERT INTO user_mission_progress 
        (user_id, mission_id, current_progress, is_completed, is_claimed, progress_date)
        VALUES (?, ?, 0, 0, 0, ?)
      `, [userId, mission.id, today]);
      
      console.log(`[DEBUG] 创建任务: ${mission.title} (${mission.mission_key})`);
    }
    
    // 5. 更新用户任务状态为"未完成"
    await db.execute(
      'UPDATE user SET mission = ? WHERE id = ?',
      [`${today} uncompleted`, userId]
    );
    
    console.log(`[DEBUG] 用户 ${userId} 任务初始化完成，状态设置为: ${today} uncompleted`);
    
    return {
      success: true,
      isToday: true,
      status: 'uncompleted',
      message: '今日任务已初始化',
      missions: missionConfigs
    };
    
  } catch (error) {
    console.error('检查并初始化任务失败:', error);
    return { success: false, message: '任务初始化失败', error: error.message };
  } finally {
    if (db) await db.end();
  }
}

/**
 * 检查任务是否完成并更新状态
 * @param {number} userId - 用户ID
 * @returns {Object} 任务完成状态
 */
async function checkMissionCompletion(userId) {
  let db;
  try {
    db = await mysql.createConnection(dbConfig);
    
    const today = new Date().toISOString().slice(0, 10);
    
    // 1. 检查用户任务状态
    const [userResults] = await db.execute(
      'SELECT mission FROM user WHERE id = ?',
      [userId]
    );
    
    if (userResults.length === 0) {
      return { success: false, message: '用户不存在' };
    }
    
    const userMission = userResults[0].mission;
    
    // 2. 如果任务已完成，直接返回
    if (userMission && userMission === `${today} completed`) {
      return {
        success: true,
        isCompleted: true,
        message: '今日任务已完成'
      };
    }
    
    // 3. 检查今天的任务完成情况
    const [progressResults] = await db.execute(`
      SELECT 
        ump.mission_id,
        ump.current_progress,
        ump.is_completed,
        mc.target_value,
        mc.title
      FROM user_mission_progress ump
      JOIN mission_config mc ON ump.mission_id = mc.id
      WHERE ump.user_id = ? AND ump.progress_date = ?
    `, [userId, today]);
    
    if (progressResults.length === 0) {
      return { success: false, message: '今天没有任务记录' };
    }
    
    // 4. 检查所有任务是否完成
    const allCompleted = progressResults.every(task => task.is_completed);
    
    if (allCompleted) {
      // 5. 所有任务完成，更新用户状态
      await db.execute(
        'UPDATE user SET mission = ? WHERE id = ?',
        [`${today} completed`, userId]
      );
      
      console.log(`[DEBUG] 用户 ${userId} 所有任务完成，状态更新为: ${today} completed`);
      
      return {
        success: true,
        isCompleted: true,
        message: '所有任务已完成',
        tasks: progressResults
      };
    } else {
      // 6. 还有任务未完成
      const completedTasks = progressResults.filter(task => task.is_completed);
      const totalTasks = progressResults.length;
      
      return {
        success: true,
        isCompleted: false,
        message: `任务进行中: ${completedTasks.length}/${totalTasks} 已完成`,
        tasks: progressResults,
        completedCount: completedTasks.length,
        totalCount: totalTasks
      };
    }
    
  } catch (error) {
    console.error('检查任务完成状态失败:', error);
    return { success: false, message: '检查任务状态失败', error: error.message };
  } finally {
    if (db) await db.end();
  }
}

/**
 * 更新任务进度
 * @param {number} userId - 用户ID
 * @param {string} missionKey - 任务标识符
 * @param {number} progressValue - 进度增加值
 * @param {number} chapterId - 章节ID（可选）
 * @returns {Object} 更新结果
 */
async function updateMissionProgress(userId, missionKey, progressValue = 1, chapterId = null) {
  let db;
  try {
    db = await mysql.createConnection(dbConfig);
    
    const today = new Date().toISOString().slice(0, 10);
    
    // 1. 检查用户任务状态
    const [userResults] = await db.execute(
      'SELECT mission FROM user WHERE id = ?',
      [userId]
    );
    
    if (userResults.length === 0) {
      return { success: false, message: '用户不存在' };
    }
    
    const userMission = userResults[0].mission;
    
    // 2. 检查是否在任务模式
    if (!userMission || !userMission.startsWith(today) || userMission === `${today} completed`) {
      return { 
        success: false, 
        message: '不在任务模式或任务已完成',
        userMission: userMission
      };
    }
    
    // 3. 获取任务配置
    const [missionConfigs] = await db.execute(
      'SELECT id, target_value, reward_keys, reward_karma FROM mission_config WHERE mission_key = ? AND is_active = 1',
      [missionKey]
    );
    
    if (missionConfigs.length === 0) {
      return { success: false, message: '任务不存在或已停用' };
    }
    
    const mission = missionConfigs[0];
    
    // 4. 获取当前任务进度
    const [progressResults] = await db.execute(`
      SELECT * FROM user_mission_progress 
      WHERE user_id = ? AND mission_id = ? AND progress_date = ?
    `, [userId, mission.id, today]);
    
    if (progressResults.length === 0) {
      return { success: false, message: '今天没有该任务记录' };
    }
    
    const currentProgress = progressResults[0];
    
    // 5. 更新任务进度
    const newProgress = Math.min(
      currentProgress.current_progress + progressValue,
      mission.target_value
    );
    const isCompleted = newProgress >= mission.target_value;
    
    await db.execute(`
      UPDATE user_mission_progress 
      SET current_progress = ?, is_completed = ?, updated_at = NOW()
      WHERE user_id = ? AND mission_id = ? AND progress_date = ?
    `, [newProgress, isCompleted, userId, mission.id, today]);
    
    // 6. 记录任务进度（每次阅读新章节都记录，无论任务是否完成）
    // 检查是否已经记录过这个章节的进度
    const [existingChapterLog] = await db.execute(`
      SELECT id FROM mission_completion_log 
      WHERE user_id = ? AND mission_id = ? AND chapter_id = ? AND DATE(completed_at) = ?
    `, [userId, mission.id, chapterId, today]);
    
    // 如果这个章节还没有记录过，则插入新的进度记录
    if (existingChapterLog.length === 0) {
      await db.execute(`
        INSERT INTO mission_completion_log 
        (user_id, mission_id, reward_keys, reward_karma, chapter_id)
        VALUES (?, ?, ?, ?, ?)
      `, [userId, mission.id, mission.reward_keys, mission.reward_karma, chapterId]);
      
      if (isCompleted) {
        console.log(`[DEBUG] 用户 ${userId} 完成任务: ${missionKey}, 奖励: ${mission.reward_keys} keys, 章节ID: ${chapterId}`);
      } else {
        console.log(`[DEBUG] 用户 ${userId} 任务 ${missionKey} 进度更新: ${newProgress}/${mission.target_value}, 章节ID: ${chapterId}`);
      }
    } else {
      console.log(`[DEBUG] 用户 ${userId} 任务 ${missionKey} 章节 ${chapterId} 今天已记录，跳过重复记录`);
    }
    
    // 7. 检查所有任务是否完成
    const completionStatus = await checkMissionCompletion(userId);
    
    return {
      success: true,
      message: '任务进度更新成功',
      data: {
        missionKey,
        currentProgress: newProgress,
        targetValue: mission.target_value,
        isCompleted,
        progressPercentage: Math.min(100, Math.round(newProgress / mission.target_value * 100)),
        allTasksCompleted: completionStatus.isCompleted
      }
    };
    
  } catch (error) {
    console.error('更新任务进度失败:', error);
    return { success: false, message: '更新任务进度失败', error: error.message };
  } finally {
    if (db) await db.end();
  }
}

module.exports = {
  checkAndInitializeTodayMissions,
  checkMissionCompletion,
  updateMissionProgress
};
