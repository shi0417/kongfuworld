const mysql = require('mysql2/promise');

/**
 * 后台菜单权限管理服务
 * 用于管理不同角色对后台左侧菜单的可见权限
 */
class AdminMenuPermissionService {
  constructor(dbConfig) {
    this.dbConfig = dbConfig;
  }

  /**
   * 获取某个角色的菜单权限 map：{ [menuKey]: boolean }
   * @param {Object} db - 数据库连接对象
   * @param {string} role - 角色名称
   * @returns {Promise<Object>} 权限映射对象，如 { 'editor-management': true, 'payment-stats': false }
   */
  async getRoleMenuPermissions(db, role) {
    try {
      const [rows] = await db.execute(
        'SELECT menu_key, allowed FROM admin_menu_permission WHERE role = ?',
        [role]
      );

      const permissions = {};
      rows.forEach(row => {
        permissions[row.menu_key] = row.allowed === 1;
      });

      return permissions;
    } catch (error) {
      console.error('[AdminMenuPermissionService] 获取角色菜单权限失败:', error);
      throw error;
    }
  }

  /**
   * 批量保存某个角色的菜单权限配置（全量覆盖）
   * - 先删除该 role 的所有记录
   * - 再批量插入新的 (role, menu_key, allowed)
   * @param {Object} db - 数据库连接对象
   * @param {string} role - 角色名称
   * @param {Object} permissionsMap - 权限映射对象，如 { 'editor-management': true, 'payment-stats': false }
   * @returns {Promise<void>}
   */
  async saveRoleMenuPermissions(db, role, permissionsMap) {
    try {
      // 开启事务
      await db.beginTransaction();

      // 1. 删除该角色的所有现有记录
      await db.execute(
        'DELETE FROM admin_menu_permission WHERE role = ?',
        [role]
      );

      // 2. 批量插入新记录
      const menuKeys = Object.keys(permissionsMap);
      if (menuKeys.length > 0) {
        const values = menuKeys.map(menuKey => [
          role,
          menuKey,
          permissionsMap[menuKey] ? 1 : 0
        ]);

        const placeholders = values.map(() => '(?, ?, ?)').join(', ');
        const flatValues = values.flat();

        await db.execute(
          `INSERT INTO admin_menu_permission (role, menu_key, allowed) VALUES ${placeholders}`,
          flatValues
        );
      }

      // 提交事务
      await db.commit();
    } catch (error) {
      // 回滚事务
      await db.rollback();
      console.error('[AdminMenuPermissionService] 保存角色菜单权限失败:', error);
      throw error;
    }
  }

  /**
   * 计算某个管理员实际可见的菜单 key 列表
   * - super_admin：返回 allMenuKeys（全部可见）
   * - 其他角色：以 defaultAllow=true 为基础，叠加数据库中的 allowed=0/1
   * @param {Object} db - 数据库连接对象
   * @param {string} adminRole - 管理员角色
   * @param {string[]} allMenuKeys - 所有菜单 key 列表
   * @returns {Promise<string[]>} 允许访问的菜单 key 列表
   */
  async getAdminAllowedMenuKeys(db, adminRole, allMenuKeys) {
    try {
      // super_admin 拥有所有权限
      if (adminRole === 'super_admin') {
        return allMenuKeys;
      }

      // 其他角色：默认全部允许，然后用数据库中的记录覆盖
      const allowedMap = {};
      allMenuKeys.forEach(key => {
        allowedMap[key] = true; // 默认全部可见
      });

      // 从数据库获取该角色的权限配置
      const rolePermissions = await this.getRoleMenuPermissions(db, adminRole);

      // 用数据库中的配置覆盖默认值
      Object.keys(rolePermissions).forEach(menuKey => {
        allowedMap[menuKey] = rolePermissions[menuKey];
      });

      // 返回 allowed 为 true 的菜单 key 列表
      return allMenuKeys.filter(key => allowedMap[key] === true);
    } catch (error) {
      console.error('[AdminMenuPermissionService] 计算管理员可见菜单失败:', error);
      // 出错时返回全部菜单（降级策略）
      return allMenuKeys;
    }
  }
}

module.exports = AdminMenuPermissionService;

