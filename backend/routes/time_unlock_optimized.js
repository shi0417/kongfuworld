const express = require('express');
const mysql = require('mysql2/promise');
const router = express.Router();

const dbConfig = {
  host: 'localhost',
  user: 'root',
  password: '123456',
  database: 'kongfuworld'
};

// 检查并处理时间解锁状态（按需检查）
router.post('/check-and-process/:userId/:chapterId', async (req, res) => {
  let db;
  try {
    const { userId, chapterId } = req.params;
    
    if (!userId || !chapterId) {
      return res.status(400).json({ 
        success: false, 
        message: '用户ID和章节ID不能为空' 
      });
    }

    db = await mysql.createConnection(dbConfig);
    
    // 1. 查找时间解锁记录
    const [unlocks] = await db.execute(`
      SELECT 
        id, unlock_method, status, first_clicked_at, unlock_at, next_chapter_id,
        created_at, updated_at
      FROM chapter_unlocks 
      WHERE user_id = ? AND chapter_id = ? AND unlock_method = 'time_unlock'
      ORDER BY created_at DESC 
      LIMIT 1
    `, [userId, chapterId]);
    
    if (unlocks.length === 0) {
      return res.json({
        success: true,
        message: '无时间解锁记录',
        data: { hasTimeUnlock: false }
      });
    }
    
    const unlock = unlocks[0];
    const now = new Date();
    const unlockAt = new Date(unlock.unlock_at);
    
    // 2. 检查是否已到期
    if (unlock.status === 'pending' && now >= unlockAt) {
      // 开始事务
      await db.query('START TRANSACTION');
      
      try {
        // 解锁主章节
        await db.execute(`
          UPDATE chapter_unlocks 
          SET status = 'unlocked', unlocked_at = ?, updated_at = ?
          WHERE id = ?
        `, [now, now, unlock.id]);
        
        // 如果有下一章节，也解锁
        if (unlock.next_chapter_id) {
          await db.execute(`
            UPDATE chapter_unlocks 
            SET status = 'unlocked', unlocked_at = ?, updated_at = ?
            WHERE user_id = ? AND chapter_id = ? AND unlock_method = 'time_unlock' AND status = 'pending'
          `, [now, now, userId, unlock.next_chapter_id]);
        }
        
        // 记录访问日志
        await db.execute(`
          INSERT INTO chapter_access_log 
          (user_id, chapter_id, access_method, access_time)
          VALUES (?, ?, 'time_unlock_completed', ?)
        `, [userId, chapterId, now]);
        
        await db.query('COMMIT');
        
        res.json({
          success: true,
          message: '时间解锁已完成',
          data: {
            hasTimeUnlock: true,
            status: 'unlocked',
            unlockedAt: now,
            nextChapterId: unlock.next_chapter_id
          }
        });
        
      } catch (error) {
        await db.query('ROLLBACK');
        throw error;
      }
      
    } else {
      // 未到期，返回剩余时间
      const timeRemaining = unlockAt.getTime() - now.getTime();
      
      res.json({
        success: true,
        message: '时间解锁进行中',
        data: {
          hasTimeUnlock: true,
          status: unlock.status,
          firstClickedAt: unlock.first_clicked_at,
          unlockAt: unlock.unlock_at,
          timeRemaining: Math.max(0, timeRemaining),
          nextChapterId: unlock.next_chapter_id
        }
      });
    }
    
  } catch (error) {
    console.error('检查时间解锁状态时出错:', error);
    res.status(500).json({ 
      success: false, 
      message: '服务器内部错误' 
    });
  } finally {
    if (db) await db.end();
  }
});

// 启动时间解锁（检查资格并创建记录）
router.post('/start/:userId/:chapterId', async (req, res) => {
  let db;
  try {
    const { userId, chapterId } = req.params;
    
    if (!userId || !chapterId) {
      return res.status(400).json({ 
        success: false, 
        message: '用户ID和章节ID不能为空' 
      });
    }

    db = await mysql.createConnection(dbConfig);
    
    // 1. 检查章节是否存在且被锁定
    const [chapters] = await db.execute(
      'SELECT id, novel_id, chapter_number, unlock_price FROM chapter WHERE id = ?',
      [chapterId]
    );
    
    if (chapters.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: '章节不存在' 
      });
    }
    
    const chapter = chapters[0];
    
    if (!chapter.unlock_price || chapter.unlock_price <= 0) {
      return res.status(400).json({ 
        success: false, 
        message: '章节未被锁定，无需时间解锁' 
      });
    }
    
    // 2. 检查是否已有解锁记录
    const [existingUnlocks] = await db.execute(
      'SELECT id, unlock_method, status FROM chapter_unlocks WHERE user_id = ? AND chapter_id = ?',
      [userId, chapterId]
    );
    
    if (existingUnlocks.length > 0) {
      const unlock = existingUnlocks[0];
      if (unlock.status === 'unlocked') {
        return res.status(400).json({ 
          success: false, 
          message: '用户已拥有该章节' 
        });
      }
      if (unlock.unlock_method === 'time_unlock' && unlock.status === 'pending') {
        return res.status(400).json({ 
          success: false, 
          message: '该章节已在时间解锁队列中' 
        });
      }
    }
    
    // 3. 检查前面章节是否免费或已拥有
    let isEligible = true;
    // 通过查询获取前一章节ID
    const [prevChaptersQuery] = await db.execute(
      'SELECT id FROM chapter WHERE novel_id = ? AND chapter_number = ? AND review_status = ?',
      [chapter.novel_id, chapter.chapter_number - 1, 'approved']
    );
    let prevChapterId = prevChaptersQuery.length > 0 ? prevChaptersQuery[0].id : null;
    
    while (prevChapterId && isEligible) {
      const [prevChapters] = await db.execute(
        'SELECT id, unlock_price FROM chapter WHERE id = ?',
        [prevChapterId]
      );
      
      if (prevChapters.length === 0) break;
      
      const prevChapter = prevChapters[0];
      
      if (prevChapter.unlock_price && prevChapter.unlock_price > 0) {
        const [userUnlocks] = await db.execute(
          'SELECT id FROM chapter_unlocks WHERE user_id = ? AND chapter_id = ? AND status = "unlocked"',
          [userId, prevChapterId]
        );
        
        if (userUnlocks.length === 0) {
          isEligible = false;
          break;
        }
      }
      
      // 继续查找更前面的章节
      const [prevChapters2] = await db.execute(
        'SELECT id FROM chapter WHERE novel_id = ? AND chapter_number = ? AND review_status = ?',
        [chapter.novel_id, chapter.chapter_number - 1, 'approved']
      );
      prevChapterId = prevChapters2.length > 0 ? prevChapters2[0].id : null;
    }
    
    if (!isEligible) {
      return res.status(400).json({ 
        success: false, 
        message: '前面章节未解锁，不符合时间解锁条件' 
      });
    }
    
    // 4. 获取下一章节ID（通过查询获取）
    const [nextChapters] = await db.execute(
      'SELECT id FROM chapter WHERE novel_id = ? AND chapter_number = ? AND review_status = ?',
      [chapter.novel_id, chapter.chapter_number + 1, 'approved']
    );
    const nextChapterId = nextChapters.length > 0 ? nextChapters[0].id : null;
    
    // 5. 计算解锁时间
    const now = new Date();
    const unlockAt = new Date(now.getTime() + 23 * 60 * 60 * 1000); // 23小时后
    
    // 6. 开始事务
    await db.query('START TRANSACTION');
    
    try {
      // 7. 插入时间解锁记录
      const [result] = await db.execute(`
        INSERT INTO chapter_unlocks 
        (user_id, chapter_id, unlock_method, cost, first_clicked_at, unlock_at, status, next_chapter_id, created_at, updated_at)
        VALUES (?, ?, 'time_unlock', 0, ?, ?, 'pending', ?, ?, ?)
      `, [userId, chapterId, now, unlockAt, nextChapterId, now, now]);
      
      const unlockId = result.insertId;
      
      // 8. 如果有下一章节，也插入记录
      if (nextChapterId) {
        await db.execute(`
          INSERT INTO chapter_unlocks 
          (user_id, chapter_id, unlock_method, cost, first_clicked_at, unlock_at, status, created_at, updated_at)
          VALUES (?, ?, 'time_unlock', 0, ?, ?, 'pending', ?, ?)
        `, [userId, nextChapterId, now, unlockAt, now, now]);
      }
      
      // 9. 记录访问日志
      await db.execute(`
        INSERT INTO chapter_access_log 
        (user_id, chapter_id, access_method, access_time)
        VALUES (?, ?, 'time_unlock_started', ?)
      `, [userId, chapterId, now]);
      
      await db.query('COMMIT');
      
      res.json({
        success: true,
        message: '时间解锁已启动',
        data: {
          unlockId: unlockId,
          chapterId: chapterId,
          nextChapterId: nextChapterId,
          firstClickedAt: now,
          unlockAt: unlockAt,
          timeRemaining: 23 * 60 * 60 * 1000 // 23小时的毫秒数
        }
      });
      
    } catch (error) {
      await db.query('ROLLBACK');
      throw error;
    }
    
  } catch (error) {
    console.error('启动时间解锁时出错:', error);
    res.status(500).json({ 
      success: false, 
      message: '服务器内部错误' 
    });
  } finally {
    if (db) await db.end();
  }
});

// 取消时间解锁（用户用其他方式解锁时）
router.post('/cancel/:userId/:chapterId', async (req, res) => {
  let db;
  try {
    const { userId, chapterId } = req.params;
    const { newUnlockMethod, newCost } = req.body;
    
    if (!userId || !chapterId || !newUnlockMethod) {
      return res.status(400).json({ 
        success: false, 
        message: '参数不完整' 
      });
    }

    db = await mysql.createConnection(dbConfig);
    
    // 开始事务
    await db.query('START TRANSACTION');
    
    try {
      // 更新时间解锁记录
      const [result] = await db.execute(`
        UPDATE chapter_unlocks 
        SET unlock_method = ?, cost = ?, status = 'unlocked', updated_at = ?
        WHERE user_id = ? AND chapter_id = ? AND unlock_method = 'time_unlock' AND status = 'pending'
      `, [newUnlockMethod, newCost || 0, new Date(), userId, chapterId]);
      
      if (result.affectedRows === 0) {
        await db.query('ROLLBACK');
        return res.status(404).json({ 
          success: false, 
          message: '未找到待取消的时间解锁记录' 
        });
      }
      
      // 如果有下一章节的时间解锁记录，也取消
      // 先获取当前章节信息
      const [currentChapter] = await db.execute(
        'SELECT novel_id, chapter_number FROM chapter WHERE id = ?',
        [chapterId]
      );
      if (currentChapter.length > 0) {
        const [nextUnlocks] = await db.execute(`
          SELECT chapter_id FROM chapter_unlocks 
          WHERE user_id = ? AND unlock_method = 'time_unlock' AND status = 'pending'
          AND chapter_id IN (
            SELECT id FROM chapter WHERE novel_id = ? AND chapter_number = ? AND review_status = ?
          )
        `, [userId, currentChapter[0].novel_id, currentChapter[0].chapter_number + 1, 'approved']);
      
        if (nextUnlocks.length > 0) {
          await db.execute(`
            UPDATE chapter_unlocks 
            SET status = 'cancelled', updated_at = ?
            WHERE user_id = ? AND unlock_method = 'time_unlock' AND status = 'pending'
            AND chapter_id IN (
              SELECT id FROM chapter WHERE novel_id = ? AND chapter_number = ? AND review_status = ?
            )
          `, [new Date(), userId, currentChapter[0].novel_id, currentChapter[0].chapter_number + 1, 'approved']);
        }
      }
      
      await db.query('COMMIT');
      
      res.json({
        success: true,
        message: '时间解锁已取消，记录已更新'
      });
      
    } catch (error) {
      await db.query('ROLLBACK');
      throw error;
    }
    
  } catch (error) {
    console.error('取消时间解锁时出错:', error);
    res.status(500).json({ 
      success: false, 
      message: '服务器内部错误' 
    });
  } finally {
    if (db) await db.end();
  }
});

module.exports = router;
