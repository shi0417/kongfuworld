const mysql = require('mysql2/promise');

/**
 * 编辑收入服务
 * 处理编辑收入计算和分配相关的业务逻辑
 */
class EditorIncomeService {
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
   * 计算并分配某小说某月的 Champion 收入给编辑
   * @param {number} novelId - 小说ID
   * @param {string} month - 月份，格式：'YYYY-MM' 或 'YYYY-MM-DD'
   * @returns {Promise<Object>} 计算结果
   */
  async calculateChampionIncomeForNovel(novelId, month) {
    const db = await this.createConnection();
    try {
      await db.beginTransaction();

      // 解析月份格式，统一转换为 DATE 格式（YYYY-MM-01）
      let monthDate;
      if (month.match(/^\d{4}-\d{2}$/)) {
        monthDate = `${month}-01`;
      } else if (month.match(/^\d{4}-\d{2}-\d{2}$/)) {
        monthDate = month.substring(0, 7) + '-01';
      } else {
        throw new Error('月份格式错误，应为 YYYY-MM 或 YYYY-MM-DD');
      }

      // Step 1: 查询该小说当月 champion 收入
      // 注意：如果 novel_income_monthly 表不存在，需要先创建
      // 这里假设表结构为：novel_id, month (DATE), income_type (VARCHAR), income_usd (DECIMAL)
      let championIncome = 0;
      try {
        const [incomeRows] = await db.execute(
          `SELECT income_usd 
           FROM novel_income_monthly 
           WHERE novel_id = ? 
           AND month = ? 
           AND income_type = 'champion'`,
          [novelId, monthDate]
        );

        if (incomeRows.length > 0 && incomeRows[0].income_usd) {
          championIncome = parseFloat(incomeRows[0].income_usd) || 0;
        }
      } catch (error) {
        // 如果表不存在，记录日志但不抛出错误（允许后续创建表）
        if (error.code === 'ER_NO_SUCH_TABLE') {
          console.warn('novel_income_monthly 表不存在，请先创建该表');
          championIncome = 0;
        } else {
          throw error;
        }
      }

      if (championIncome <= 0) {
        await db.commit();
        return {
          success: true,
          message: '该小说当月无 Champion 收入',
          championIncome: 0,
          distributed: false
        };
      }

      // Step 2: 从合同中获取主编比例和编辑池比例
      const [contracts] = await db.execute(
        `SELECT editor_admin_id, role, share_percent 
         FROM novel_editor_contract 
         WHERE novel_id = ? 
         AND share_type = 'percent_of_book' 
         AND status = 'active'`,
        [novelId]
      );

      let chiefPoolPercent = 0;
      let editorPoolPercent = 0;
      const chiefContracts = [];
      const editorContracts = [];

      for (const contract of contracts) {
        const sharePercent = parseFloat(contract.share_percent) || 0;
        
        if (contract.role === 'chief_editor') {
          chiefPoolPercent += sharePercent;
          chiefContracts.push({
            editorId: contract.editor_admin_id,
            sharePercent: sharePercent
          });
        } else if (contract.role === 'editor') {
          editorPoolPercent += sharePercent;
          editorContracts.push({
            editorId: contract.editor_admin_id,
            sharePercent: sharePercent
          });
        }
      }

      const chiefPoolAmount = championIncome * (chiefPoolPercent / 100.0);
      const editorPoolAmount = championIncome * (editorPoolPercent / 100.0);

      // Step 3: 统计每个责任编辑负责的总字数（通过 snapshot + chapter）
      const [wordRows] = await db.execute(
        `SELECT 
          s.editor_admin_id AS editor_admin_id,
          COALESCE(SUM(c.word_count), 0) AS total_words
         FROM editor_chapter_share_snapshot s
         JOIN chapter c ON c.id = s.chapter_id
         WHERE 
           s.novel_id = ?
           AND c.is_released = 1
         GROUP BY s.editor_admin_id`,
        [novelId]
      );

      const editorWordsMap = new Map();
      let totalWordsAllEditors = 0;

      for (const row of wordRows) {
        const editorId = parseInt(row.editor_admin_id);
        const words = parseInt(row.total_words) || 0;
        editorWordsMap.set(editorId, words);
        totalWordsAllEditors += words;
      }

      // Step 4: 按字数比例拆分 editor_pool_amount 给各责任编辑
      const editorIncomes = [];
      
      if (editorPoolAmount > 0 && totalWordsAllEditors > 0) {
        for (const [editorId, words] of editorWordsMap.entries()) {
          const ratio = words / totalWordsAllEditors;
          const income = editorPoolAmount * ratio;
          
          if (income > 0) {
            editorIncomes.push({
              editorId: editorId,
              amount: income
            });
          }
        }
      } else if (editorPoolAmount > 0 && totalWordsAllEditors === 0) {
        // 如果没有字数，但编辑池有金额，可以选择平均分配或记录警告
        console.warn(`小说 ${novelId} 在 ${month} 有编辑池收入但无字数统计`);
      }

      // Step 5: 计算主编收入
      const chiefIncomes = [];
      
      if (chiefPoolAmount > 0 && chiefContracts.length > 0) {
        // 如果有多个主编合同，按比例分配
        const totalChiefPercent = chiefContracts.reduce((sum, c) => sum + c.sharePercent, 0) || 1;
        
        for (const contract of chiefContracts) {
          const pct = contract.sharePercent;
          const amount = chiefPoolAmount * (pct / totalChiefPercent);
          
          if (amount > 0) {
            chiefIncomes.push({
              editorId: contract.editorId,
              amount: amount
            });
          }
        }
      }

      // Step 6: 写入/更新 editor_income_monthly
      const upsertEditorIncome = async (editorId, amount) => {
        // 使用 INSERT ... ON DUPLICATE KEY UPDATE 实现 upsert
        await db.execute(
          `INSERT INTO editor_income_monthly 
           (editor_admin_id, novel_id, month, gross_book_income_usd, editor_income_usd, updated_at)
           VALUES (?, ?, ?, ?, ?, NOW())
           ON DUPLICATE KEY UPDATE
           gross_book_income_usd = gross_book_income_usd + VALUES(gross_book_income_usd),
           editor_income_usd = editor_income_usd + VALUES(editor_income_usd),
           updated_at = NOW()`,
          [editorId, novelId, monthDate, championIncome, amount]
        );
      };

      // 写入编辑收入
      for (const ei of editorIncomes) {
        await upsertEditorIncome(ei.editorId, ei.amount);
      }

      // 写入主编收入
      for (const ci of chiefIncomes) {
        await upsertEditorIncome(ci.editorId, ci.amount);
      }

      await db.commit();

      return {
        success: true,
        message: 'Champion 收入分配完成',
        championIncome: championIncome,
        chiefPoolAmount: chiefPoolAmount,
        editorPoolAmount: editorPoolAmount,
        chiefIncomes: chiefIncomes,
        editorIncomes: editorIncomes,
        totalWordsAllEditors: totalWordsAllEditors,
        distributed: true
      };
    } catch (error) {
      await db.rollback();
      throw error;
    } finally {
      await db.end();
    }
  }

  /**
   * 批量计算多本小说的 Champion 收入
   * @param {number[]} novelIds - 小说ID数组
   * @param {string} month - 月份
   * @returns {Promise<Object>} 批量计算结果
   */
  async calculateChampionIncomeForNovels(novelIds, month) {
    const results = {
      success: [],
      failed: [],
      total: novelIds.length
    };

    for (const novelId of novelIds) {
      try {
        const result = await this.calculateChampionIncomeForNovel(novelId, month);
        results.success.push({
          novelId: novelId,
          ...result
        });
      } catch (error) {
        results.failed.push({
          novelId: novelId,
          error: error.message
        });
      }
    }

    return results;
  }
}

module.exports = EditorIncomeService;

