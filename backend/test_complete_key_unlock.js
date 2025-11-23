const mysql = require('mysql2/promise');

const dbConfig = {
  host: 'localhost',
  user: 'root',
  password: '123456',
  database: 'kongfuworld'
};

// 模拟recordKeyTransaction函数
async function recordKeyTransaction(db, userId, transactionType, amount, referenceId = null, referenceType = null, description = null) {
  try {
    // 获取当前余额
    const [userResult] = await db.execute('SELECT points FROM user WHERE id = ?', [userId]);
    if (userResult.length === 0) {
      throw new Error('用户不存在');
    }
    
    const balanceBefore = userResult[0].points;
    const balanceAfter = balanceBefore + amount;
    
    // 检查余额是否足够（如果是减少）
    if (amount < 0 && balanceAfter < 0) {
      throw new Error('余额不足');
    }
    
    // 更新用户余额
    await db.execute('UPDATE user SET points = ? WHERE id = ?', [balanceAfter, userId]);
    
    // 记录变动
    const [result] = await db.execute(`
      INSERT INTO key_transaction (
        user_id, transaction_type, amount, balance_before, balance_after,
        reference_id, reference_type, description
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [userId, transactionType, amount, balanceBefore, balanceAfter, referenceId, referenceType, description]);
    
    return {
      success: true,
      transactionId: result.insertId,
      balanceBefore,
      balanceAfter,
      amount
    };
    
  } catch (error) {
    throw error;
  }
}

async function testCompleteKeyUnlock() {
  let db;
  try {
    db = await mysql.createConnection(dbConfig);
    console.log('🔑 测试完整Key解锁流程...');
    
    const userId = 1;
    const chapterId = 1362;
    const keyCost = 1;
    
    // 开始事务
    await db.query('START TRANSACTION');
    
    try {
      // 1. 检查章节信息
      const [chapters] = await db.execute(`
        SELECT c.*, n.title as novel_title 
        FROM chapter c
        JOIN novel n ON c.novel_id = n.id 
        WHERE c.id = ?
      `, [chapterId]);
      
      if (chapters.length === 0) {
        throw new Error('章节不存在');
      }
      
      const chapter = chapters[0];
      console.log(`📖 章节: ${chapter.novel_title} 第${chapter.chapter_number}章, Key消耗: ${chapter.key_cost}`);
      
      // 2. 检查用户信息
      const [users] = await db.execute('SELECT * FROM user WHERE id = ?', [userId]);
      if (users.length === 0) {
        throw new Error('用户不存在');
      }
      
      const user = users[0];
      console.log(`👤 用户: ${user.username}, Key余额: ${user.points}`);
      
      // 3. 检查Key余额
      if (user.points < chapter.key_cost) {
        throw new Error(`Key余额不足，需要${chapter.key_cost}个Key，当前余额${user.points}个`);
      }
      
      // 4. 记录Key消耗
      console.log('💰 记录Key消耗...');
      const keyTransaction = await recordKeyTransaction(
        db,
        userId,
        'unlock',
        -chapter.key_cost, // 负数表示消耗
        chapterId,
        'chapter',
        `解锁章节: ${chapter.novel_title} 第${chapter.chapter_number}章`
      );
      
      console.log(`✅ Key消耗记录成功: 交易ID=${keyTransaction.transactionId}, 余额变化=${keyTransaction.balanceBefore}->${keyTransaction.balanceAfter}`);
      
      // 5. 检查是否已存在解锁记录
      const [existingUnlocks] = await db.execute(`
        SELECT * FROM chapter_unlocks 
        WHERE user_id = ? AND chapter_id = ?
      `, [userId, chapterId]);
      
      console.log(`📊 找到 ${existingUnlocks.length} 条现有记录`);
      
      if (existingUnlocks.length > 0) {
        // 如果已存在记录，更新为Key解锁
        console.log('🔄 更新现有记录为Key解锁...');
        const [updateResult] = await db.execute(`
          UPDATE chapter_unlocks 
          SET unlock_method = 'key', cost = ?, status = 'unlocked', unlocked_at = NOW()
          WHERE user_id = ? AND chapter_id = ?
        `, [chapter.key_cost, userId, chapterId]);
        
        console.log(`✅ 更新完成，影响行数: ${updateResult.affectedRows}`);
      } else {
        // 如果不存在记录，插入新的Key解锁记录
        console.log('➕ 创建新的Key解锁记录...');
        const [insertResult] = await db.execute(`
          INSERT INTO chapter_unlocks (
            user_id, chapter_id, unlock_method, cost, status, unlocked_at
          ) VALUES (?, ?, 'key', ?, 'unlocked', NOW())
        `, [userId, chapterId, chapter.key_cost]);
        
        console.log(`✅ 插入完成，记录ID: ${insertResult.insertId}`);
      }
      
      // 提交事务
      await db.query('COMMIT');
      console.log('✅ 事务提交成功');
      
      // 验证最终结果
      const [finalRecords] = await db.execute(`
        SELECT * FROM chapter_unlocks 
        WHERE user_id = ? AND chapter_id = ?
      `, [userId, chapterId]);
      
      if (finalRecords.length > 0) {
        const record = finalRecords[0];
        console.log(`📊 最终记录: ID=${record.id}, 方法=${record.unlock_method}, 状态=${record.status}, 消耗=${record.cost}`);
      }
      
    } catch (error) {
      // 回滚事务
      await db.query('ROLLBACK');
      console.error('❌ 事务回滚:', error.message);
      throw error;
    }
    
  } catch (error) {
    console.error('❌ 测试失败:', error.message);
  } finally {
    if (db) await db.end();
  }
}

testCompleteKeyUnlock();
