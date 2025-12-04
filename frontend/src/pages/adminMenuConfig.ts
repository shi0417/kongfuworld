/**
 * 后台菜单配置
 * 定义后台左侧菜单的结构和标识，用于权限管理
 */

export type AdminMenuItemKey =
  | 'payment-stats'
  | 'author-income'
  | 'reader-income'
  | 'settlement-overview'
  | 'base-income'
  | 'author-royalty'
  | 'commission-transaction'
  | 'editor-base-income'
  | 'commission-settings'
  | 'editor-management'
  // 新增 —— 顶部和底部的独立菜单
  | 'novel-review'
  | 'new-novel-pool'
  | 'chapter-approval'
  | 'admin-payout-account';

export type AdminMenuGroupKey =
  | 'group:income-editor';

export interface AdminMenuItem {
  key: AdminMenuItemKey;
  label: string;
  icon: string; // emoji
  tab: string;  // 对应 AdminPanel 中的 activeTab 值
}

export interface AdminMenuGroup {
  groupKey: AdminMenuGroupKey;
  groupLabel: string;
  icon: string;
  items: AdminMenuItem[];
}

/**
 * 目前只先把"收益与编辑管理"这组抽象出来
 * 其他分组可后续扩展
 */
export const incomeEditorMenuGroup: AdminMenuGroup = {
  groupKey: 'group:income-editor',
  groupLabel: '收益与编辑管理',
  icon: '💼',
  items: [
    { key: 'payment-stats', label: '费用统计', icon: '💰', tab: 'payment-stats' },
    { key: 'author-income', label: '作者收入统计', icon: '✍️', tab: 'author-income' },
    { key: 'reader-income', label: '读者收入统计', icon: '👥', tab: 'reader-income' },
    { key: 'settlement-overview', label: '结算总览', icon: '💳', tab: 'settlement-overview' },
    { key: 'base-income', label: '基础收入统计-1', icon: '📊', tab: 'base-income' },
    { key: 'author-royalty', label: '作者基础收入表-2', icon: '💵', tab: 'author-royalty' },
    { key: 'commission-transaction', label: '推广佣金明细-3', icon: '💰', tab: 'commission-transaction' },
    { key: 'editor-base-income', label: '编辑基础收入-4', icon: '📝', tab: 'editor-base-income' },
    { key: 'commission-settings', label: '提成设置', icon: '⚙️', tab: 'commission-settings' },
    { key: 'editor-management', label: '编辑管理', icon: '👥', tab: 'editor-management' }
  ]
};

// 顶部独立菜单配置（小说审批、新小说池、章节审批）
export const topStandaloneMenus: AdminMenuItem[] = [
  { key: 'novel-review', label: '小说审批', icon: '📚', tab: 'novel-review' },
  { key: 'new-novel-pool', label: '新小说池', icon: '📖', tab: 'new-novel-pool' },
  { key: 'chapter-approval', label: '章节审批', icon: '✅', tab: 'chapter-approval' }
];

// 底部独立菜单配置（我的收款账户）
export const bottomStandaloneMenus: AdminMenuItem[] = [
  { key: 'admin-payout-account', label: '我的收款账户', icon: '💳', tab: 'admin-payout-account' }
];

export const ALL_MENU_KEYS: string[] = [
  'group:income-editor',
  ...incomeEditorMenuGroup.items.map(i => i.key),
  ...topStandaloneMenus.map(i => i.key),
  ...bottomStandaloneMenus.map(i => i.key),
];

