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
  // 新增：super_admin 直接放行
  if (role === 'super_admin') {
    return true;
  }
  
  // 先检查小说是否存在
  const [novels] = await db.execute(
    'SELECT id FROM novel WHERE id = ?',
    [novelId]
  );
  
  if (novels.length === 0) {
    return false; // 小说不存在
  }
  
  // 现在章节审核权限完全基于 novel_editor_contract，editor 和 chief_editor 必须有有效合同
  // 有效合同定义：
  // - status = 'active'
  // - start_date <= NOW()
  // - (end_date IS NULL OR end_date >= NOW())
  // - role 匹配：editor 对应 'editor'，chief_editor 对应 'chief_editor'
  let roleFilter;
  if (role === 'editor') {
    roleFilter = ['editor'];
  } else if (role === 'chief_editor') {
    roleFilter = ['chief_editor'];
  } else {
    return false; // 其他角色无权限
  }
  
  // 构建 role 过滤条件
  const roleCondition = 'nec.role = ?';
  const queryParams = [novelId, adminId, roleFilter[0]];
  
  const [contracts] = await db.execute(
    `SELECT 1 FROM novel_editor_contract nec
     WHERE nec.novel_id = ?
       AND nec.editor_admin_id = ?
       AND nec.status = 'active'
       AND nec.start_date <= NOW()
       AND (nec.end_date IS NULL OR nec.end_date >= NOW())
       AND ${roleCondition}`,
    queryParams
  );
  
  return contracts.length > 0;
}

/**
 * 检查管理员是否有指定小说的有效合同
 * @param {Object} db - 数据库连接
 * @param {number} novelId - 小说ID
 * @param {number} adminId - 管理员ID
 * @param {string} role - 角色 ('editor' 或 'chief_editor')
 * @returns {Promise<boolean>} 是否有有效合同
 */
async function hasActiveContract(db, novelId, adminId, role) {
  const [contracts] = await db.execute(
    `SELECT 1 FROM novel_editor_contract nec
     WHERE nec.novel_id = ?
       AND nec.editor_admin_id = ?
       AND nec.role = ?
       AND nec.status = 'active'
       AND nec.start_date <= NOW()
       AND (nec.end_date IS NULL OR nec.end_date >= NOW())
     LIMIT 1`,
    [novelId, adminId, role]
  );
  return contracts.length > 0;
}

/**
 * 检查小说是否需要主编终审
 * @param {Object} db - 数据库连接
 * @param {Object} novel - 小说信息（至少要有 chief_editor_admin_id）
 * @returns {Promise<boolean>} 是否需要主编终审
 */
async function checkRequiresChiefEdit(db, novel) {
  if (!novel.chief_editor_admin_id) {
    return false;
  }
  
  // 检查主编是否有有效合同
  const [contracts] = await db.execute(
    `SELECT 1 FROM novel_editor_contract nec
     WHERE nec.novel_id = ?
       AND nec.editor_admin_id = ?
       AND nec.role = 'chief_editor'
       AND nec.status = 'active'
       AND nec.start_date <= NOW()
       AND (nec.end_date IS NULL OR nec.end_date >= NOW())
     LIMIT 1`,
    [novel.id, novel.chief_editor_admin_id]
  );
  
  return contracts.length > 0;
}

/**
 * 计算章节的审核权限 (can_review)
 * 
 * 规则：
 * 1. super_admin 永远可以审核任意章节（不被"没有合同"拦住）
 * 2. editor 必须对小说有 active 编辑合同；chief_editor 必须对小说有 active 主编合同
 * 3. 在有主编流程的小说里：
 *    - review_status ∈ {submitted, reviewing, rejected}：只允许 editor / super_admin 审核
 *    - review_status = pending_chief：只允许 chief_editor / super_admin 审核
 * 
 * @param {Object} db - 数据库连接
 * @param {Object} admin - 管理员信息 { adminId, role }
 * @param {Object} chapter - 章节信息（至少要有 review_status）
 * @param {Object} novel - 小说信息（至少要有 id, chief_editor_admin_id）
 * @returns {Promise<boolean>} 是否可以审核
 */
async function computeChapterCanReview(db, admin, chapter, novel) {
  const { adminId, role: adminRole } = admin;
  
  // 1. super_admin 永远允许
  if (adminRole === 'super_admin') {
    return true;
  }
  
  // 2. 先判断有没有 active 合同（按角色分开）
  let hasContract = false;
  if (adminRole === 'editor') {
    hasContract = await hasActiveContract(db, novel.id, adminId, 'editor');
  } else if (adminRole === 'chief_editor') {
    hasContract = await hasActiveContract(db, novel.id, adminId, 'chief_editor');
  } else {
    // 其它角色暂不允许
    return false;
  }
  
  if (!hasContract) {
    return false;
  }
  
  // 3. 根据是否有主编流程 & 当前 review_status 决定
  const requiresChiefEdit = await checkRequiresChiefEdit(db, novel);
  const status = chapter.review_status;
  
  // 3. 无主编流程：只要有合同，就允许 editor / chief_editor 审
  if (!requiresChiefEdit) {
    return adminRole === 'editor' || adminRole === 'chief_editor';
  }
  
  // 4. 有主编流程：
  if (status === 'pending_chief') {
    // 等待主编终审阶段：
    // 允许：1）主编（有主编合同）；2）责任编辑本人（chapter.editor_admin_id === adminId）
    // super_admin 已经在函数开头直接 return true 了
    if (adminRole === 'chief_editor') {
      return true;
    }
    if (adminRole === 'editor' && chapter.editor_admin_id === adminId) {
      return true;
    }
    return false;
  }
  
  // 5. 其它状态（submitted/reviewing/rejected/approved/...）：
  //    - 编辑阶段 + 审核通过后，允许 editor 和 chief_editor 都进入（有没有权限最终由 canCurrentAdminOverrideEditor 再限制）
  return adminRole === 'editor' || adminRole === 'chief_editor';
}

module.exports = {
  getNovelPermissionFilter,
  checkNovelPermission,
  hasActiveContract,
  checkRequiresChiefEdit,
  computeChapterCanReview
};

