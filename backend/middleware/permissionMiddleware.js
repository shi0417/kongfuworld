/**
 * 权限检查中间件
 * 提供小说和章节的权限检查功能
 */

/**
 * 权限过滤辅助函数：根据角色生成小说查询的 WHERE 条件
 * @param {Object} db - 数据库连接
 * @param {number} adminId - 管理员ID
 * @param {string} role - 角色
 * @returns {Promise<Object>} { where: string, params: array }
 */
async function getNovelPermissionFilter(db, adminId, role) {
  // super_admin：可看所有
  if (role === 'super_admin') {
    return { where: '', params: [] };
  }
  
  // chief_editor：只能看自己负责的小说
  if (role === 'chief_editor') {
    return {
      where: 'AND n.current_editor_admin_id = ?',
      params: [adminId]
    };
  }
  
  // editor：只能看自己负责的小说
  if (role === 'editor') {
    return {
      where: 'AND n.current_editor_admin_id = ?',
      params: [adminId]
    };
  }
  
  // 其他角色：无权限
  return {
    where: 'AND 1 = 0', // 永远不匹配
    params: []
  };
}

/**
 * 检查管理员是否有权限访问指定的小说
 * @param {Object} db - 数据库连接
 * @param {number} adminId - 管理员ID
 * @param {string} role - 角色
 * @param {number} novelId - 小说ID
 * @returns {Promise<boolean>} 是否有权限
 */
async function checkNovelPermission(db, adminId, role, novelId) {
  // super_admin：有所有权限
  if (role === 'super_admin') {
    return true;
  }
  
  // 获取小说的 current_editor_admin_id
  const [novels] = await db.execute(
    'SELECT current_editor_admin_id FROM novel WHERE id = ?',
    [novelId]
  );
  
  if (novels.length === 0) {
    return false; // 小说不存在
  }
  
  const novel = novels[0];
  const novelEditorId = novel.current_editor_admin_id;
  
  if (!novelEditorId) {
    // 如果小说没有分配编辑，只有 super_admin 可以访问
    return false;
  }
  
  // chief_editor：只能看自己负责的小说
  if (role === 'chief_editor') {
    return novelEditorId === adminId;
  }
  
  // editor：只能看自己负责的小说
  if (role === 'editor') {
    return novelEditorId === adminId;
  }
  
  // 其他角色：无权限
  return false;
}

module.exports = {
  getNovelPermissionFilter,
  checkNovelPermission
};

