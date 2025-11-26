/**
 * 管理员用户控制器
 * 处理管理员账号管理的HTTP请求
 */

const AdminUserService = require('../services/adminUserService');

class AdminUserController {
  constructor(dbConfig) {
    this.service = new AdminUserService(dbConfig);
  }

  /**
   * 获取管理员列表
   * GET /api/admin-users
   */
  async getAdminList(req, res) {
    try {
      const { page, pageSize, role, status, keyword } = req.query;
      
      const result = await this.service.getAdminList({
        page: parseInt(page) || 1,
        pageSize: parseInt(pageSize) || 20,
        role,
        status,
        keyword
      });
      
      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      console.error('获取管理员列表失败:', error);
      res.status(500).json({
        success: false,
        message: '获取管理员列表失败',
        error: error.message
      });
    }
  }

  /**
   * 获取单个管理员详情
   * GET /api/admin-users/:id
   */
  async getAdminById(req, res) {
    try {
      const { id } = req.params;
      const admin = await this.service.getAdminById(parseInt(id));
      
      if (!admin) {
        return res.status(404).json({
          success: false,
          message: '管理员不存在'
        });
      }
      
      res.json({
        success: true,
        data: admin
      });
    } catch (error) {
      console.error('获取管理员详情失败:', error);
      res.status(500).json({
        success: false,
        message: '获取管理员详情失败',
        error: error.message
      });
    }
  }

  /**
   * 创建新管理员
   * POST /api/admin-users
   */
  async createAdmin(req, res) {
    try {
      const { name, password, role, level, status } = req.body;
      
      // 参数验证
      if (!name || !password || !role) {
        return res.status(400).json({
          success: false,
          message: '用户名、密码和角色为必填项'
        });
      }
      
      // 角色验证
      const validRoles = ['super_admin', 'chief_editor', 'editor', 'finance', 'operator'];
      if (!validRoles.includes(role)) {
        return res.status(400).json({
          success: false,
          message: '角色无效'
        });
      }
      
      const admin = await this.service.createAdmin({
        name,
        password,
        role,
        level: level || 1,
        status: status !== undefined ? status : 1
      });
      
      res.json({
        success: true,
        message: '创建成功',
        data: admin
      });
    } catch (error) {
      if (error.message === '用户名已存在') {
        return res.status(400).json({
          success: false,
          message: '用户名已存在'
        });
      }
      
      console.error('创建管理员失败:', error);
      res.status(500).json({
        success: false,
        message: '创建管理员失败',
        error: error.message
      });
    }
  }

  /**
   * 更新管理员
   * PUT /api/admin-users/:id
   */
  async updateAdmin(req, res) {
    try {
      const { id } = req.params;
      const { password, role, level, status } = req.body;
      
      // 角色验证
      if (role) {
        const validRoles = ['super_admin', 'chief_editor', 'editor', 'finance', 'operator'];
        if (!validRoles.includes(role)) {
          return res.status(400).json({
            success: false,
            message: '角色无效'
          });
        }
      }
      
      const admin = await this.service.updateAdmin(parseInt(id), {
        password,
        role,
        level,
        status
      });
      
      res.json({
        success: true,
        message: '更新成功',
        data: admin
      });
    } catch (error) {
      console.error('更新管理员失败:', error);
      res.status(500).json({
        success: false,
        message: '更新管理员失败',
        error: error.message
      });
    }
  }

  /**
   * 更新管理员状态
   * PATCH /api/admin-users/:id/status
   */
  async updateAdminStatus(req, res) {
    try {
      const { id } = req.params;
      const { status } = req.body;
      
      if (status !== 0 && status !== 1) {
        return res.status(400).json({
          success: false,
          message: '状态值无效，必须为 0 或 1'
        });
      }
      
      await this.service.updateAdminStatus(parseInt(id), status);
      
      res.json({
        success: true,
        message: '状态更新成功'
      });
    } catch (error) {
      console.error('更新管理员状态失败:', error);
      res.status(500).json({
        success: false,
        message: '更新管理员状态失败',
        error: error.message
      });
    }
  }
}

module.exports = AdminUserController;

