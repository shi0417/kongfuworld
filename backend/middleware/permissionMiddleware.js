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
  // super_admin：可以看到全部小说，不受合同限制
  if (role === 'super_admin') {
    return { where: '', params: [] };
  }
  
  // editor / chief_editor：只能看到自己在 novel_editor_contract 中拥有"有效合同"的小说的章节
  // 有效合同定义：
  // - status = 'active'
  // - start_date <= NOW()
  // - (end_date IS NULL OR end_date >= NOW())
  // - role 与当前 admin.role 匹配
  if (role === 'chief_editor' || role === 'editor') {
    const contractRole = role; // editor 对应 'editor'，chief_editor 对应 'chief_editor'
    return {
      where: `AND EXISTS (
        SELECT 1 FROM novel_editor_contract nec
        WHERE nec.novel_id = n.id
          AND nec.editor_admin_id = ?
          AND nec.role = ?
          AND nec.status = 'active'
          AND nec.start_date <= NOW()
          AND (nec.end_date IS NULL OR nec.end_date >= NOW())
      )`,
      params: [adminId, contractRole]
    };
  }
  
  // 其他角色：无权限
  return {
    where: 'AND 1 = 0', // 永远不匹配
    params: []
  };
}

/**
 * 检查管理员是否有权限访问指定的小说（用于查看章节详情）
 * 现在章节审核权限完全基于 novel_editor_contract，有生效合同才允许审核；super_admin 也必须有合同，否则只能查看不能审核。
 * @param {Object} db - 数据库连接
 * @param {number} adminId - 管理员ID
 * @param {string} role - 角色
 * @param {number} novelId - 小说ID
 * @returns {Promise<boolean>} 是否有权限
 */
async function checkNovelPermission(db, adminId, role, novelId) {
  // 先检查小说是否存在
  const [novels] = await db.execute(
    'SELECT id FROM novel WHERE id = ?',
    [novelId]
  );
  
  if (novels.length === 0) {
    return false; // 小说不存在
  }
  
  // 现在章节审核权限完全基于 novel_editor_contract，所有人（包括 super_admin）都必须有有效合同
  // 有效合同定义：
  // - status = 'active'
  // - start_date <= NOW()
  // - (end_date IS NULL OR end_date >= NOW())
  // - role 匹配：editor 对应 'editor'，chief_editor 对应 'chief_editor'，super_admin 可以拥有 'editor' 或 'chief_editor' 合同
  let roleFilter;
  if (role === 'editor') {
    roleFilter = ['editor'];
  } else if (role === 'chief_editor') {
    roleFilter = ['chief_editor'];
  } else if (role === 'super_admin') {
    // super_admin 可以拥有 editor 或 chief_editor 的合同
    roleFilter = ['editor', 'chief_editor'];
  } else {
    return false; // 其他角色无权限
  }
  
  // 构建 role 过滤条件
  let roleCondition = '';
  if (roleFilter.length === 1) {
    roleCondition = 'nec.role = ?';
  } else {
    // super_admin 可以拥有 editor 或 chief_editor 合同
    roleCondition = roleFilter.map(() => 'nec.role = ?').join(' OR ');
  }
  
  const queryParams = [novelId, adminId];
  roleFilter.forEach(role => queryParams.push(role));
  
  const [contracts] = await db.execute(
    `SELECT 1 FROM novel_editor_contract nec
     WHERE nec.novel_id = ?
       AND nec.editor_admin_id = ?
       AND nec.status = 'active'
       AND nec.start_date <= NOW()
       AND (nec.end_date IS NULL OR nec.end_date >= NOW())
       AND (${roleCondition})`,
    queryParams
  );
  
  return contracts.length > 0;
}

module.exports = {
  getNovelPermissionFilter,
  checkNovelPermission
};

