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
      end_date 
    } = params;
    
    const db = await this.createConnection();
    
    try {
      // 插入数据库
      const [result] = await db.execute(
        `INSERT INTO novel_editor_contract 
         (novel_id, editor_admin_id, role, share_type, share_percent, start_chapter_id, end_chapter_id, start_date, end_date, status) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')`,
        [novel_id, editor_admin_id, role, share_type, share_percent || null, start_chapter_id || null, end_chapter_id || null, start_date, end_date || null]
      );
      
      return await this.getContractById(result.insertId);
    } finally {
      await db.end();
    }
  }

  /**
   * 更新合同
   */
  async updateContract(id, updateData) {
    const db = await this.createConnection();
    
    try {
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
      }
      
      if (updates.length === 0) {
        return await this.getContractById(id);
      }
      
      params.push(id);
      await db.execute(
        `UPDATE novel_editor_contract SET ${updates.join(', ')} WHERE id = ?`,
        params
      );
      
      return await this.getContractById(id);
    } finally {
      await db.end();
    }
  }

  /**
   * 终止合同
   */
  async terminateContract(id) {
    return await this.updateContract(id, { status: 'ended' });
  }
}

module.exports = EditorContractService;

