const mysql = require('mysql2/promise');

/**
 * 章节审核服务
 * 处理章节审核相关的业务逻辑
 */
class ChapterReviewService {
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
   * 检查章节是否存在
   * @param {number} chapterId - 章节ID
   * @returns {Promise<Object|null>} 章节信息或null
   */
  async getChapterById(chapterId) {
    const db = await this.createConnection();
    try {
      const [chapters] = await db.execute(
        'SELECT id, novel_id, review_status, editor_admin_id, chief_editor_admin_id FROM chapter WHERE id = ?',
        [chapterId]
      );
      return chapters.length > 0 ? chapters[0] : null;
    } finally {
      await db.end();
    }
  }

  /**
   * 获取小说信息（包括 chief_editor_admin_id）
   * @param {number} novelId - 小说ID
   * @returns {Promise<Object|null>} 小说信息或null
   */
  async getNovelById(novelId) {
    const db = await this.createConnection();
    try {
      const [novels] = await db.execute(
        'SELECT id, chief_editor_admin_id, current_editor_admin_id FROM novel WHERE id = ?',
        [novelId]
      );
      return novels.length > 0 ? novels[0] : null;
    } finally {
      await db.end();
    }
  }

  /**
   * 判断小说当前配置的主编是否有有效合同
   * 有效主编合同定义为 novel_editor_contract 中满足：
   * - novel_id = 当前小说 id
   * - editor_admin_id = novel.chief_editor_admin_id
   * - role = 'chief_editor'
   * - status = 'active'
   * - start_date <= NOW()
   * - (end_date IS NULL OR end_date >= NOW())
   * @param {Object} db - 数据库连接
   * @param {number} novelId - 小说ID
   * @param {number|null} chiefEditorAdminId - 主编 admin ID
   * @returns {Promise<boolean>} 是否存在有效主编合同
   */
  async hasActiveChiefContract(db, novelId, chiefEditorAdminId) {
    if (!chiefEditorAdminId) {
      return false;
    }

    const [contracts] = await db.execute(
      `SELECT 1 FROM novel_editor_contract nec
       WHERE nec.novel_id = ?
         AND nec.editor_admin_id = ?
         AND nec.role = 'chief_editor'
         AND nec.status = 'active'
         AND nec.start_date <= NOW()
         AND (nec.end_date IS NULL OR nec.end_date >= NOW())
       LIMIT 1`,
      [novelId, chiefEditorAdminId]
    );

    return contracts.length > 0;
  }

  /**
   * 获取小说的当前编辑ID
   * @param {number} novelId - 小说ID
   * @returns {Promise<number|null>} 编辑ID或null
   */
  async getNovelEditorId(novelId) {
    const db = await this.createConnection();
    try {
      const [novels] = await db.execute(
        'SELECT current_editor_admin_id FROM novel WHERE id = ?',
        [novelId]
      );
      return novels.length > 0 ? novels[0].current_editor_admin_id : null;
    } finally {
      await db.end();
    }
  }

  /**
   * 检查是否有review_note字段
   * @returns {Promise<boolean>} 是否存在review_note字段
   */
  async hasReviewNoteField() {
    const db = await this.createConnection();
    try {
      const [columns] = await db.execute(
        `SELECT COLUMN_NAME 
         FROM INFORMATION_SCHEMA.COLUMNS 
         WHERE TABLE_SCHEMA = DATABASE() 
         AND TABLE_NAME = 'chapter' 
         AND COLUMN_NAME = 'review_note'`
      );
      return columns.length > 0;
    } finally {
      await db.end();
    }
  }

  /**
   * 获取章节的当前备注
   * @param {number} chapterId - 章节ID
   * @returns {Promise<string>} 当前备注内容
   */
  async getChapterNote(chapterId) {
    const db = await this.createConnection();
    try {
      const [chapters] = await db.execute(
        'SELECT translator_note FROM chapter WHERE id = ?',
        [chapterId]
      );
      return chapters.length > 0 ? (chapters[0].translator_note || '') : '';
    } finally {
      await db.end();
    }
  }


  /**
   * 写入审核日志（upsert 方式）
   * 现在 chapter_review_log 以 (chapter_id, admin_id) 唯一，记录该编辑对该章节的最终审核结果，用于统计工作量和提成。
   * @param {Object} db - 数据库连接
   * @param {number} chapterId - 章节ID
   * @param {number} adminId - 审核人ID
   * @param {string} adminRole - 审核人角色
   * @param {string} action - 审核动作
   * @param {string|null} comment - 审核备注
   */
  async insertReviewLog(db, chapterId, adminId, adminRole, action, comment) {
    await db.execute(
      `INSERT INTO chapter_review_log (chapter_id, admin_id, admin_role, action, comment, created_at)
       VALUES (?, ?, ?, ?, ?, NOW())
       ON DUPLICATE KEY UPDATE
         action = VALUES(action),
         comment = VALUES(comment),
         admin_role = VALUES(admin_role),
         created_at = NOW()`,
      [chapterId, adminId, adminRole, action, comment || null]
    );
  }

  /**
   * 审核章节（统一接口，支持主编终审流程）
   * @param {Object} currentAdmin - 当前管理员信息 { id, role }
   * @param {Object} params - 审核参数
   * @param {number} params.chapter_id - 章节ID
   * @param {string} params.result - 审核结果 (approved/rejected/reviewing)
   * @param {string|null} params.comment - 审核备注
   * @returns {Promise<Object>} 审核结果
   */
  async reviewChapter(currentAdmin, params) {
    const { chapter_id, result, comment } = params;
    const { id: adminId, role: adminRole } = currentAdmin;

    if (!['editor', 'chief_editor', 'super_admin'].includes(adminRole)) {
      throw new Error('无权限审核章节');
    }

    if (!['approved', 'rejected', 'reviewing'].includes(result)) {
      throw new Error('审核结果无效');
    }

    const db = await this.createConnection();
    try {
      await db.beginTransaction();

      // 获取章节信息
      const chapter = await this.getChapterById(chapter_id);
      if (!chapter) {
        throw new Error('章节不存在');
      }

      // 获取小说信息
      const novel = await this.getNovelById(chapter.novel_id);
      if (!novel) {
        throw new Error('小说不存在');
      }

      // requiresChief 现在以是否配置了主编且该主编有有效合同为准
      // 如果 chief_editor_admin_id 指向一个已失效合同的主编，则视为不需要主编终审
      const chiefEditorId = novel.chief_editor_admin_id;
      const hasChiefEditorField = !!chiefEditorId;
      let requiresChief = false;

      if (hasChiefEditorField) {
        requiresChief = await this.hasActiveChiefContract(db, novel.id, chiefEditorId);
        
        // 如果字段有值但合同已失效，记录警告日志
        if (!requiresChief) {
          console.warn(`小说 ${novel.id} 配置了主编 (chief_editor_admin_id=${chiefEditorId})，但该主编没有有效合同，视为不需要主编终审`);
        }
      }

      const previousStatus = chapter.review_status;
      let finalStatus = result;

      // 获取小说的当前编辑ID
      const editorAdminId = novel.current_editor_admin_id || chapter.editor_admin_id;

      // 处理审核逻辑
      // 防止接手的新编辑重审老章节，导致前任编辑的提成被覆盖
      if (result === 'approved') {
        if (!requiresChief) {
          // ✅ 没有主编：editor / super_admin 审核通过后直接变为 approved
          finalStatus = 'approved';
          
          // 防止抢功：如果章节已有编辑归属，且不是当前审核人，则拒绝
          if (chapter.editor_admin_id && chapter.editor_admin_id !== adminId) {
            if (adminRole === 'editor') {
              throw new Error('该章节已由其他编辑审核通过，不能修改责任编辑归属');
            } else if (adminRole === 'super_admin') {
              throw new Error('该章节已由其他编辑审核通过，不能修改责任编辑归属');
            }
          }
          
          // 如果还没有绑定责任编辑，则绑定当前审核人
          let finalEditorId = chapter.editor_admin_id;
          if (!finalEditorId) {
            if (adminRole === 'editor' || adminRole === 'super_admin') {
              finalEditorId = adminId;
            } else {
              finalEditorId = editorAdminId;
            }
          }

          await db.execute(
            `UPDATE chapter SET 
             review_status = ?,
             reviewed_at = NOW(),
             editor_admin_id = ?
             WHERE id = ?`,
            [finalStatus, finalEditorId, chapter_id]
          );

        } else {
          // ✅ 有主编：需要主编终审流程
          if (adminRole === 'editor') {
            // 责任编辑审核通过 -> 等待主编终审
            finalStatus = 'pending_chief';
            
            // 防止抢功：如果章节已有编辑归属，且不是当前审核人，则拒绝
            if (chapter.editor_admin_id && chapter.editor_admin_id !== adminId) {
              throw new Error('该章节已由其他编辑审核通过，不能修改责任编辑归属');
            }
            
            // 如果还没有绑定责任编辑，则绑定当前审核人
            let finalEditorId = chapter.editor_admin_id;
            if (!finalEditorId) {
              finalEditorId = adminId;
            }

            await db.execute(
              `UPDATE chapter SET 
               review_status = ?,
               editor_admin_id = ?
               WHERE id = ?`,
              [finalStatus, finalEditorId, chapter_id]
            );

          } else if (adminRole === 'chief_editor' || adminRole === 'super_admin') {
            // 主编/有主编合同的 super_admin 终审通过 -> 最终 approved
            finalStatus = 'approved';
            
            // 防止抢功：如果章节已有主编归属，且不是当前审核人，则拒绝
            if (chapter.chief_editor_admin_id && chapter.chief_editor_admin_id !== adminId) {
              throw new Error('该章节已由其他主编审核通过，不能修改主编归属');
            }
            
            // 保持已有的 editor_admin_id，如果没有则使用小说的当前编辑
            let finalEditorId = chapter.editor_admin_id || editorAdminId;
            
            // 如果还没有主编归属，则绑定当前审核人
            let finalChiefEditorId = chapter.chief_editor_admin_id;
            if (!finalChiefEditorId) {
              if (adminRole === 'chief_editor') {
                finalChiefEditorId = adminId;
              } else if (adminRole === 'super_admin') {
                // super_admin 终审时，如果没有主编归属，设置为小说的主编（如果有）
                finalChiefEditorId = novel.chief_editor_admin_id || null;
              }
            }

            await db.execute(
              `UPDATE chapter SET 
               review_status = ?,
               reviewed_at = NOW(),
               editor_admin_id = COALESCE(?, editor_admin_id),
               chief_editor_admin_id = COALESCE(?, chief_editor_admin_id)
               WHERE id = ?`,
              [finalStatus, finalEditorId, finalChiefEditorId, chapter_id]
            );

          } else {
            throw new Error('无权限执行最终审核');
          }
        }

      } else if (result === 'rejected') {
        // 拒绝：无论是否需要主编，仅更新状态，不写入归属信息
        finalStatus = 'rejected';
        
        await db.execute(
          `UPDATE chapter SET 
           review_status = ?,
           reviewed_at = NOW()
           WHERE id = ?`,
          [finalStatus, chapter_id]
        );

      } else if (result === 'reviewing') {
        // 标记为审核中（初审）
        finalStatus = 'reviewing';
        
        await db.execute(
          `UPDATE chapter SET review_status = ? WHERE id = ?`,
          [finalStatus, chapter_id]
        );
      }

      // 写入审核日志
      await this.insertReviewLog(db, chapter_id, adminId, adminRole, result, comment);

      await db.commit();

      return {
        success: true,
        chapterId: parseInt(chapter_id),
        reviewStatus: finalStatus,
        reviewAdminId: adminId
      };
    } catch (error) {
      await db.rollback();
      throw error;
    } finally {
      await db.end();
    }
  }

  /**
   * 批量审核章节
   * @param {Object} params - 批量审核参数
   * @param {number[]} params.chapterIds - 章节ID数组
   * @param {string} params.result - 审核结果 (approved/rejected)
   * @param {string|null} params.comment - 审核备注
   * @returns {Promise<Object>} 批量审核结果
   */
  async batchReviewChapters(params) {
    const { chapterIds, result, comment } = params;

    const db = await this.createConnection();
    try {
      await db.beginTransaction();

      // 获取所有章节的详细信息（包括当前状态和小说ID）
      const placeholders = chapterIds.map(() => '?').join(',');
      const [chapters] = await db.execute(
        `SELECT id, novel_id, review_status FROM chapter WHERE id IN (${placeholders})`,
        chapterIds
      );

      // 获取每个章节的编辑ID
      const chapterEditorMap = {};
      const chapterStatusMap = {};
      for (const chapter of chapters) {
        const editorId = await this.getNovelEditorId(chapter.novel_id);
        chapterEditorMap[chapter.id] = editorId;
        chapterStatusMap[chapter.id] = chapter.review_status;
      }

      // 构建更新字段
      const updateFields = [
        'review_status = ?',
        'reviewed_at = NOW()',
        'editor_admin_id = ?'
      ];
      const updateValues = [result]; // 移除 reviewAdminId，不再使用 review_admin_id 字段

      // 处理审核备注
      if (comment) {
        const hasReviewNoteField = await this.hasReviewNoteField();
        if (hasReviewNoteField) {
          updateFields.push('review_note = ?');
          updateValues.push(comment);
        }
      }

      // 为每个章节执行更新（因为editor_admin_id可能不同）
      let successCount = 0;
      for (const chapterId of chapterIds) {
        const editorId = chapterEditorMap[chapterId] || null;
        const chapter = chapters.find(c => c.id === chapterId);
        
        // updateValues = [result, ...(comment if exists)]
        // 需要添加 editorId 和 chapterId
        const values = [...updateValues, editorId, chapterId];
        
        await db.execute(
          `UPDATE chapter SET ${updateFields.join(', ')} WHERE id = ?`,
          values
        );
        
        successCount++;
      }

      await db.commit();

      return {
        success: true,
        count: successCount,
        reviewStatus: result
      };
    } catch (error) {
      await db.rollback();
      throw error;
    } finally {
      await db.end();
    }
  }
}

module.exports = ChapterReviewService;

