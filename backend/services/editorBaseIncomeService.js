const mysql = require('mysql2/promise');
const Decimal = require('decimal.js');

/**
 * 编辑基础收入服务（编辑基础收入-4）- 修正版
 * 
 * 功能：从 reader_spending 表按月计算编辑/主编的收入，写入 editor_income_monthly 表
 * 
 * 数据来源：
 * - reader_spending 表（按 settlement_month 过滤）
 * - chapter 表（章节编辑信息和有效字数）
 * - novel_editor_contract 表（编辑合同，按 novel_id + role 查找，需考虑日期有效期）
 * 
 * ========== 业务规则说明 ==========
 * 
 * 1. 章节解锁（source_type='chapter_unlock'）：
 *    计算公式：income = reader_spending.amount_usd × contract.share_percent
 *    - 每条 reader_spending 单独生成一组明细（最多两条：编辑+主编）
 *    - 使用章节的有效字数（word_count 为空则用 content 字数）
 *    - 合同按 novel_id + role 查找，需满足：
 *      * share_type = 'percent_of_book'
 *      * status = 'active'
 *      * start_date <= settlementMonth
 *      * (end_date IS NULL OR end_date >= settlementMonth)
 * 
 * 2. 订阅（source_type='subscription'）：
 *    计算公式：income = reader_spending.amount_usd × contract.share_percent × (该编辑字数 / 总字数)
 *    - 每条 reader_spending 按整本小说所有已审核章节的字数占比分配给多名编辑/主编
 *    - 总字数 = 该小说所有 review_status='approved' AND is_released=1 的章节有效字数之和
 *    - 权重按字数：该编辑/主编的审核字数 ÷ 总字数
 *    - 合同过滤规则同章节解锁
 * 
 * 3. 合同有效期判定规则：
 *    - start_date <= settlementMonth（合同开始日期必须在结算月之前或当天）
 *    - end_date IS NULL OR end_date >= settlementMonth（合同结束日期必须在结算月之后或当天，或未设置）
 *    - 章节范围（start_chapter_id / end_chapter_id）暂不参与过滤
 * 
 * ========== 调用示例 ==========
 * 
 * const { generateEditorBaseIncomeForMonth } = require('./services/editorBaseIncomeService');
 * 
 * // 生成 2025-10 的编辑基础收入
 * await generateEditorBaseIncomeForMonth('2025-10');
 * 
 * // 重新生成某月数据：直接再次调用即可（函数开头会自动删除当月旧数据）
 */

/**
 * 金额精度处理函数
 * @param {number|string|null} val - 数值
 * @param {number} scale - 小数位数
 * @returns {string|null} 格式化后的字符串
 */
function toDecimal(val, scale = 6) {
  if (val == null) return null;
  return Number(val).toFixed(scale);
}

class EditorBaseIncomeService {
  constructor(dbConfig) {
    this.dbConfig = dbConfig;
  }

  /**
   * 创建数据库连接
   */
  async createConnection() {
    return await mysql.createConnection(this.dbConfig);
  }

  /**
   * 生成指定月份的编辑基础收入
   * @param {string} month - 月份，格式：'YYYY-MM'，例如 '2025-11'
   * @returns {Promise<Object>} 生成结果
   */
  async generateEditorBaseIncomeForMonth(month) {
    const db = await this.createConnection();
    
    try {
      await db.beginTransaction();
      
      // ========== 公共准备 ==========
      const settlementMonth = `${month}-01`; // 转换为 '2025-11-01'
      
      console.log(`[editor-base-income] 开始生成 ${month} 的编辑基础收入，settlementMonth: ${settlementMonth}`);
      
      // 1. 清空当月旧数据
      const [deleteResult] = await db.execute(
        `DELETE FROM editor_income_monthly WHERE month = ?`,
        [settlementMonth]
      );
      console.log(`[editor-base-income] 删除旧数据: ${deleteResult.affectedRows} 条`);
      
      // 2. 读当月 reader_spending（chapter_unlock + subscription）
      const [spendings] = await db.execute(
        `SELECT id, novel_id, amount_usd, source_type, source_id, spend_time
         FROM reader_spending
         WHERE settlement_month = ?
         ORDER BY spend_time`,
        [settlementMonth]
      );
      
      console.log(`[editor-base-income] 查询到 reader_spending 记录数: ${spendings.length}`);
      
      if (spendings.length === 0) {
        await db.commit();
        return {
          month: settlementMonth,
          totalSpendings: 0,
          totalEditorIncomeUsd: '0',
          recordsInserted: 0
        };
      }
      
      const chapterUnlockSpendings = spendings.filter(s => s.source_type === 'chapter_unlock');
      const subscriptionSpendings = spendings.filter(s => s.source_type === 'subscription');
      
      console.log(`[editor-base-income] 章节解锁: ${chapterUnlockSpendings.length} 条，订阅: ${subscriptionSpendings.length} 条`);
      
      // 3. 预加载章节信息（章节解锁用）
      const chapterUnlockContext = await this.loadChapterUnlockContext(db, chapterUnlockSpendings);
      
      // 4. 预加载订阅的章节统计（按字数）
      const subscriptionChapterStats = await this.loadSubscriptionChapterStats(db, subscriptionSpendings);
      
      // 5. 预加载合同（修复：按 novel_id + role 找 active 合同，需考虑日期有效期）
      const novelContracts = await this.loadNovelRoleContracts(db, spendings, settlementMonth);
      
      // 6. 逐条 spending 生成明细（chapter_unlock）
      const rows = [];
      await this.generateFromChapterUnlock(
        rows,
        chapterUnlockSpendings,
        chapterUnlockContext,
        novelContracts,
        settlementMonth
      );
      
      // 7. 逐条 spending 生成明细（subscription，按字数）
      await this.generateFromSubscription(
        rows,
        subscriptionSpendings,
        subscriptionChapterStats,
        novelContracts,
        settlementMonth
      );
      
      // 8. 批量插入 editor_income_monthly
      await this.batchInsertEditorIncome(db, rows);
      
      await db.commit();
      
      // 9. 统计汇总
      const unlockRows = rows.filter(r => r.source_type === 'chapter_unlock');
      const subscriptionRows = rows.filter(r => r.source_type === 'subscription');
      
      const totalEditorIncome = rows.reduce((sum, row) => {
        return sum.plus(new Decimal(row.editor_income_usd || 0));
      }, new Decimal(0));
      
      // 汇总日志
      console.log(
        `[editor-base-income] 生成完成 ${settlementMonth}: 删除旧记录=${deleteResult.affectedRows} 条, 新增记录=${rows.length} 条 (章节解锁=${unlockRows.length}, 订阅=${subscriptionRows.length})`
      );
      
      return {
        month: settlementMonth,
        totalSpendings: spendings.length,
        totalEditorIncomeUsd: totalEditorIncome.toString(),
        recordsInserted: rows.length,
        unlockRowsCount: unlockRows.length,
        subscriptionRowsCount: subscriptionRows.length
      };
      
    } catch (error) {
      await db.rollback();
      console.error('[editor-base-income] 生成失败:', error);
      throw error;
    } finally {
      await db.end();
    }
  }

  /**
   * 加载章节解锁上下文（章节解锁用）
   * @param {Connection} db - 数据库连接
   * @param {Array} chapterUnlockSpendings - 章节解锁的 reader_spending 记录
   * @returns {Promise<Object>} { unlockMap: Map<unlockId, chapterId>, chapterMap: Map<chapterId, chapterInfo> }
   */
  async loadChapterUnlockContext(db, chapterUnlockSpendings) {
    if (!chapterUnlockSpendings || chapterUnlockSpendings.length === 0) {
      return { unlockMap: new Map(), chapterMap: new Map() };
    }
    
    const unlockIds = [...new Set(chapterUnlockSpendings.map(s => s.source_id))];
    
    // 查询 chapter_unlocks，拿到 chapter_id
    // 修复：mysql2 不支持 IN (?) 直接传入数组，需要展开占位符
    const unlockPlaceholders = unlockIds.map(() => '?').join(',');
    const [chapterUnlocks] = await db.query(
      `SELECT id, chapter_id
       FROM chapter_unlocks
       WHERE id IN (${unlockPlaceholders})`,
      unlockIds
    );
    
    const chapterIds = [...new Set(chapterUnlocks.map(cu => cu.chapter_id))];
    
    if (chapterIds.length === 0) {
      return { unlockMap: new Map(), chapterMap: new Map() };
    }
    
    // 查询 chapter，计算有效字数（word_count 为空则用 content 字数）
    // 修复：mysql2 不支持 IN (?) 直接传入数组，需要展开占位符
    const chapterPlaceholders = chapterIds.map(() => '?').join(',');
    const [chapters] = await db.query(
      `SELECT
         id,
         novel_id,
         editor_admin_id,
         chief_editor_admin_id,
         review_status,
         is_released,
         word_count,
         CASE
           WHEN (word_count IS NULL OR word_count = 0) THEN
             CHAR_LENGTH(content)
           ELSE
             word_count
         END AS effective_word_count
       FROM chapter
       WHERE id IN (${chapterPlaceholders})`,
      chapterIds
    );
    
    // 建立映射
    const unlockMap = new Map(); // chapter_unlocks.id -> chapter_id
    const chapterMap = new Map(); // chapter.id -> { novel_id, editor_admin_id, chief_editor_admin_id, review_status, is_released, effective_word_count }
    
    for (const cu of chapterUnlocks) {
      unlockMap.set(cu.id, cu.chapter_id);
    }
    
    for (const ch of chapters) {
      chapterMap.set(ch.id, {
        novel_id: ch.novel_id,
        editor_admin_id: ch.editor_admin_id,
        chief_editor_admin_id: ch.chief_editor_admin_id,
        review_status: ch.review_status,
        is_released: ch.is_released,
        effective_word_count: parseInt(ch.effective_word_count) || 0
      });
    }
    
    console.log(`[editor-base-income] 章节解锁上下文: unlock记录=${chapterUnlocks.length}, 章节记录=${chapterMap.size}`);
    
    return { unlockMap, chapterMap };
  }

  /**
   * 加载订阅的章节统计（按字数）
   * @param {Connection} db - 数据库连接
   * @param {Array} subscriptionSpendings - 订阅的 reader_spending 记录
   * @returns {Promise<Map>} novelId -> { totalWordCount, totalChapterCount, editorWordMap, editorChapterCountMap, chiefWordMap, chiefChapterCountMap }
   */
  async loadSubscriptionChapterStats(db, subscriptionSpendings) {
    if (!subscriptionSpendings || subscriptionSpendings.length === 0) {
      return new Map();
    }
    
    const novelIds = [...new Set(subscriptionSpendings.map(s => s.novel_id))];
    
    if (novelIds.length === 0) {
      return new Map();
    }
    
    // 查询这些小说的章节，按 review_status='approved' AND is_released=1 过滤，并计算有效字数
    // 修复：mysql2 不支持 IN (?) 直接传入数组，需要展开占位符
    const novelPlaceholders = novelIds.map(() => '?').join(',');
    const [chapters] = await db.query(
      `SELECT
         id,
         novel_id,
         editor_admin_id,
         chief_editor_admin_id,
         review_status,
         is_released,
         CASE
           WHEN (word_count IS NULL OR word_count = 0) THEN
             CHAR_LENGTH(content)
           ELSE
             word_count
         END AS effective_word_count
       FROM chapter
       WHERE novel_id IN (${novelPlaceholders})
         AND review_status = 'approved'
         AND is_released = 1`,
      novelIds
    );
    
    // 按 novel_id 分组统计
    const statsMap = new Map();
    
    for (const novelId of novelIds) {
      statsMap.set(novelId, {
        totalWordCount: 0,
        totalChapterCount: 0,
        editorWordMap: new Map(), // editor_admin_id -> word_count
        editorChapterCountMap: new Map(), // editor_admin_id -> chapter_count
        chiefWordMap: new Map(), // chief_editor_admin_id -> word_count
        chiefChapterCountMap: new Map() // chief_editor_admin_id -> chapter_count
      });
    }
    
    for (const ch of chapters) {
      const words = parseInt(ch.effective_word_count) || 0;
      const stats = statsMap.get(ch.novel_id);
      
      if (!stats) continue;
      
      // 所有已审核章节都计入总字数
      stats.totalWordCount += words;
      stats.totalChapterCount += 1;
      
      // 编辑字数统计
      if (ch.editor_admin_id !== null) {
        const editorId = ch.editor_admin_id;
        stats.editorWordMap.set(editorId, (stats.editorWordMap.get(editorId) || 0) + words);
        stats.editorChapterCountMap.set(editorId, (stats.editorChapterCountMap.get(editorId) || 0) + 1);
      }
      
      // 主编字数统计
      if (ch.chief_editor_admin_id !== null) {
        const chiefId = ch.chief_editor_admin_id;
        stats.chiefWordMap.set(chiefId, (stats.chiefWordMap.get(chiefId) || 0) + words);
        stats.chiefChapterCountMap.set(chiefId, (stats.chiefChapterCountMap.get(chiefId) || 0) + 1);
      }
    }
    
    console.log(`[editor-base-income] 订阅章节统计: 小说数=${novelIds.length}, 已审核章节总数=${chapters.length}`);
    
    return statsMap;
  }

  /**
   * 加载合同（修复：按 novel_id + role 找 active 合同，需考虑日期有效期）
   * @param {Connection} db - 数据库连接
   * @param {Array} spendings - reader_spending 记录
   * @param {string} settlementMonth - 结算月份（格式：'YYYY-MM-01'）
   * @returns {Promise<Map>} novelId -> { editorContract, chiefContract }
   */
  async loadNovelRoleContracts(db, spendings, settlementMonth) {
    if (!spendings || spendings.length === 0) {
      return new Map();
    }
    
    const novelIds = [...new Set(spendings.map(s => s.novel_id))];
    
    if (novelIds.length === 0) {
      return new Map();
    }
    
    // 修复：mysql2 不支持 IN (?) 直接传入数组，需要展开占位符
    const placeholders = novelIds.map(() => '?').join(',');
    
    // 一次性查询所有相关合同（修复：添加日期过滤）
    const [contracts] = await db.execute(
      `SELECT
         id,
         novel_id,
         editor_admin_id,
         role,
         share_type,
         share_percent,
         status,
         start_date,
         end_date,
         start_chapter_id,
         end_chapter_id
       FROM novel_editor_contract
       WHERE novel_id IN (${placeholders})
         AND share_type = 'percent_of_book'
         AND status = 'active'
         AND (start_date IS NULL OR start_date <= ?)
         AND (end_date IS NULL OR end_date >= ?)
       ORDER BY novel_id, role, start_date DESC, id DESC`,
      [...novelIds, settlementMonth, settlementMonth]
    );
    
    // 按 novel_id + role 分组，每个组合取第一条（最晚生效且在结算月有效的合同）
    const contractMap = new Map(); // novelId -> { editorContract, chiefContract }
    
    for (const novelId of novelIds) {
      contractMap.set(novelId, {
        editorContract: null,
        chiefContract: null
      });
    }
    
    for (const contract of contracts) {
      const nc = contractMap.get(contract.novel_id);
      if (!nc) continue;
      
      if (contract.role === 'editor' && !nc.editorContract) {
        nc.editorContract = contract;
      } else if (contract.role === 'chief_editor' && !nc.chiefContract) {
        nc.chiefContract = contract;
      }
    }
    
    const editorContractCount = Array.from(contractMap.values()).filter(nc => nc.editorContract).length;
    const chiefContractCount = Array.from(contractMap.values()).filter(nc => nc.chiefContract).length;
    
    console.log(
      `[editor-base-income] 合同加载完毕: 小说数=${novelIds.length}, 其中有编辑合同=${editorContractCount}, 有主编合同=${chiefContractCount}`
    );
    
    return contractMap;
  }

  /**
   * 从章节解锁生成明细（按条 + 有效字数）
   * @param {Array} rows - 待插入的记录数组
   * @param {Array} chapterUnlockSpendings - 章节解锁的 reader_spending 记录
   * @param {Object} chapterUnlockContext - 章节解锁上下文
   * @param {Map} novelContracts - 小说合同 Map
   * @param {string} settlementMonth - 结算月份
   */
  async generateFromChapterUnlock(rows, chapterUnlockSpendings, chapterUnlockContext, novelContracts, settlementMonth) {
    const { unlockMap, chapterMap } = chapterUnlockContext;
    const unlockRows = []; // 用于统计
    
    for (const spending of chapterUnlockSpendings) {
      try {
        const chapterId = unlockMap.get(spending.source_id);
        if (!chapterId) {
          console.warn(`[editor-base-income] 章节解锁记录 ${spending.id} 找不到对应的 chapter_unlocks.id=${spending.source_id}`);
          continue;
        }
        
        const chapter = chapterMap.get(chapterId);
        if (!chapter) {
          console.warn(`[editor-base-income] 章节解锁记录 ${spending.id} 找不到对应的 chapter.id=${chapterId}`);
          continue;
        }
        
        const words = chapter.effective_word_count || 0;
        const amount = new Decimal(spending.amount_usd);
        
        // 从 novelContracts 里取出合同
        const nc = novelContracts.get(spending.novel_id);
        const editorContract = nc?.editorContract || null;
        const chiefContract = nc?.chiefContract || null;
        
        // 编辑收入：如果 chapter.editor_admin_id 不为空，并且有 editorContract
        if (chapter.editor_admin_id && chapter.editor_admin_id !== null && editorContract) {
          const sharePercent = new Decimal(editorContract.share_percent);
          const income = amount.mul(sharePercent);
          
          unlockRows.push({
            editor_admin_id: chapter.editor_admin_id,
            role: 'editor',
            novel_id: spending.novel_id,
            month: settlementMonth,
            source_type: 'chapter_unlock',
            source_spend_id: spending.id,
            chapter_id: chapterId,
            chapter_count_total: 1,
            chapter_count_editor: 1,
            total_word_count: words,
            editor_word_count: words,
            gross_book_income_usd: toDecimal(amount.toNumber(), 6),
            contract_share_percent: toDecimal(sharePercent.toNumber(), 4),
            editor_share_percent: toDecimal(sharePercent.toNumber(), 4), // 对章节解锁来说就是合同比例
            editor_income_usd: toDecimal(income.toNumber(), 6)
          });
        } else if (chapter.editor_admin_id && chapter.editor_admin_id !== null && !editorContract) {
          console.warn(
            `[editor-base-income] 章节解锁记录 ${spending.id} 的小说 ${spending.novel_id} 没有编辑合同 (admin_id=${chapter.editor_admin_id})`
          );
        }
        
        // 主编收入：如果 chapter.chief_editor_admin_id 不为空，并且有 chiefContract
        if (chapter.chief_editor_admin_id && chapter.chief_editor_admin_id !== null && chiefContract) {
          const sharePercent = new Decimal(chiefContract.share_percent);
          const income = amount.mul(sharePercent);
          
          unlockRows.push({
            editor_admin_id: chapter.chief_editor_admin_id,
            role: 'chief_editor',
            novel_id: spending.novel_id,
            month: settlementMonth,
            source_type: 'chapter_unlock',
            source_spend_id: spending.id,
            chapter_id: chapterId,
            chapter_count_total: 1,
            chapter_count_editor: 1,
            total_word_count: words,
            editor_word_count: words,
            gross_book_income_usd: toDecimal(amount.toNumber(), 6),
            contract_share_percent: toDecimal(sharePercent.toNumber(), 4),
            editor_share_percent: toDecimal(sharePercent.toNumber(), 4), // 对章节解锁来说就是合同比例
            editor_income_usd: toDecimal(income.toNumber(), 6)
          });
        } else if (chapter.chief_editor_admin_id && chapter.chief_editor_admin_id !== null && !chiefContract) {
          console.warn(
            `[editor-base-income] 章节解锁记录 ${spending.id} 的小说 ${spending.novel_id} 没有主编合同 (admin_id=${chapter.chief_editor_admin_id})`
          );
        }
        
      } catch (error) {
        console.error(`[editor-base-income] 处理章节解锁记录 ${spending.id} 失败:`, error);
        // 继续处理下一条
      }
    }
    
    // 将解锁记录添加到总数组
    rows.push(...unlockRows);
    
    console.log(
      `[editor-base-income] 章节解锁生成明细: ${unlockRows.length} 条 (spending条数=${chapterUnlockSpendings.length})`
    );
  }

  /**
   * 从订阅生成明细（按字数 + 每条 spending）
   * @param {Array} rows - 待插入的记录数组
   * @param {Array} subscriptionSpendings - 订阅的 reader_spending 记录
   * @param {Map} subscriptionChapterStats - 订阅章节统计 Map
   * @param {Map} novelContracts - 小说合同 Map
   * @param {string} settlementMonth - 结算月份
   */
  async generateFromSubscription(rows, subscriptionSpendings, subscriptionChapterStats, novelContracts, settlementMonth) {
    const subscriptionRows = []; // 用于统计
    
    for (const spending of subscriptionSpendings) {
      try {
        const stats = subscriptionChapterStats.get(spending.novel_id);
        
        if (!stats || stats.totalWordCount <= 0) {
          console.warn(`[editor-base-income] 订阅记录 ${spending.id} 的小说 ${spending.novel_id} 没有可分配的已审核章节`);
          continue;
        }
        
        const amount = new Decimal(spending.amount_usd);
        
        // 从 novelContracts 里取出合同
        const nc = novelContracts.get(spending.novel_id);
        const editorContract = nc?.editorContract || null;
        const chiefContract = nc?.chiefContract || null;
        
        // 编辑分成：如果有 editorContract，则对所有在本小说有 wordCount 的编辑进行分配
        if (editorContract) {
          const basePercent = new Decimal(editorContract.share_percent);
          
          for (const [editorId, editorWordCount] of stats.editorWordMap.entries()) {
            if (!editorWordCount || editorWordCount <= 0) continue;
            
            const wordRatio = new Decimal(editorWordCount).div(stats.totalWordCount);
            const income = amount.mul(basePercent).mul(wordRatio);
            
            subscriptionRows.push({
              editor_admin_id: editorId,
              role: 'editor',
              novel_id: spending.novel_id,
              month: settlementMonth,
              source_type: 'subscription',
              source_spend_id: spending.id,
              chapter_id: null,
              chapter_count_total: stats.totalChapterCount,
              chapter_count_editor: stats.editorChapterCountMap.get(editorId) || 0,
              total_word_count: stats.totalWordCount,
              editor_word_count: editorWordCount,
              gross_book_income_usd: toDecimal(amount.toNumber(), 6),
              contract_share_percent: toDecimal(basePercent.toNumber(), 4),
              editor_share_percent: toDecimal(basePercent.mul(wordRatio).toNumber(), 4), // "实际生效的比例"
              editor_income_usd: toDecimal(income.toNumber(), 6)
            });
          }
        } else {
          console.warn(`[editor-base-income] 订阅记录 ${spending.id} 的小说 ${spending.novel_id} 没有编辑角色合同`);
        }
        
        // 主编分成：如果有 chiefContract，对所有有字数的主编同样处理
        if (chiefContract) {
          const basePercent = new Decimal(chiefContract.share_percent);
          
          for (const [chiefId, chiefWordCount] of stats.chiefWordMap.entries()) {
            if (!chiefWordCount || chiefWordCount <= 0) continue;
            
            const wordRatio = new Decimal(chiefWordCount).div(stats.totalWordCount);
            const income = amount.mul(basePercent).mul(wordRatio);
            
            subscriptionRows.push({
              editor_admin_id: chiefId,
              role: 'chief_editor',
              novel_id: spending.novel_id,
              month: settlementMonth,
              source_type: 'subscription',
              source_spend_id: spending.id,
              chapter_id: null,
              chapter_count_total: stats.totalChapterCount,
              chapter_count_editor: stats.chiefChapterCountMap.get(chiefId) || 0,
              total_word_count: stats.totalWordCount,
              editor_word_count: chiefWordCount,
              gross_book_income_usd: toDecimal(amount.toNumber(), 6),
              contract_share_percent: toDecimal(basePercent.toNumber(), 4),
              editor_share_percent: toDecimal(basePercent.mul(wordRatio).toNumber(), 4),
              editor_income_usd: toDecimal(income.toNumber(), 6)
            });
          }
        } else {
          console.warn(`[editor-base-income] 订阅记录 ${spending.id} 的小说 ${spending.novel_id} 没有主编角色合同`);
        }
        
      } catch (error) {
        console.error(`[editor-base-income] 处理订阅记录 ${spending.id} 失败:`, error);
        // 继续处理下一条
      }
    }
    
    // 将订阅记录添加到总数组
    rows.push(...subscriptionRows);
    
    console.log(
      `[editor-base-income] 订阅生成明细: ${subscriptionRows.length} 条 (spending条数=${subscriptionSpendings.length})`
    );
  }

  /**
   * 批量插入 editor_income_monthly
   * @param {Connection} db - 数据库连接
   * @param {Array} rows - 待插入的记录数组
   */
  async batchInsertEditorIncome(db, rows) {
    if (rows.length === 0) {
      return;
    }
    
    // 分批插入，每批 500 条
    const batchSize = 500;
    
    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize);
      
      // 注意：字段顺序必须与 INSERT 语句中的字段顺序完全一致
      const values = batch.map(row => [
        row.editor_admin_id,
        row.role,
        row.novel_id,
        row.month,
        row.source_spend_id,
        row.source_type,
        row.chapter_id,
        row.chapter_count_total,
        row.chapter_count_editor,
        row.total_word_count,
        row.editor_word_count,
        row.gross_book_income_usd,
        row.editor_share_percent,      // 注意：editor_share_percent 在 contract_share_percent 之前
        row.contract_share_percent,
        row.editor_income_usd
      ]);
      
      // 修复：占位符数量应该与字段数量一致（15个字段）
      const fieldCount = 15;
      const placeholder = '(' + Array(fieldCount).fill('?').join(', ') + ')';
      const placeholders = values.map(() => placeholder).join(', ');
      const flatValues = values.flat();
      
      await db.execute(
        `INSERT INTO editor_income_monthly
         (editor_admin_id, role, novel_id, month, source_spend_id, source_type, chapter_id,
          chapter_count_total, chapter_count_editor, total_word_count, editor_word_count,
          gross_book_income_usd, editor_share_percent, contract_share_percent, editor_income_usd)
         VALUES ${placeholders}`,
        flatValues
      );
    }
    
    console.log(`[editor-base-income] 批量插入完成: ${rows.length} 条记录`);
  }
}

module.exports = { generateEditorBaseIncomeForMonth: async (month) => {
  const service = new EditorBaseIncomeService({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '123456',
    database: process.env.DB_NAME || 'kongfuworld',
    charset: 'utf8mb4'
  });
  return await service.generateEditorBaseIncomeForMonth(month);
}};
