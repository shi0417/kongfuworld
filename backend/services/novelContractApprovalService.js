/**
 * 小说合同审批服务层
 * 处理 novel 表的编辑分配和申请管理
 */

const mysql = require('mysql2/promise');

class NovelContractApprovalService {
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
   * 获取小说列表（用于合同审批）
   */
  async getNovelListForApproval(params) {
    const {
      page = 1,
      pageSize = 20,
      reviewStatus,
      hasChiefEditor,
      hasEditor,
      hasApplication,
      novelKeyword,
      authorKeyword,
      sortField = 'created_at',
      sortOrder = 'DESC'
    } = params;
    
    const db = await this.createConnection();
    
    try {
      const whereConditions = [];
      const queryParams = [];
      
      // 审核状态筛选
      if (reviewStatus) {
        whereConditions.push('n.review_status = ?');
        queryParams.push(reviewStatus);
      }
      
      // 是否有主编
      if (hasChiefEditor === '1') {
        whereConditions.push('n.chief_editor_admin_id IS NOT NULL');
      } else if (hasChiefEditor === '0') {
        whereConditions.push('n.chief_editor_admin_id IS NULL');
      }
      
      // 是否有责任编辑
      if (hasEditor === '1') {
        whereConditions.push('n.current_editor_admin_id IS NOT NULL');
      } else if (hasEditor === '0') {
        whereConditions.push('n.current_editor_admin_id IS NULL');
      }
      
      // 是否有编辑申请
      if (hasApplication === '1') {
        whereConditions.push(`EXISTS (
          SELECT 1 FROM editor_novel_application 
          WHERE novel_id = n.id AND status = 'pending'
        )`);
      } else if (hasApplication === '0') {
        whereConditions.push(`NOT EXISTS (
          SELECT 1 FROM editor_novel_application 
          WHERE novel_id = n.id AND status = 'pending'
        )`);
      }
      
      // 小说搜索
      if (novelKeyword) {
        whereConditions.push('(n.title LIKE ? OR n.id = ?)');
        const keywordPattern = `%${novelKeyword}%`;
        queryParams.push(keywordPattern, novelKeyword);
      }
      
      // 作者搜索
      if (authorKeyword) {
        whereConditions.push('(n.author LIKE ? OR u.username LIKE ? OR u.pen_name LIKE ?)');
        const keywordPattern = `%${authorKeyword}%`;
        queryParams.push(keywordPattern, keywordPattern, keywordPattern);
      }
      
      const whereClause = whereConditions.length > 0 
        ? `WHERE ${whereConditions.join(' AND ')}`
        : '';
      
      // 验证排序字段
      const allowedSortFields = ['created_at', 'review_status', 'title'];
      const safeSortField = allowedSortFields.includes(sortField) ? sortField : 'created_at';
      const safeSortOrder = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
      
      // 获取总数
      const countQuery = `
        SELECT COUNT(*) as total 
        FROM novel n
        LEFT JOIN user u ON n.user_id = u.id
        ${whereClause}
      `;
      const [countResult] = await db.execute(countQuery, queryParams);
      const total = countResult[0].total;
      
      // 获取列表数据
      const pageNum = parseInt(page) || 1;
      const pageSizeNum = parseInt(pageSize) || 20;
      const offset = (pageNum - 1) * pageSizeNum;
      const limitValue = pageSizeNum;
      
      const listQuery = `
        SELECT 
          n.id,
          n.title,
          n.review_status,
          n.chief_editor_admin_id,
          ce.name as chief_editor_name,
          n.current_editor_admin_id,
          e.name as editor_name,
          n.requires_chief_edit,
          n.author,
          n.created_at,
          (SELECT COUNT(*) FROM novel_editor_contract WHERE novel_id = n.id AND status = 'active') as active_contract_count,
          (SELECT COUNT(*) FROM editor_novel_application WHERE novel_id = n.id AND status = 'pending') as pending_application_count
        FROM novel n
        LEFT JOIN user u ON n.user_id = u.id
        LEFT JOIN admin ce ON n.chief_editor_admin_id = ce.id
        LEFT JOIN admin e ON n.current_editor_admin_id = e.id
        ${whereClause}
        ORDER BY n.${safeSortField} ${safeSortOrder}
        LIMIT ${limitValue} OFFSET ${offset}
      `;
      
      const [rows] = await db.execute(listQuery, queryParams);
      
      return {
        list: rows,
        total,
        page: pageNum,
        pageSize: pageSizeNum
      };
    } finally {
      await db.end();
    }
  }

  /**
   * 获取某本小说的编辑分配信息（用于弹窗）
   */
  async getEditorAssignment(novelId) {
    const db = await this.createConnection();
    
    try {
      // 获取小说基本信息
      const [novels] = await db.execute(
        'SELECT id, title, chief_editor_admin_id, current_editor_admin_id FROM novel WHERE id = ?',
        [novelId]
      );
      
      if (novels.length === 0) {
        throw new Error('小说不存在');
      }
      
      const novel = novels[0];
      
      // 获取可选的主编列表（super_admin 和 chief_editor，且 status=1）
      const [chiefEditors] = await db.execute(
        `SELECT id, name FROM admin 
         WHERE role IN ('super_admin', 'chief_editor') AND status = 1 
         ORDER BY name ASC`
      );
      
      // 获取可选的编辑列表（editor, chief_editor, super_admin，且 status=1）
      const [editors] = await db.execute(
        `SELECT id, name FROM admin 
         WHERE role IN ('editor', 'chief_editor', 'super_admin') AND status = 1 
         ORDER BY name ASC`
      );
      
      // 获取当前有效的合同列表
      const [contracts] = await db.execute(
        `SELECT 
          c.id,
          c.role,
          c.editor_admin_id,
          a.name as editor_name,
          c.share_type,
          c.share_percent,
          c.start_date,
          c.end_date,
          c.status
         FROM novel_editor_contract c
         LEFT JOIN admin a ON c.editor_admin_id = a.id
         WHERE c.novel_id = ?
         ORDER BY c.role, c.status DESC, c.start_date DESC`,
        [novelId]
      );
      
      return {
        novel: {
          id: novel.id,
          title: novel.title,
          chief_editor_admin_id: novel.chief_editor_admin_id,
          current_editor_admin_id: novel.current_editor_admin_id
        },
        chiefEditorOptions: chiefEditors.map(e => ({
          id: e.id,
          name: e.name
        })),
        editorOptions: editors.map(e => ({
          id: e.id,
          name: e.name
        })),
        activeContracts: contracts.map(c => ({
          id: c.id,
          role: c.role,
          editor_admin_id: c.editor_admin_id,
          editor_name: c.editor_name,
          share_type: c.share_type,
          share_percent: c.share_percent ? parseFloat(c.share_percent) : null,
          start_date: c.start_date,
          end_date: c.end_date,
          status: c.status
        }))
      };
    } finally {
      await db.end();
    }
  }

  /**
   * 保存编辑分配（完善版，包含合同维护）
   */
  async saveEditorAssignment(novelId, { chief_editor_admin_id, current_editor_admin_id }) {
    const db = await this.createConnection();
    
    try {
      await db.beginTransaction();
      
      // 1. 更新 novel 表
      await db.execute(
        'UPDATE novel SET chief_editor_admin_id = ?, current_editor_admin_id = ? WHERE id = ?',
        [chief_editor_admin_id || null, current_editor_admin_id || null, novelId]
      );
      
      // 2. 处理主编合同
      if (chief_editor_admin_id) {
        // 查找是否存在 active 的主编合同
        const [existingChief] = await db.execute(
          `SELECT id, editor_admin_id FROM novel_editor_contract 
           WHERE novel_id = ? AND role = 'chief_editor' AND status = 'active' 
           LIMIT 1`,
          [novelId]
        );
        
        if (existingChief.length > 0) {
          // 如果存在且编辑不同，结束旧合同，创建新合同
          if (existingChief[0].editor_admin_id !== chief_editor_admin_id) {
            // 结束旧合同
            await db.execute(
              `UPDATE novel_editor_contract 
               SET status = 'ended', end_date = NOW() 
               WHERE id = ?`,
              [existingChief[0].id]
            );
            
            // 创建新合同
            await db.execute(
              `INSERT INTO novel_editor_contract 
               (novel_id, editor_admin_id, role, share_type, share_percent, start_date, status) 
               VALUES (?, ?, 'chief_editor', 'percent_of_book', 0.0000, NOW(), 'active')`,
              [novelId, chief_editor_admin_id]
            );
          }
          // 如果相同，不做任何操作
        } else {
          // 不存在 active 合同，直接创建
          await db.execute(
            `INSERT INTO novel_editor_contract 
             (novel_id, editor_admin_id, role, share_type, share_percent, start_date, status) 
             VALUES (?, ?, 'chief_editor', 'percent_of_book', 0.0000, NOW(), 'active')`,
            [novelId, chief_editor_admin_id]
          );
        }
      } else {
        // 如果 chief_editor_admin_id 为 null，结束所有 active 的主编合同
        await db.execute(
          `UPDATE novel_editor_contract 
           SET status = 'ended', end_date = NOW() 
           WHERE novel_id = ? AND role = 'chief_editor' AND status = 'active'`,
          [novelId]
        );
      }
      
      // 3. 处理责任编辑合同
      if (current_editor_admin_id) {
        // 查找是否存在 active 的编辑合同
        const [existingEditor] = await db.execute(
          `SELECT id, editor_admin_id FROM novel_editor_contract 
           WHERE novel_id = ? AND role = 'editor' AND status = 'active' 
           LIMIT 1`,
          [novelId]
        );
        
        if (existingEditor.length > 0) {
          // 如果存在且编辑不同，结束旧合同，创建新合同
          if (existingEditor[0].editor_admin_id !== current_editor_admin_id) {
            // 结束旧合同
            await db.execute(
              `UPDATE novel_editor_contract 
               SET status = 'ended', end_date = NOW() 
               WHERE id = ?`,
              [existingEditor[0].id]
            );
            
            // 创建新合同
            await db.execute(
              `INSERT INTO novel_editor_contract 
               (novel_id, editor_admin_id, role, share_type, share_percent, start_date, status) 
               VALUES (?, ?, 'editor', 'percent_of_book', 0.0000, NOW(), 'active')`,
              [novelId, current_editor_admin_id]
            );
          }
          // 如果相同，不做任何操作
        } else {
          // 不存在 active 合同，直接创建
          await db.execute(
            `INSERT INTO novel_editor_contract 
             (novel_id, editor_admin_id, role, share_type, share_percent, start_date, status) 
             VALUES (?, ?, 'editor', 'percent_of_book', 0.0000, NOW(), 'active')`,
            [novelId, current_editor_admin_id]
          );
        }
      } else {
        // 如果 current_editor_admin_id 为 null，结束所有 active 的编辑合同
        await db.execute(
          `UPDATE novel_editor_contract 
           SET status = 'ended', end_date = NOW() 
           WHERE novel_id = ? AND role = 'editor' AND status = 'active'`,
          [novelId]
        );
      }
      
      await db.commit();
      return { success: true };
    } catch (error) {
      await db.rollback();
      throw error;
    } finally {
      await db.end();
    }
  }

  /**
   * 分配编辑给小说（保留旧方法以兼容）
   */
  async assignEditorToNovel(novelId, currentEditorId, chiefEditorId) {
    return await this.saveEditorAssignment(novelId, {
      chief_editor_admin_id: chiefEditorId,
      current_editor_admin_id: currentEditorId
    });
  }
}

module.exports = NovelContractApprovalService;

