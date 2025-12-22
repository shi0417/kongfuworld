import { useState } from 'react';

export function useAuthorSidebarState(initialExpandedMenus: string[] = ['workManagement']) {
  const [expandedMenus, setExpandedMenus] = useState<string[]>(initialExpandedMenus);

  // 切换菜单展开状态（与原三页逻辑保持一致）
  const toggleMenu = (menu: string) => {
    setExpandedMenus(prev =>
      prev.includes(menu)
        ? prev.filter(m => m !== menu)
        : [...prev, menu]
    );
  };

  return { expandedMenus, toggleMenu };
}


