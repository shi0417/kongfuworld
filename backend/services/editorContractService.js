/**
 * 编辑合同服务层
 * 处理 novel_editor_contract 表的增删改查操作
 */

const mysql = require('mysql2/promise');

class EditorContractService {
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
   * 获取合同列表（分页 + 筛选 + 排序）
   */
  async getContractList(params) {
    const { 
      page = 1, 
      pageSize = 20, 
      novelKeyword, 
      editorKeyword, 
      role, 
      status, 
      shareType,
      startDateFrom,
      startDateTo,
      sortField = 'created_at',
      sortOrder = 'DESC'
    } = params;
    
    const db = await this.createConnection();
    
    try {
      const whereConditions = [];
      const queryParams = [];
      
      // 小说搜索（标题或ID）
      if (novelKeyword) {
        whereConditions.push('(n.title LIKE ? OR c.novel_id = ?)');
        const keywordPattern = `%${novelKeyword}%`;
        queryParams.push(keywordPattern, novelKeyword);
      }
      
      // 编辑搜索（用户名）
      if (editorKeyword) {
        whereConditions.push('a.name LIKE ?');
        const keywordPattern = `%${editorKeyword}%`;
        queryParams.push(keywordPattern);
      }
      
      // 角色筛选
      if (role) {
        whereConditions.push('c.role = ?');
        queryParams.push(role);
      }
      
      // 状态筛选
      if (status) {
        whereConditions.push('c.status = ?');
        queryParams.push(status);
      }
      
      // 分成类型筛选
      if (shareType) {
        whereConditions.push('c.share_type = ?');
        queryParams.push(shareType);
      }
      
      // 时间范围筛选
      if (startDateFrom) {
        whereConditions.push('c.start_date >= ?');
        queryParams.push(startDateFrom);
      }
      if (startDateTo) {
        whereConditions.push('c.start_date <= ?');
        queryParams.push(startDateTo);
      }
      
      const whereClause = whereConditions.length > 0 
        ? `WHERE ${whereConditions.join(' AND ')}`
        : '';
      
      // 验证排序字段（防止SQL注入）
      const allowedSortFields = ['created_at', 'start_date', 'share_percent', 'status'];
      const safeSortField = allowedSortFields.includes(sortField) ? sortField : 'created_at';
      const safeSortOrder = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
      
      // 获取总数
      const countQuery = `
        SELECT COUNT(*) as total 
        FROM novel_editor_contract c
        LEFT JOIN novel n ON c.novel_id = n.id
        LEFT JOIN admin a ON c.editor_admin_id = a.id
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
          c.id,
          c.novel_id,
          n.title as novel_title,
          c.editor_admin_id,
          a.name as editor_name,
          c.role,
          c.share_type,
          c.share_percent,
          c.start_chapter_id,
          c.end_chapter_id,
          c.start_date,
          c.end_date,
          c.status,
          c.created_at,
          c.updated_at
        FROM novel_editor_contract c
        LEFT JOIN novel n ON c.novel_id = n.id
        LEFT JOIN admin a ON c.editor_admin_id = a.id
        ${whereClause}
        ORDER BY c.${safeSortField} ${safeSortOrder}
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
   * 根据ID获取合同详情
   */
  async getContractById(id) {
    const db = await this.createConnection();
    try {
      const [rows] = await db.execute(
        `SELECT 
          c.*,
          n.title as novel_title,
          a.name as editor_name
         FROM novel_editor_contract c
         LEFT JOIN novel n ON c.novel_id = n.id
         LEFT JOIN admin a ON c.editor_admin_id = a.id
         WHERE c.id = ?`,
        [id]
      );
      return rows.length > 0 ? rows[0] : null;
    } finally {
      await db.end();
    }
  }

  /**
   * 创建新合同
   * 添加行级锁和冲突检查，确保同一本小说 novel_id + 同一个 role 角色，同一时间只能有一个 status='active' 的合同
   */
  async createContract(params) {
    const { 
      novel_id, 
      editor_admin_id, 
      role, 
      share_type, 
      share_percent, 
      start_chapter_id, 
      end_chapter_id, 
      start_date, 
      end_date,
      status = 'active'
    } = params;
    
    const db = await this.createConnection();
    
    try {
      await db.beginTransaction();
      
      // 如果状态为 active，使用行级锁检查是否已存在 active 合同
      if (status === 'active') {
        // 使用 SELECT ... FOR UPDATE 锁定相关行，防止并发冲突
        const [existing] = await db.execute(
          `SELECT id FROM novel_editor_contract 
           WHERE novel_id = ? AND role = ? AND status = 'active' 
           FOR UPDATE`,
          [novel_id, role]
        );
        
        if (existing.length > 0) {
          await db.rollback();
          throw new Error(`当前已有有效的${role === 'chief_editor' ? '主编' : role === 'editor' ? '编辑' : '校对'}合同，请先结束旧合同`);
        }
      }
      
      // 插入数据库
      const [result] = await db.execute(
        `INSERT INTO novel_editor_contract 
         (novel_id, editor_admin_id, role, share_type, share_percent, start_chapter_id, end_chapter_id, start_date, end_date, status) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [novel_id, editor_admin_id, role, share_type, share_percent || null, start_chapter_id || null, end_chapter_id || null, start_date, end_date || null, status]
      );
      
      await db.commit();
      return await this.getContractById(result.insertId);
    } catch (error) {
      await db.rollback();
      throw error;
    } finally {
      await db.end();
    }
  }

  /**
   * 更新合同
   * 添加行级锁和冲突检查，确保同一本小说 novel_id + 同一个 role 角色，同一时间只能有一个 status='active' 的合同
   */
  async updateContract(id, updateData) {
    const db = await this.createConnection();
    
    try {
      await db.beginTransaction();
      
      // 先获取当前合同信息，使用行级锁
      const [currentContract] = await db.execute(
        'SELECT novel_id, role, status FROM novel_editor_contract WHERE id = ? FOR UPDATE',
        [id]
      );
      
      if (currentContract.length === 0) {
        await db.rollback();
        throw new Error('合同不存在');
      }
      
      const oldContract = currentContract[0];
      const newNovelId = updateData.novel_id !== undefined ? updateData.novel_id : oldContract.novel_id;
      const newRole = updateData.role !== undefined ? updateData.role : oldContract.role;
      const newStatus = updateData.status !== undefined ? updateData.status : oldContract.status;
      
      // 如果状态为 active，或更新了 novel_id/role 且状态为 active，检查冲突
      if (newStatus === 'active') {
        // 检查是否修改了 novel_id 或 role
        const novelIdChanged = updateData.novel_id !== undefined && updateData.novel_id !== oldContract.novel_id;
        const roleChanged = updateData.role !== undefined && updateData.role !== oldContract.role;
        
        // 如果修改了 novel_id 或 role，或状态从非 active 变为 active，需要检查冲突
        if (novelIdChanged || roleChanged || oldContract.status !== 'active') {
          // 使用行级锁检查是否已存在 active 合同
          const [existing] = await db.execute(
            `SELECT id FROM novel_editor_contract 
             WHERE novel_id = ? AND role = ? AND status = 'active' AND id != ?
             FOR UPDATE`,
            [newNovelId, newRole, id]
          );
          
          if (existing.length > 0) {
            await db.rollback();
            throw new Error(`当前已有有效的${newRole === 'chief_editor' ? '主编' : newRole === 'editor' ? '编辑' : '校对'}合同，请先结束旧合同`);
          }
        }
      }
      
      // 如果当前合同是 active 状态，禁止修改 novel_id 和 role
      if (oldContract.status === 'active') {
        if (updateData.novel_id !== undefined && updateData.novel_id !== oldContract.novel_id) {
          await db.rollback();
          throw new Error('活跃合同不允许修改小说ID，请先结束合同');
        }
        if (updateData.role !== undefined && updateData.role !== oldContract.role) {
          await db.rollback();
          throw new Error('活跃合同不允许修改角色，请先结束合同');
        }
      }
      
      const updates = [];
      const params = [];
      
      if (updateData.role !== undefined) {
        updates.push('role = ?');
        params.push(updateData.role);
      }
      if (updateData.share_type !== undefined) {
        updates.push('share_type = ?');
        params.push(updateData.share_type);
      }
      if (updateData.share_percent !== undefined) {
        updates.push('share_percent = ?');
        params.push(updateData.share_percent);
      }
      if (updateData.start_chapter_id !== undefined) {
        updates.push('start_chapter_id = ?');
        params.push(updateData.start_chapter_id);
      }
      if (updateData.end_chapter_id !== undefined) {
        updates.push('end_chapter_id = ?');
        params.push(updateData.end_chapter_id);
      }
      if (updateData.start_date !== undefined) {
        updates.push('start_date = ?');
        params.push(updateData.start_date);
      }
      if (updateData.end_date !== undefined) {
        updates.push('end_date = ?');
        params.push(updateData.end_date);
      }
      if (updateData.status !== undefined) {
        updates.push('status = ?');
        params.push(updateData.status);
        // 如果状态变为 ended 或 cancelled，自动设置 end_date
        if ((updateData.status === 'ended' || updateData.status === 'cancelled') && updateData.end_date === undefined) {
          updates.push('end_date = NOW()');
        }
      }
      
      if (updates.length === 0) {
        await db.commit();
        return await this.getContractById(id);
      }
      
      params.push(id);
      await db.execute(
        `UPDATE novel_editor_contract SET ${updates.join(', ')} WHERE id = ?`,
        params
      );
      
      await db.commit();
      return await this.getContractById(id);
    } catch (error) {
      await db.rollback();
      throw error;
    } finally {
      await db.end();
    }
  }

  /**
   * 终止合同
   * 终止合同时同步更新 novel 表中对应字段：
   * - 如果终止的是某本小说的唯一活跃"编辑合同"，清空 novel.current_editor_admin_id
   * - 如果终止的是某本小说的唯一活跃"主编合同"，清空 novel.chief_editor_admin_id
   */
  async terminateContract(id) {
    const db = await this.createConnection();
    try {
      await db.beginTransaction();

      // 1. 先查出该合同的关键信息（novel_id, role, 状态等），使用行级锁
      const [rows] = await db.execute(
        'SELECT novel_id, editor_admin_id, role, status FROM novel_editor_contract WHERE id = ? FOR UPDATE',
        [id]
      );

      if (!rows.length) {
        await db.rollback();
        throw new Error('合同不存在');
      }

      const contract = rows[0];

      // 如果已经是 ended/cancelled，可以直接返回（幂等处理）
      if (contract.status === 'ended' || contract.status === 'cancelled') {
        await db.commit();
        return await this.getContractById(id);
      }

      // 2. 更新当前合同为 ended，设置 end_date = NOW()
      await db.execute(
        'UPDATE novel_editor_contract SET status = ?, end_date = NOW() WHERE id = ?',
        ['ended', id]
      );

      // 3. 检查同一小说 + 同一角色是否还有其他 active 合同
      const [activeSameRole] = await db.execute(
        'SELECT id FROM novel_editor_contract WHERE novel_id = ? AND role = ? AND status = "active" LIMIT 1',
        [contract.novel_id, contract.role]
      );

      // 4. 如果没有其他同角色的 active 合同，则同步清空 novel 对应字段
      if (activeSameRole.length === 0) {
        if (contract.role === 'editor') {
          await db.execute(
            'UPDATE novel SET current_editor_admin_id = NULL WHERE id = ?',
            [contract.novel_id]
          );
        } else if (contract.role === 'chief_editor') {
          await db.execute(
            'UPDATE novel SET chief_editor_admin_id = NULL WHERE id = ?',
            [contract.novel_id]
          );
        }
        // role = 'proofreader' 目前 novel 表没有对应字段，可忽略
      }

      await db.commit();
      return await this.getContractById(id);
    } catch (error) {
      await db.rollback();
      throw error;
    } finally {
      await db.end();
    }
  }
}

module.exports = EditorContractService;

