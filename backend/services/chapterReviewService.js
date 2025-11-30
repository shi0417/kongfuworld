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
   * 判断当前管理员是否可以覆盖/审批章节的 editor_admin_id
   * 
   * 规则（仅针对编辑阶段，review_status !== 'pending_chief'）：
   * 1. 如果章节没有 editor_admin_id（为空），直接允许（任意编辑/主编/超管都可以绑定）
   * 2. 如果当前审核人就是原来的那个人，允许（自己重复审批或修正）
   * 3. 如果当前审核人是超级管理员，允许覆盖（超管可以覆盖任意人的）
   * 4. 如果当前审核人是编辑或主编：
   *    - 如果之前是超管审批的，允许编辑/主编重新审批并覆盖（可以从超管手里接盘）
   *    - 如果之前是其他编辑/主编审批的，不允许覆盖（不允许抢功）
   * 
   * 规则对应表：
   * - 空 → 任意编辑/主编/超管：✅ 允许
   * - 某编辑 E1 → 同一个编辑 E1：✅ 允许
   * - 某编辑 E1 → 其它编辑 E2：❌ 不允许（抢功防护）
   * - 某编辑 E1 → 任意主编 C：❌ 不允许（主编不能抢编辑的功劳）
   * - 某编辑 E1 → 任意超管 S：✅ 允许（超管可以覆盖）
   * - 超管 S → 任意编辑 E：✅ 允许（编辑可以从超管手里接盘）
   * - 超管 S → 任意主编 C：✅ 允许（主编也可以从超管接盘）
   * - 超管 S1 → 另一位超管 S2：✅ 允许（超管之间随便改）
   * 
   * @param {Object} db - 数据库连接
   * @param {Object} chapter - 章节信息（至少要有 editor_admin_id）
   * @param {number} adminId - 当前审核人ID
   * @param {string} adminRole - 当前审核人角色
   * @returns {Promise<Object>} { allowed: boolean, reason?: string }
   */
  async canCurrentAdminOverrideEditor(db, chapter, adminId, adminRole) {
    // 如果章节没有 editor_admin_id，直接允许
    if (!chapter.editor_admin_id) {
      return { allowed: true };
    }

    // 如果当前审核人就是原来的那个人，允许
    if (chapter.editor_admin_id === adminId) {
      return { allowed: true };
    }

    // 如果当前审核人是超级管理员，允许覆盖
    if (adminRole === 'super_admin') {
      return { allowed: true };
    }

    // 查询已有归属人的角色
    const [admins] = await db.execute(
      'SELECT role FROM admin WHERE id = ?',
      [chapter.editor_admin_id]
    );

    const existingRole = admins.length > 0 ? (admins[0].role || 'editor') : 'editor';

    // 如果当前审核人是普通编辑（或类编辑角色）
    if (adminRole === 'editor' || adminRole === 'chief_editor') {
      // 如果之前是超管审批的，允许当前编辑重新审批并覆盖
      if (existingRole === 'super_admin') {
        return { allowed: true };
      }
      
      // 否则（之前是其他编辑/主编审批的），不允许覆盖
      return {
        allowed: false,
        reason: '该章节已由其他编辑/主编审核通过，不能再次修改责任编辑'
      };
    }

    // 其他情况（理论上不应该到这里）
    return {
      allowed: false,
      reason: '当前账号无权修改该章节的责任编辑归属'
    };
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
      // 使用新的覆盖规则判断是否可以修改 editor_admin_id
      if (result === 'approved') {
        if (!requiresChief) {
          // ✅ 没有主编：editor / chief_editor / super_admin 审核通过后直接变为 approved
          finalStatus = 'approved';
          
          // 检查是否可以覆盖 editor_admin_id
          const { allowed, reason } = await this.canCurrentAdminOverrideEditor(db, chapter, adminId, adminRole);
          if (!allowed) {
            throw new Error(reason || '当前账号无权修改该章节的责任编辑归属');
          }
          
          // 确定最终的 editor_admin_id
          let finalEditorId;
          if (adminRole === 'super_admin') {
            // 超级管理员：总是更新为当前审核人ID
            finalEditorId = adminId;
          } else if (adminRole === 'editor' || adminRole === 'chief_editor') {
            // 普通编辑或主编：更新为当前审核人ID（主编也可以绑定自己，视为也做了编辑工作）
            finalEditorId = adminId;
          } else {
            // 其他角色：使用小说的当前编辑ID
            finalEditorId = editorAdminId;
          }
          
          // 无主编流程时，如果主编审核，可以顺带设置 chief_editor_admin_id
          let finalChiefEditorId = null;
          if (adminRole === 'chief_editor') {
            finalChiefEditorId = adminId;
          }

          await db.execute(
            `UPDATE chapter SET 
             review_status = ?,
             reviewed_at = NOW(),
             editor_admin_id = ?,
             chief_editor_admin_id = COALESCE(?, chief_editor_admin_id)
             WHERE id = ?`,
            [finalStatus, finalEditorId, finalChiefEditorId, chapter_id]
          );

        } else {
          // ✅ 有主编：需要主编终审流程
          if (adminRole === 'editor') {
            // 责任编辑审核通过 -> 等待主编终审
            finalStatus = 'pending_chief';
            
            // 检查是否可以覆盖 editor_admin_id
            const { allowed, reason } = await this.canCurrentAdminOverrideEditor(db, chapter, adminId, adminRole);
            if (!allowed) {
              throw new Error(reason || '当前账号无权修改该章节的责任编辑归属');
            }
            
            // 普通编辑：更新为当前审核人ID
            const finalEditorId = adminId;

            await db.execute(
              `UPDATE chapter SET 
               review_status = ?,
               editor_admin_id = ?
               WHERE id = ?`,
              [finalStatus, finalEditorId, chapter_id]
            );

          } else if (adminRole === 'chief_editor' || adminRole === 'super_admin') {
            // 主编/有主编合同的 super_admin 审核
            // 需要区分：是在编辑阶段审核，还是在终审阶段（pending_chief）审核
            
            if (chapter.review_status === 'pending_chief') {
              // 终审阶段：主编终审通过 -> 最终 approved
              finalStatus = 'approved';
              
              // 防止抢功：如果章节已有主编归属，且不是当前审核人，则拒绝
              if (chapter.chief_editor_admin_id && chapter.chief_editor_admin_id !== adminId) {
                throw new Error('该章节已由其他主编审核通过，不能修改主编归属');
              }
              
              // 主编终审阶段：editor_admin_id 保持不变（如果已有值）
              // 如果为空，可以填小说级别 current_editor_admin_id，但不要用主编的 id 去覆盖
              let finalEditorId = chapter.editor_admin_id;
              if (!finalEditorId) {
                // 如果章节没有 editor_admin_id，使用小说的 current_editor_admin_id
                finalEditorId = editorAdminId;
              }
              // 注意：主编终审阶段不检查 editor_admin_id 覆盖规则，因为这是主编终审，不是编辑阶段
              
              // chief_editor_admin_id 设置规则：
              // 如果当前为 NULL：
              //   - adminRole = 'chief_editor' => 设置为当前 adminId
              //   - adminRole = 'super_admin' => 尝试设置为 novel.chief_editor_admin_id，如果也为空就保持 NULL
              // 如果已有值，则保持不变（不强制覆盖）
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
              // 编辑阶段：主编/超管在编辑阶段审核
              if (adminRole === 'chief_editor') {
                // 主编再次审核（已批准后重新审核）：当作"主编终审或反复终审"
                // 不再调用 canCurrentAdminOverrideEditor，避免因为 editor_admin_id 属于编辑而被拒绝
                finalStatus = 'approved';
                
                // editor_admin_id 保持不变（如果已有值），如果为空则用小说级 current_editor_admin_id 补上
                let finalEditorId = chapter.editor_admin_id;
                if (!finalEditorId) {
                  finalEditorId = editorAdminId;
                }
                // 注意：不要把 editor_admin_id 改成主编自己的 id
                
                // chief_editor_admin_id：如果为空则设为当前主编，否则保持原值
                let finalChiefEditorId = chapter.chief_editor_admin_id;
                if (!finalChiefEditorId) {
                  finalChiefEditorId = adminId;
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
              } else if (adminRole === 'super_admin') {
                // 超管在编辑阶段审核：可以直接设为 approved，并可覆盖 editor_admin_id
                finalStatus = 'approved';
                
                // 检查是否可以覆盖 editor_admin_id（编辑阶段的规则）
                const { allowed, reason } = await this.canCurrentAdminOverrideEditor(db, chapter, adminId, adminRole);
                if (!allowed) {
                  throw new Error(reason || '当前账号无权修改该章节的责任编辑归属');
                }
                
                // 超级管理员：总是更新为当前审核人ID
                const finalEditorId = adminId;
                
                // chief_editor_admin_id 设置规则：super_admin 审核时，如果没有主编归属，设置为小说的主编（如果有）
                let finalChiefEditorId = chapter.chief_editor_admin_id;
                if (!finalChiefEditorId) {
                  finalChiefEditorId = novel.chief_editor_admin_id || null;
                }

                await db.execute(
                  `UPDATE chapter SET 
                   review_status = ?,
                   reviewed_at = NOW(),
                   editor_admin_id = ?,
                   chief_editor_admin_id = COALESCE(?, chief_editor_admin_id)
                   WHERE id = ?`,
                  [finalStatus, finalEditorId, finalChiefEditorId, chapter_id]
                );
              } else {
                // 其他角色（理论上不应该到这里）
                throw new Error('无权限执行最终审核');
              }
            }

          } else {
            throw new Error('无权限执行最终审核');
          }
        }

      } else if (result === 'rejected') {
        // 拒绝：仅更新状态，不写入归属信息
        // 主编终审阶段（pending_chief）只允许主编和超管操作，不检查 editor_admin_id 覆盖规则
        // 编辑阶段需要检查 editor_admin_id 覆盖规则
        if (chapter.review_status === 'pending_chief') {
          // 主编终审阶段：允许主编、超管、本章责任编辑本人
          const isChief = adminRole === 'chief_editor';
          const isSuper = adminRole === 'super_admin';
          const isChapterEditor = adminRole === 'editor' && chapter.editor_admin_id === adminId;
          
          if (!isChief && !isSuper && !isChapterEditor) {
            throw new Error('主编终审阶段只能由主编、超级管理员或本章责任编辑操作');
          }
          // 注意：pending_chief 阶段不再调用 canCurrentAdminOverrideEditor，
          // 因为我们不希望这里改变 editor_admin_id，只是允许修改状态。
        } else {
          // 编辑阶段：只对 editor 检查 editor_admin_id 覆盖规则
          // chief_editor 直接允许（因为主编不会改 editor_admin_id，只是改状态）
          if (adminRole === 'editor') {
            const { allowed, reason } = await this.canCurrentAdminOverrideEditor(db, chapter, adminId, adminRole);
            if (!allowed) {
              throw new Error(reason || '当前账号无权操作该章节');
            }
          } else if (adminRole === 'chief_editor' || adminRole === 'super_admin') {
            // 主编和超管直接允许
          } else {
            throw new Error('无权限操作该章节');
          }
        }
        
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
        if (chapter.review_status === 'pending_chief') {
          // 主编终审阶段：允许主编、超管、本章责任编辑本人执行"保存为审核中"操作
          const isChief = adminRole === 'chief_editor';
          const isSuper = adminRole === 'super_admin';
          const isChapterEditor = adminRole === 'editor' && chapter.editor_admin_id === adminId;
          
          if (!isChief && !isSuper && !isChapterEditor) {
            throw new Error('主编终审阶段只能由主编、超级管理员或本章责任编辑执行"保存为审核中"操作');
          }
          // 注意：pending_chief 阶段不再调用 canCurrentAdminOverrideEditor，
          // 因为我们不希望这里改变 editor_admin_id，只是允许修改状态。
        } else {
          // 编辑阶段：只对 editor 检查 editor_admin_id 覆盖规则
          // chief_editor 直接允许（因为主编不会改 editor_admin_id，只是改状态）
          if (adminRole === 'editor') {
            const { allowed, reason } = await this.canCurrentAdminOverrideEditor(db, chapter, adminId, adminRole);
            if (!allowed) {
              throw new Error(reason || '当前账号无权操作该章节');
            }
          } else if (adminRole === 'chief_editor' || adminRole === 'super_admin') {
            // 主编和超管直接允许
          } else {
            throw new Error('无权限操作该章节');
          }
        }
        
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

