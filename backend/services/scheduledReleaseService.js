const mysql = require('mysql2/promise');
const cron = require('node-cron');

// 数据库配置
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '123456',
  database: process.env.DB_NAME || 'kongfuworld',
  charset: 'utf8mb4'
};

/**
 * 执行定时发布任务
 * 查询 scheduledrelease 表中 is_released=0 且 release_time <= 当前时间的记录
 * 更新这些记录的 is_released=1，同时更新对应的 chapter 表的 is_released=1
 */
async function executeScheduledRelease() {
  let connection;
  try {
    console.log(`[定时发布任务] ${new Date().toLocaleString('zh-CN')} - 开始执行定时发布检查...`);
    
    // 连接数据库
    connection = await mysql.createConnection(dbConfig);
    
    // 查询需要发布的章节
    // 使用复合索引优化查询：idx_is_released 和 idx_release_time
    const [scheduledReleases] = await connection.execute(
      `SELECT id, novel_id, chapter_id, release_time 
       FROM scheduledrelease 
       WHERE is_released = 0 
       AND release_time <= NOW()
       ORDER BY release_time ASC`
    );

    if (scheduledReleases.length === 0) {
      console.log(`[定时发布任务] 没有需要发布的章节`);
      return;
    }

    console.log(`[定时发布任务] 找到 ${scheduledReleases.length} 个需要发布的章节`);

    // 开始事务
    await connection.beginTransaction();

    try {
      const chapterIds = scheduledReleases.map(item => item.chapter_id);
      const scheduledReleaseIds = scheduledReleases.map(item => item.id);

      // 批量更新 scheduledrelease 表
      if (scheduledReleaseIds.length > 0) {
        const placeholders = scheduledReleaseIds.map(() => '?').join(',');
        await connection.execute(
          `UPDATE scheduledrelease 
           SET is_released = 1, updated_at = NOW() 
           WHERE id IN (${placeholders})`,
          scheduledReleaseIds
        );
        console.log(`[定时发布任务] 已更新 ${scheduledReleaseIds.length} 条 scheduledrelease 记录`);
      }

      // 批量更新 chapter 表
      if (chapterIds.length > 0) {
        const placeholders = chapterIds.map(() => '?').join(',');
        const [updateResult] = await connection.execute(
          `UPDATE chapter 
           SET is_released = 1 
           WHERE id IN (${placeholders})`,
          chapterIds
        );
        console.log(`[定时发布任务] 已更新 ${updateResult.affectedRows} 个章节的发布状态`);
      }

      // 提交事务
      await connection.commit();
      console.log(`[定时发布任务] 成功发布 ${scheduledReleases.length} 个章节`);
      
      // 记录发布的章节详情
      scheduledReleases.forEach(item => {
        console.log(`[定时发布任务] - 章节ID: ${item.chapter_id}, 小说ID: ${item.novel_id}, 计划发布时间: ${item.release_time}`);
      });

    } catch (error) {
      // 回滚事务
      await connection.rollback();
      throw error;
    }

  } catch (error) {
    console.error(`[定时发布任务] 执行失败:`, error);
    throw error;
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

/**
 * 启动定时发布任务
 * 每小时整点执行一次（例如：00:00, 01:00, 02:00, ...）
 */
function startScheduledReleaseTask() {
  // cron 表达式：'0 * * * *' 表示每小时的第0分钟执行（即每小时整点）
  // 格式：分钟 小时 日 月 星期
  // '0 * * * *' = 每小时整点执行
  cron.schedule('0 * * * *', async () => {
    try {
      await executeScheduledRelease();
    } catch (error) {
      console.error(`[定时发布任务] 定时任务执行出错:`, error);
    }
  }, {
    scheduled: true,
    timezone: "Asia/Shanghai" // 设置时区为中国时区
  });

  console.log('[定时发布任务] 定时发布任务已启动，每小时整点执行一次');
  
  // 启动时立即执行一次（可选，用于测试或处理启动时错过的发布）
  // 如果需要启动时立即执行，可以取消下面的注释
  // executeScheduledRelease().catch(error => {
  //   console.error('[定时发布任务] 启动时执行失败:', error);
  // });
}

/**
 * 手动触发定时发布（用于测试或手动执行）
 */
async function manualTrigger() {
  try {
    await executeScheduledRelease();
    console.log('[定时发布任务] 手动触发执行完成');
  } catch (error) {
    console.error('[定时发布任务] 手动触发执行失败:', error);
    throw error;
  }
}

module.exports = {
  startScheduledReleaseTask,
  executeScheduledRelease,
  manualTrigger
};

