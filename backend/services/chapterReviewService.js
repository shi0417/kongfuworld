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
        'SELECT id, novel_id, review_status, editor_admin_id FROM chapter WHERE id = ?',
        [chapterId]
      );
      return chapters.length > 0 ? chapters[0] : null;
    } finally {
      await db.end();
    }
  }

  /**
   * 获取小说信息（包括 requires_chief_edit）
   * @param {number} novelId - 小说ID
   * @returns {Promise<Object|null>} 小说信息或null
   */
  async getNovelById(novelId) {
    const db = await this.createConnection();
    try {
      const [novels] = await db.execute(
        'SELECT id, requires_chief_edit, current_editor_admin_id FROM novel WHERE id = ?',
        [novelId]
      );
      return novels.length > 0 ? novels[0] : null;
    } finally {
      await db.end();
    }
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
   * 创建章节归属快照（如果不存在）
   * @param {Object} db - 数据库连接
   * @param {number} novelId - 小说ID
   * @param {number} chapterId - 章节ID
   * @param {number} editorAdminId - 编辑ID
   * @returns {Promise<boolean>} 是否创建了快照
   */
  async createChapterSnapshot(db, novelId, chapterId, editorAdminId) {
    if (!editorAdminId) {
      return false; // 如果没有编辑ID，不创建快照
    }

    try {
      // 检查是否已存在快照
      const [existing] = await db.execute(
        'SELECT id FROM editor_chapter_share_snapshot WHERE chapter_id = ?',
        [chapterId]
      );

      if (existing.length > 0) {
        return false; // 已存在，不重复创建
      }

      // 创建快照
      await db.execute(
        'INSERT INTO editor_chapter_share_snapshot (novel_id, chapter_id, editor_admin_id) VALUES (?, ?, ?)',
        [novelId, chapterId, editorAdminId]
      );

      return true; // 创建成功
    } catch (error) {
      // 如果是唯一键冲突（理论上不应该发生，因为已经检查过），忽略
      if (error.code === 'ER_DUP_ENTRY') {
        return false;
      }
      throw error;
    }
  }

  /**
   * 写入审核日志
   * @param {Object} db - 数据库连接
   * @param {number} chapterId - 章节ID
   * @param {number} adminId - 审核人ID
   * @param {string} adminRole - 审核人角色
   * @param {string} action - 审核动作
   * @param {string|null} comment - 审核备注
   */
  async insertReviewLog(db, chapterId, adminId, adminRole, action, comment) {
    await db.execute(
      `INSERT INTO chapter_review_log (chapter_id, admin_id, admin_role, action, comment)
       VALUES (?, ?, ?, ?, ?)`,
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

      const requiresChief = novel.requires_chief_edit === 1;
      const previousStatus = chapter.review_status;
      let finalStatus = result;
      let snapshotCreated = false;

      // 获取小说的当前编辑ID（用于快照）
      const editorAdminId = novel.current_editor_admin_id || chapter.editor_admin_id;

      // 处理审核逻辑
      if (result === 'approved') {
        if (!requiresChief) {
          // ✅ 不需要主编终审：责任编辑/超管直接终结
          finalStatus = 'approved';
          
          // 如果还没有绑定责任编辑，且当前审核人是编辑或超管，则绑定
          let finalEditorId = chapter.editor_admin_id || editorAdminId;
          if (!finalEditorId && (adminRole === 'editor' || adminRole === 'super_admin')) {
            finalEditorId = adminId;
          }

          await db.execute(
            `UPDATE chapter SET 
             review_status = ?,
             review_admin_id = ?,
             reviewed_at = NOW(),
             editor_admin_id = ?
             WHERE id = ?`,
            [finalStatus, adminId, finalEditorId, chapter_id]
          );

          // 章节首次从非 approved 进入 approved 时，创建快照
          if (previousStatus !== 'approved' && finalEditorId) {
            snapshotCreated = await this.createChapterSnapshot(db, chapter.novel_id, chapter_id, finalEditorId);
          }

        } else {
          // ✅ 需要主编终审
          if (adminRole === 'editor') {
            // 责任编辑审核通过 -> 等待主编终审
            finalStatus = 'pending_chief';
            
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
            // 主编/超管终审通过 -> 最终 approved
            finalStatus = 'approved';
            
            let finalEditorId = chapter.editor_admin_id || editorAdminId;
            if (!finalEditorId && adminRole === 'super_admin') {
              // 超管终审时，如果没有编辑，可以设置为当前编辑
              finalEditorId = null; // 保持原值或null
            }

            await db.execute(
              `UPDATE chapter SET 
               review_status = ?,
               review_admin_id = ?,
               reviewed_at = NOW(),
               editor_admin_id = COALESCE(?, editor_admin_id)
               WHERE id = ?`,
              [finalStatus, adminId, finalEditorId, chapter_id]
            );

            // 章节首次从非 approved 进入 approved 时，创建快照
            if (previousStatus !== 'approved' && finalEditorId) {
              snapshotCreated = await this.createChapterSnapshot(db, chapter.novel_id, chapter_id, finalEditorId);
            }

          } else {
            throw new Error('无权限执行最终审核');
          }
        }

      } else if (result === 'rejected') {
        // 拒绝：无论是否需要主编
        finalStatus = 'rejected';
        
        await db.execute(
          `UPDATE chapter SET 
           review_status = ?,
           review_admin_id = ?,
           reviewed_at = NOW()
           WHERE id = ?`,
          [finalStatus, adminId, chapter_id]
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
        reviewAdminId: adminId,
        snapshotCreated: snapshotCreated
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
   * @param {number} params.reviewAdminId - 审核人ID
   * @param {string|null} params.comment - 审核备注
   * @returns {Promise<Object>} 批量审核结果
   */
  async batchReviewChapters(params) {
    const { chapterIds, result, reviewAdminId, comment } = params;

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
        'review_admin_id = ?',
        'reviewed_at = NOW()',
        'editor_admin_id = ?'
      ];
      const updateValues = [result, reviewAdminId];

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
      let snapshotCount = 0;
      for (const chapterId of chapterIds) {
        const editorId = chapterEditorMap[chapterId] || null;
        const previousStatus = chapterStatusMap[chapterId];
        const chapter = chapters.find(c => c.id === chapterId);
        
        // updateValues = [result, reviewAdminId, ...(comment if exists)]
        // 需要添加 editorId 和 chapterId
        const values = [...updateValues, editorId, chapterId];
        
        await db.execute(
          `UPDATE chapter SET ${updateFields.join(', ')} WHERE id = ?`,
          values
        );
        
        // 如果审核通过且是首次变为 approved，创建快照
        if (result === 'approved' && previousStatus !== 'approved' && editorId && chapter) {
          const created = await this.createChapterSnapshot(db, chapter.novel_id, chapterId, editorId);
          if (created) {
            snapshotCount++;
          }
        }
        
        successCount++;
      }

      await db.commit();

      return {
        success: true,
        count: successCount,
        snapshotCount: snapshotCount,
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

