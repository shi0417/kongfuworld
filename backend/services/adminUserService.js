/**
 * 管理员用户服务层
 * 处理 admin 表的增删改查操作
 */

const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');

class AdminUserService {
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
   * 获取管理员列表（分页 + 筛选）
   */
  async getAdminList(params) {
    const { page = 1, pageSize = 20, role, status, keyword } = params;
    const db = await this.createConnection();
    
    try {
      const whereConditions = [];
      const queryParams = [];
      
      if (role) {
        whereConditions.push('role = ?');
        queryParams.push(role);
      }
      
      if (status !== undefined && status !== null && status !== '') {
        whereConditions.push('status = ?');
        queryParams.push(parseInt(status));
      }
      
      if (keyword) {
        whereConditions.push('name LIKE ?');
        const keywordPattern = `%${keyword}%`;
        queryParams.push(keywordPattern);
      }
      
      const whereClause = whereConditions.length > 0 
        ? `WHERE ${whereConditions.join(' AND ')}`
        : '';
      
      // 获取总数
      const countQuery = `SELECT COUNT(*) as total FROM admin ${whereClause}`;
      const [countResult] = await db.execute(countQuery, queryParams);
      const total = countResult[0].total;
      
      // 获取列表数据
      const pageNum = parseInt(page) || 1;
      const pageSizeNum = parseInt(pageSize) || 20;
      const offset = (pageNum - 1) * pageSizeNum;
      const limitValue = pageSizeNum;
      
      // LIMIT 和 OFFSET 需要直接插入数值，不能使用占位符（MySQL 兼容性问题）
      const listQuery = `
        SELECT id, name, role, level, status, created_at
        FROM admin 
        ${whereClause}
        ORDER BY created_at DESC
        LIMIT ${limitValue} OFFSET ${offset}
      `;
      
      const [rows] = await db.execute(listQuery, queryParams);
      
      return {
        list: rows,
        total,
        page: parseInt(page),
        pageSize: parseInt(pageSize)
      };
    } finally {
      await db.end();
    }
  }

  /**
   * 根据ID获取管理员详情
   */
  async getAdminById(id) {
    const db = await this.createConnection();
    try {
      const [rows] = await db.execute(
        'SELECT id, name, role, level, status, created_at FROM admin WHERE id = ?',
        [id]
      );
      return rows.length > 0 ? rows[0] : null;
    } finally {
      await db.end();
    }
  }

  /**
   * 创建新管理员
   */
  async createAdmin(params) {
    const { name, password, role, level = 1, status = 1 } = params;
    const db = await this.createConnection();
    
    try {
      // 检查用户名是否已存在
      const [existing] = await db.execute('SELECT id FROM admin WHERE name = ?', [name]);
      if (existing.length > 0) {
        throw new Error('用户名已存在');
      }
      
      // 哈希密码
      const hashedPassword = await bcrypt.hash(password, 10);
      
      // 插入数据库
      const [result] = await db.execute(
        'INSERT INTO admin (name, password, role, level, status) VALUES (?, ?, ?, ?, ?)',
        [name, hashedPassword, role, level, status]
      );
      
      // 返回创建的管理员信息（不含密码）
      return await this.getAdminById(result.insertId);
    } finally {
      await db.end();
    }
  }

  /**
   * 更新管理员信息
   */
  async updateAdmin(id, updateData) {
    const { password, role, level, status } = updateData;
    const db = await this.createConnection();
    
    try {
      const updates = [];
      const params = [];
      
      if (password && password.trim() !== '') {
        const hashedPassword = await bcrypt.hash(password, 10);
        updates.push('password = ?');
        params.push(hashedPassword);
      }
      
      if (role !== undefined) {
        updates.push('role = ?');
        params.push(role);
      }
      
      if (level !== undefined) {
        updates.push('level = ?');
        params.push(level);
      }
      
      if (status !== undefined) {
        updates.push('status = ?');
        params.push(status);
      }
      
      if (updates.length === 0) {
        return await this.getAdminById(id);
      }
      
      params.push(id);
      await db.execute(
        `UPDATE admin SET ${updates.join(', ')} WHERE id = ?`,
        params
      );
      
      return await this.getAdminById(id);
    } finally {
      await db.end();
    }
  }

  /**
   * 更新管理员状态（启用/禁用）
   */
  async updateAdminStatus(id, status) {
    return await this.updateAdmin(id, { status });
  }
}

module.exports = AdminUserService;
