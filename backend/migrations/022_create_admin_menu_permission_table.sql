-- 迁移022：创建后台菜单可见权限配置表
-- 执行时间：2025-12-01
-- 说明：用于按角色配置后台左侧菜单的可见权限

CREATE TABLE IF NOT EXISTS `admin_menu_permission` (
  `id` INT AUTO_INCREMENT PRIMARY KEY COMMENT '主键ID',
  `role` ENUM('super_admin', 'chief_editor', 'editor', 'finance', 'operator') NOT NULL COMMENT '角色',
  `menu_key` VARCHAR(100) NOT NULL COMMENT '菜单或分组的唯一标识，如 editor-management, payment-stats, group:income-editor',
  `allowed` TINYINT(1) NOT NULL DEFAULT 1 COMMENT '是否允许显示：1=可见，0=隐藏',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  UNIQUE KEY `uniq_role_menu` (`role`, `menu_key`),
  KEY `idx_role` (`role`),
  KEY `idx_menu_key` (`menu_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='后台左侧菜单可见权限配置表';

-- 注意：不需要为 super_admin 存储记录，逻辑上 super_admin 默认看见所有菜单

