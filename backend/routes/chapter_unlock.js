// 章节解锁API路由
const express = require('express');
const mysql = require('mysql2/promise');
const router = express.Router();
const { recordKeyTransaction } = require('../key_transaction_helper');

// 数据库配置
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '123456',
  database: process.env.DB_NAME || 'kongfuworld',
  charset: 'utf8mb4'
};

// 使用Key解锁章节
router.post('/unlock-with-key/:chapterId/:userId', async (req, res) => {
  let db;
  try {
    const { userId, chapterId } = req.params;
    
    db = await mysql.createConnection(dbConfig);
    
    // 开始事务
    await db.query('START TRANSACTION');
    
    try {
      // 1. 检查章节是否存在
      const [chapters] = await db.execute(`
        SELECT c.*, n.title as novel_title 
      FROM chapter c
        JOIN novel n ON c.novel_id = n.id 
      WHERE c.id = ?
    `, [chapterId]);
    
      if (chapters.length === 0) {
        return res.status(404).json({
          success: false,
          message: '章节不存在'
        });
      }
      
      const chapter = chapters[0];
      
      // 2. 检查用户是否存在
      const [users] = await db.execute('SELECT * FROM user WHERE id = ?', [userId]);
      if (users.length === 0) {
        return res.status(404).json({
          success: false,
          message: '用户不存在'
        });
      }
      
      const user = users[0];
      
      // 3. 检查章节是否已经解锁
      const [existingUnlocks] = await db.execute(`
          SELECT * FROM chapter_unlocks 
        WHERE user_id = ? AND chapter_id = ? AND status = 'unlocked'
        `, [userId, chapterId]);
        
      if (existingUnlocks.length > 0) {
        return res.status(400).json({
          success: false,
          message: '章节已经解锁'
        });
      }
      
      // 4. 检查章节是否需要Key解锁
      if (!chapter.is_premium || chapter.key_cost <= 0) {
        return res.status(400).json({
          success: false,
          message: '该章节不需要Key解锁'
        });
      }
      
      // 5. 检查用户Key余额是否足够
      if (user.points < chapter.key_cost) {
        return res.status(400).json({
          success: false,
          message: `Key余额不足，需要${chapter.key_cost}个Key，当前余额${user.points}个`
        });
      }
      
      // 6. 记录Key消耗
      const keyTransaction = await recordKeyTransaction(
        db,
        userId,
        'unlock',
        -chapter.key_cost, // 负数表示消耗
        chapterId,
        'chapter',
        `解锁章节: ${chapter.novel_title} 第${chapter.chapter_number}章`
      );
      
      // 7. 检查是否已存在解锁记录
      const [unlockRecords] = await db.execute(`
      SELECT * FROM chapter_unlocks 
      WHERE user_id = ? AND chapter_id = ?
    `, [userId, chapterId]);
    
      if (unlockRecords.length > 0) {
        // 如果已存在记录，更新为Key解锁
        await db.execute(`
          UPDATE chapter_unlocks 
          SET unlock_method = 'key', cost = ?, status = 'unlocked', unlocked_at = NOW()
          WHERE user_id = ? AND chapter_id = ?
        `, [chapter.key_cost, userId, chapterId]);
        console.log('✅ 更新现有解锁记录为Key解锁');
      } else {
        // 如果不存在记录，插入新的Key解锁记录
        await db.execute(`
          INSERT INTO chapter_unlocks (
            user_id, chapter_id, unlock_method, cost, status, unlocked_at
          ) VALUES (?, ?, 'key', ?, 'unlocked', NOW())
        `, [userId, chapterId, chapter.key_cost]);
        console.log('✅ 创建新的Key解锁记录');
      }
      
      // 提交事务
      await db.query('COMMIT');

    res.json({
      success: true,
        message: '章节解锁成功',
      data: {
          chapterId: chapterId,
          novelTitle: chapter.novel_title,
          chapterNumber: chapter.chapter_number,
          keyCost: chapter.key_cost,
          balanceBefore: keyTransaction.balanceBefore,
          balanceAfter: keyTransaction.balanceAfter,
          transactionId: keyTransaction.transactionId
        }
      });
      
    } catch (error) {
      // 回滚事务
      await db.query('ROLLBACK');
      throw error;
    }

  } catch (error) {
    console.error('解锁章节失败:', error);
    res.status(500).json({
      success: false,
      message: '解锁章节失败',
      error: error.message
    });
  } finally {
    if (db) await db.end();
  }
});

// 使用Karma解锁章节
router.post('/unlock-with-karma/:chapterId/:userId', async (req, res) => {
  let db;
  try {
    const { userId, chapterId } = req.params;
    
    db = await mysql.createConnection(dbConfig);
    
    // 开始事务
    await db.query('START TRANSACTION');
    
    try {
      // 1. 检查章节是否存在
      const [chapters] = await db.execute(`
        SELECT c.*, n.title as novel_title 
        FROM chapter c
        JOIN novel n ON c.novel_id = n.id 
        WHERE c.id = ?
      `, [chapterId]);
      
      if (chapters.length === 0) {
        return res.status(404).json({
          success: false,
          message: '章节不存在'
        });
      }
      
      const chapter = chapters[0];
      
      // 2. 检查用户是否存在
      const [users] = await db.execute('SELECT * FROM user WHERE id = ?', [userId]);
      if (users.length === 0) {
        return res.status(404).json({
          success: false,
          message: '用户不存在'
        });
      }
      
      const user = users[0];
      
      // 3. 检查章节是否已经解锁
      const [existingUnlocks] = await db.execute(`
        SELECT * FROM chapter_unlocks 
        WHERE user_id = ? AND chapter_id = ? AND status = 'unlocked'
      `, [userId, chapterId]);
      
      if (existingUnlocks.length > 0) {
        return res.status(400).json({
          success: false,
          message: '章节已经解锁'
        });
      }
      
      // 4. 检查章节是否需要Karma解锁
      if (!chapter.is_premium || chapter.unlock_price <= 0) {
        return res.status(400).json({
          success: false,
          message: '该章节不需要Karma解锁'
        });
      }
      
      // 5. 检查用户Golden Karma余额
      if (user.golden_karma < chapter.unlock_price) {
        return res.status(400).json({
          success: false,
          message: `Golden Karma余额不足，需要${chapter.unlock_price}个Golden Karma，当前余额${user.golden_karma}个`,
          redirectUrl: 'http://localhost:3000/user-center?tab=karma',
          errorCode: 'INSUFFICIENT_KARMA'
        });
      }
      
      // 6. 扣除Golden Karma余额
      const newKarmaBalance = user.golden_karma - chapter.unlock_price;
      await db.execute('UPDATE user SET golden_karma = ? WHERE id = ?', [newKarmaBalance, userId]);
      
      // 7. 记录Karma交易
      await db.execute(`
        INSERT INTO user_karma_transactions (
          user_id, transaction_type, karma_amount, karma_type, balance_before, balance_after,
          chapter_id, description, status
        ) VALUES (?, 'consumption', ?, 'golden_karma', ?, ?, ?, ?, 'completed')
      `, [userId, chapter.unlock_price, user.golden_karma, newKarmaBalance, chapterId, `解锁章节: ${chapter.novel_title} 第${chapter.chapter_number}章`]);
      
      // 7. 检查是否已存在解锁记录
      const [unlockRecords] = await db.execute(`
        SELECT * FROM chapter_unlocks 
        WHERE user_id = ? AND chapter_id = ?
      `, [userId, chapterId]);
      
      if (unlockRecords.length > 0) {
        // 如果已存在记录，更新为Karma解锁
        await db.execute(`
          UPDATE chapter_unlocks 
          SET unlock_method = 'karma', cost = ?, status = 'unlocked', unlocked_at = NOW()
          WHERE user_id = ? AND chapter_id = ?
        `, [chapter.unlock_price, userId, chapterId]);
        console.log('✅ 更新现有解锁记录为Karma解锁');
      } else {
        // 如果不存在记录，插入新的Karma解锁记录
        await db.execute(`
          INSERT INTO chapter_unlocks (
            user_id, chapter_id, unlock_method, cost, status, unlocked_at
          ) VALUES (?, ?, 'karma', ?, 'unlocked', NOW())
        `, [userId, chapterId, chapter.unlock_price]);
        console.log('✅ 创建新的Karma解锁记录');
      }
      
      // 提交事务
      await db.query('COMMIT');

      res.json({
        success: true,
        message: '章节解锁成功',
        data: {
          chapterId: chapterId,
          novelTitle: chapter.novel_title,
          chapterNumber: chapter.chapter_number,
          karmaCost: chapter.unlock_price,
          karmaBefore: user.golden_karma,
          karmaAfter: newKarmaBalance
        }
      });
      
    } catch (error) {
      // 回滚事务
      await db.query('ROLLBACK');
      throw error;
    }

  } catch (error) {
    console.error('Karma解锁章节失败:', error);
    res.status(500).json({
      success: false,
      message: '解锁章节失败',
      error: error.message
    });
  } finally {
    if (db) await db.end();
  }
});

// 启动时间解锁
router.post('/start-time-unlock/:chapterId/:userId', async (req, res) => {
  let db;
  try {
    const { userId, chapterId } = req.params;
    
    db = await mysql.createConnection(dbConfig);
    
    // 1. 检查章节是否存在
    const [chapters] = await db.execute(`
      SELECT c.*, n.title as novel_title 
      FROM chapter c 
      JOIN novel n ON c.novel_id = n.id 
      WHERE c.id = ?
    `, [chapterId]);
    
    if (chapters.length === 0) {
      return res.status(404).json({
        success: false,
        message: '章节不存在'
      });
    }
    
    const chapter = chapters[0];
    
    // 2. 检查用户是否存在
    const [users] = await db.execute('SELECT * FROM user WHERE id = ?', [userId]);
    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: '用户不存在'
      });
    }
    
    // 3. 检查章节是否已经解锁
    const [existingUnlocks] = await db.execute(`
      SELECT * FROM chapter_unlocks 
      WHERE user_id = ? AND chapter_id = ? AND status = 'unlocked'
    `, [userId, chapterId]);
    
    if (existingUnlocks.length > 0) {
      return res.status(400).json({ 
        success: false, 
        message: '章节已经解锁'
      });
    }
    
    // 4. 检查是否已有进行中的时间解锁
    const [pendingTimeUnlocks] = await db.execute(`
      SELECT * FROM chapter_unlocks 
      WHERE user_id = ? AND chapter_id = ? AND unlock_method = 'time_unlock' AND status = 'pending'
    `, [userId, chapterId]);
    
    if (pendingTimeUnlocks.length > 0) {
      // 如果已有进行中的时间解锁，直接返回现有记录信息
      const existingUnlock = pendingTimeUnlocks[0];
      const unlockAt = new Date(existingUnlock.unlock_at);
      const now = new Date();
      const timeRemaining = unlockAt.getTime() - now.getTime();
      
      // 计算倒计时信息
      const hours = Math.floor(timeRemaining / (1000 * 60 * 60));
      const minutes = Math.floor((timeRemaining % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((timeRemaining % (1000 * 60)) / 1000);
      
      return res.json({
        success: true,
        message: '时间解锁已在进行中',
        data: {
          chapterId: chapterId,
          userId: userId,
          unlockAt: existingUnlock.unlock_at,
          firstClickedAt: existingUnlock.first_clicked_at,
          timeRemaining: timeRemaining,
          countdown: {
            total_ms: timeRemaining,
            hours: hours,
            minutes: minutes,
            seconds: seconds,
            formatted: `${hours.toString().padStart(2, '0')}h:${minutes.toString().padStart(2, '0')}m:${seconds.toString().padStart(2, '0')}s`,
            is_expired: timeRemaining <= 0
          },
          isExisting: true
        }
      });
    }
    
    // 5. 检查前置章节条件
    // 获取当前章节信息
    const [currentChapter] = await db.execute(`
      SELECT * FROM chapter WHERE id = ?
    `, [chapterId]);
    
    if (currentChapter.length === 0) {
      return res.status(404).json({
        success: false,
        message: '章节不存在'
      });
    }
    
    const currentChapterData = currentChapter[0];
    
    // 检查前置章节是否免费或已解锁
    const [prevChapter] = await db.execute(`
      SELECT c.*, cu.status as unlock_status
      FROM chapter c
      LEFT JOIN chapter_unlocks cu ON cu.chapter_id = c.id AND cu.user_id = ? AND cu.status = 'unlocked'
      WHERE c.novel_id = ? AND c.chapter_number = ?
    `, [userId, currentChapterData.novel_id, currentChapterData.chapter_number - 1]);
    
    if (prevChapter.length === 0) {
      return res.status(400).json({
        success: false,
        message: '前置章节不存在'
      });
    }
    
    const prevChapterData = prevChapter[0];
    const isPrevChapterFree = !prevChapterData.is_premium;
    const isPrevChapterUnlocked = prevChapterData.unlock_status === 'unlocked';
    
    if (!isPrevChapterFree && !isPrevChapterUnlocked) {
      return res.status(400).json({
        success: false,
        message: '前置章节未解锁，无法开启时间解锁'
      });
    }
    
    // 6. 获取下一章节ID
    const [nextChapter] = await db.execute(`
      SELECT id FROM chapter 
      WHERE novel_id = ? AND chapter_number = ?
      ORDER BY chapter_number ASC
      LIMIT 1
    `, [currentChapterData.novel_id, currentChapterData.chapter_number + 1]);
    
    if (nextChapter.length === 0) {
      return res.status(400).json({
        success: false,
        message: '没有下一章节'
      });
    }
    
    const nextChapterId = nextChapter[0].id;
    
    // 7. 创建时间解锁记录（当前章节和下一章节）
    const now = new Date();
    const unlockAt = new Date(now.getTime() + 23 * 60 * 60 * 1000); // 23小时后解锁
    
    // 插入当前章节的时间解锁记录
    await db.execute(`
      INSERT INTO chapter_unlocks (user_id, chapter_id, unlock_method, status, created_at, first_clicked_at, unlock_at, updated_at, next_chapter_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [userId, chapterId, 'time_unlock', 'pending', now, now, unlockAt, now, nextChapterId]);
    
    // 插入下一章节的时间解锁记录（独立的一条记录）
    await db.execute(`
      INSERT INTO chapter_unlocks (user_id, chapter_id, unlock_method, status, created_at, first_clicked_at, unlock_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [userId, nextChapterId, 'time_unlock', 'pending', now, now, unlockAt, now]);
    
    console.log(`时间解锁已启动: 章节${chapterId}, 用户${userId}, 解锁时间: ${unlockAt.toISOString()}`);

    res.json({
      success: true,
      message: '时间解锁已启动',
      data: {
        chapterId: chapterId,
        userId: userId,
        unlockAt: unlockAt.toISOString(),
        timeRemaining: unlockAt.getTime() - now.getTime()
      }
    });

  } catch (error) {
    console.error('启动时间解锁失败:', error);
    res.status(500).json({
      success: false,
      message: '启动时间解锁失败: ' + error.message
    });
  } finally {
    if (db) await db.end();
  }
});

// 获取用户章节解锁记录
router.get('/unlock-history/:userId', async (req, res) => {
  let db;
  try {
    const { userId } = req.params;
    const { limit = 20, offset = 0 } = req.query;
    
    db = await mysql.createConnection(dbConfig);
    
    // 获取解锁记录
    const [unlocks] = await db.execute(`
      SELECT 
        cu.*,
        c.chapter_number,
        n.title as novel_title,
        c.title as chapter_title
      FROM chapter_unlocks cu
      JOIN chapter c ON cu.chapter_id = c.id
      JOIN novel n ON c.novel_id = n.id
      WHERE cu.user_id = ?
      ORDER BY cu.unlocked_at DESC
      LIMIT ? OFFSET ?
    `, [userId, parseInt(limit), parseInt(offset)]);
    
    // 获取总数
    const [countResult] = await db.execute(`
      SELECT COUNT(*) as total FROM chapter_unlocks WHERE user_id = ?
    `, [userId]);

    res.json({
      success: true,
      data: {
        unlocks,
        total: countResult[0].total,
        limit: parseInt(limit),
        offset: parseInt(offset)
      }
    });

  } catch (error) {
    console.error('获取解锁记录失败:', error);
    res.status(500).json({
      success: false,
      message: '获取解锁记录失败',
      error: error.message
    });
  } finally {
    if (db) await db.end();
  }
});

// 获取章节解锁状态
router.get('/status/:chapterId/:userId', async (req, res) => {
  let db;
  try {
    const { userId, chapterId } = req.params;
    
    db = await mysql.createConnection(dbConfig);
    
    // 获取章节信息
    const [chapters] = await db.execute(`
      SELECT c.*, n.title as novel_title 
      FROM chapter c 
      JOIN novel n ON c.novel_id = n.id 
      WHERE c.id = ?
    `, [chapterId]);
    
    if (chapters.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: '章节不存在' 
      });
    }
    
    const chapter = chapters[0];
    
    // 获取用户信息
    const [users] = await db.execute('SELECT * FROM user WHERE id = ?', [userId]);
    if (users.length === 0) {
      return res.status(404).json({
        success: false, 
        message: '用户不存在'
      });
    }
    
    const user = users[0];
    
    // 检查解锁状态
    const [unlocks] = await db.execute(`
      SELECT * FROM chapter_unlocks 
      WHERE user_id = ? AND chapter_id = ? AND status = 'unlocked'
    `, [userId, chapterId]);
    
    // 检查Champion会员状态
    const [championSubs] = await db.execute(`
      SELECT * FROM user_champion_subscription 
      WHERE user_id = ? AND novel_id = ? AND is_active = 1 AND end_date > NOW()
    `, [userId, chapter.novel_id]);
    
    const isUnlocked = unlocks.length > 0 || championSubs.length > 0;
    const unlockMethod = unlocks.length > 0 ? unlocks[0].unlock_method : 
                        championSubs.length > 0 ? 'champion' : 'none';
    
    // 获取时间解锁信息 - 检查是否有进行中的时间解锁
    let timeUnlockInfo = null;
    if (!isUnlocked) {
      const [timeUnlockResults] = await db.execute(`
        SELECT * FROM chapter_unlocks 
        WHERE user_id = ? AND chapter_id = ? AND unlock_method = 'time_unlock' AND status = 'pending'
        ORDER BY created_at DESC
        LIMIT 1
      `, [userId, chapterId]);
      
      if (timeUnlockResults.length > 0) {
        const timeUnlock = timeUnlockResults[0];
        const unlockAt = new Date(timeUnlock.unlock_at);
        const now = new Date();
        const timeRemaining = unlockAt.getTime() - now.getTime();
        
        // 检查是否已到解锁时间
        if (timeRemaining <= 0) {
          // 自动解锁当前章节和下一章节
          console.log(`⏰ 时间解锁到期，自动解锁章节 ${chapterId}`);
          
          // 解锁当前章节
          await db.execute(`
            UPDATE chapter_unlocks 
            SET status = 'unlocked', unlocked_at = NOW(), updated_at = NOW()
            WHERE user_id = ? AND chapter_id = ? AND unlock_method = 'time_unlock' AND status = 'pending'
          `, [userId, chapterId]);
          
          // 如果有下一章节，也解锁下一章节
          if (timeUnlock.next_chapter_id) {
            console.log(`⏰ 同时解锁下一章节 ${timeUnlock.next_chapter_id}`);
            await db.execute(`
              UPDATE chapter_unlocks 
              SET status = 'unlocked', unlocked_at = NOW(), updated_at = NOW()
              WHERE user_id = ? AND chapter_id = ? AND unlock_method = 'time_unlock' AND status = 'pending'
            `, [userId, timeUnlock.next_chapter_id]);
          }
          
          // 重新检查解锁状态
          const [newUnlocks] = await db.execute(`
            SELECT * FROM chapter_unlocks 
            WHERE user_id = ? AND chapter_id = ? AND status = 'unlocked'
          `, [userId, chapterId]);
          
          if (newUnlocks.length > 0) {
            // 章节已解锁，更新状态
            isUnlocked = true;
            unlockMethod = newUnlocks[0].unlock_method;
          }
        } else {
          // 时间未到，返回倒计时信息
          timeUnlockInfo = {
            status: 'pending',
            unlockAt: timeUnlock.unlock_at,
            firstClickedAt: timeUnlock.first_clicked_at,
            timeRemaining: timeRemaining,
            countdown: {
              total_ms: timeRemaining,
              hours: Math.floor(timeRemaining / (1000 * 60 * 60)),
              minutes: Math.floor((timeRemaining % (1000 * 60 * 60)) / (1000 * 60)),
              seconds: Math.floor((timeRemaining % (1000 * 60)) / 1000),
              formatted: `${Math.floor(timeRemaining / (1000 * 60 * 60)).toString().padStart(2, '0')}h:${Math.floor((timeRemaining % (1000 * 60 * 60)) / (1000 * 60)).toString().padStart(2, '0')}m:${Math.floor((timeRemaining % (1000 * 60)) / 1000).toString().padStart(2, '0')}s`,
              is_expired: timeRemaining <= 0
            }
          };
        }
      }
    }
      
      res.json({
        success: true,
        data: {
          chapterId: chapterId,
        novelTitle: chapter.novel_title,
        chapterNumber: chapter.chapter_number,
        isPremium: chapter.is_premium,
        keyCost: chapter.key_cost,
        unlockPrice: chapter.unlock_price,
        isUnlocked: isUnlocked,
        unlockMethod: unlockMethod,
        userKeyBalance: user.points,
        userKarmaBalance: user.golden_karma,
        canUnlockWithKey: user.points >= chapter.key_cost && chapter.key_cost > 0,
        canUnlockWithKarma: user.golden_karma >= chapter.unlock_price && chapter.unlock_price > 0,
        hasChampionSubscription: championSubs.length > 0,
        timeUnlock: timeUnlockInfo
      }
    });
    
  } catch (error) {
    console.error('获取解锁状态失败:', error);
    res.status(500).json({ 
      success: false, 
      message: '获取解锁状态失败',
      error: error.message
    });
  } finally {
    if (db) await db.end();
  }
});

module.exports = router;