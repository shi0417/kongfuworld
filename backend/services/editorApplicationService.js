/**
 * 编辑申请服务层
 * 处理 editor_novel_application 表的增删改查操作
 */

const mysql = require('mysql2/promise');

class EditorApplicationService {
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
   * 获取某小说的所有申请
   */
  async getApplicationsByNovelId(novelId) {
    const db = await this.createConnection();
    try {
      const [rows] = await db.execute(
        `SELECT 
          a.*,
          admin.name as editor_name,
          handler.name as handler_name
         FROM editor_novel_application a
         LEFT JOIN admin ON a.editor_admin_id = admin.id
         LEFT JOIN admin handler ON a.handled_by_admin_id = handler.id
         WHERE a.novel_id = ?
         ORDER BY a.created_at DESC`,
        [novelId]
      );
      return rows;
    } finally {
      await db.end();
    }
  }

  /**
   * 创建申请
   */
  async createApplication(novelId, editorAdminId, reason) {
    const db = await this.createConnection();
    try {
      // 检查是否已有 pending 状态的申请
      const [existing] = await db.execute(
        'SELECT id FROM editor_novel_application WHERE novel_id = ? AND editor_admin_id = ? AND status = ?',
        [novelId, editorAdminId, 'pending']
      );
      
      if (existing.length > 0) {
        throw new Error('您已提交过申请，请等待审批');
      }
      
      const [result] = await db.execute(
        'INSERT INTO editor_novel_application (novel_id, editor_admin_id, reason, status) VALUES (?, ?, ?, ?)',
        [novelId, editorAdminId, reason, 'pending']
      );
      
      return result.insertId;
    } finally {
      await db.end();
    }
  }

  /**
   * 审批申请
   */
  async handleApplication(applicationId, handlerAdminId, action, role = 'editor') {
    const db = await this.createConnection();
    
    try {
      await db.beginTransaction();
      
      // 获取申请信息
      const [applications] = await db.execute(
        'SELECT * FROM editor_novel_application WHERE id = ?',
        [applicationId]
      );
      
      if (applications.length === 0) {
        throw new Error('申请不存在');
      }
      
      const application = applications[0];
      
      if (application.status !== 'pending') {
        throw new Error('该申请已处理');
      }
      
      const newStatus = action === 'approve' ? 'approved' : 'rejected';
      
      // 更新申请状态
      await db.execute(
        'UPDATE editor_novel_application SET status = ?, handled_by_admin_id = ?, handled_at = NOW() WHERE id = ?',
        [newStatus, handlerAdminId, applicationId]
      );
      
      // 如果通过，创建合同并更新 novel 表
      if (action === 'approve') {
        // 创建合同
        await db.execute(
          `INSERT INTO novel_editor_contract 
           (novel_id, editor_admin_id, role, share_type, share_percent, start_date, status) 
           VALUES (?, ?, ?, 'percent_of_book', 0, NOW(), 'active')`,
          [application.novel_id, application.editor_admin_id, role]
        );
        
        // 如果设为责任编辑，更新 novel 表
        if (role === 'editor') {
          await db.execute(
            'UPDATE novel SET current_editor_admin_id = ? WHERE id = ?',
            [application.editor_admin_id, application.novel_id]
          );
        } else if (role === 'chief_editor') {
          // requires_chief_edit 字段已删除，改为运行时计算（基于是否有有效主编合同）
          await db.execute(
            'UPDATE novel SET chief_editor_admin_id = ? WHERE id = ?',
            [application.editor_admin_id, application.novel_id]
          );
        }
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
}

module.exports = EditorApplicationService;

