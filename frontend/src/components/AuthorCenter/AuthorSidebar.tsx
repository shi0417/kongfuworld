import React from 'react';
import type { SidebarItem } from './authorSidebarConfig';
import { authorSidebarConfig } from './authorSidebarConfig';

type CssModule = Record<string, string>;

export type AuthorSidebarProps = {
  t: (key: string) => string;
  navigate: (to: string) => void;
  styles: CssModule;
  activeKey: string;
  expandedMenus: string[];
  onToggleMenu: (menuKey: string) => void;
  showDisabled?: boolean;
};

function isVisibleItem(item: SidebarItem, showDisabled: boolean) {
  return showDisabled ? true : !item.disabled;
}

export const AuthorSidebar: React.FC<AuthorSidebarProps> = ({
  t,
  navigate,
  styles,
  activeKey,
  expandedMenus,
  onToggleMenu,
  showDisabled = true,
}) => {
  const disabledClassName = (styles as any).disabled as string | undefined;

  const getDisabledProps = (disabled: boolean) => {
    if (!disabled) return {};
    // Prefer CSS-module class if exists; otherwise enforce via inline styles.
    return {
      className: disabledClassName,
      style: disabledClassName
        ? undefined
        : ({
            opacity: 0.5,
            cursor: 'not-allowed',
          } as React.CSSProperties),
    };
  };

  const renderChild = (child: SidebarItem) => {
    if (!isVisibleItem(child, showDisabled)) return null;
    const isActive = activeKey === child.key;
    const disabled = !!child.disabled;
    const disabledProps = getDisabledProps(disabled);

    const className = `${styles.subNavItem} ${isActive ? styles.active : ''} ${
      disabledProps.className ? disabledProps.className : ''
    }`.trim();

    return (
      <div
        key={child.key}
        className={className}
        style={disabledProps.style}
        title={disabled ? '即将开放' : undefined}
        onClick={
          disabled || !child.to
            ? undefined
            : () => {
                navigate(child.to!);
              }
        }
      >
        {t(child.labelKey)}
      </div>
    );
  };

  const renderItem = (item: SidebarItem) => {
    if (!isVisibleItem(item, showDisabled)) return null;

    const isActive = activeKey === item.key;
    const isExpanded = expandedMenus.includes(item.key);
    const disabled = !!item.disabled;

    const disabledProps = getDisabledProps(disabled);
    const className = `${styles.navItem} ${isActive ? styles.active : ''} ${
      disabledProps.className ? disabledProps.className : ''
    }`.trim();

    const onClick = disabled
      ? undefined
      : item.expandable
        ? () => onToggleMenu(item.key)
        : item.to
          ? () => navigate(item.to!)
          : undefined;

    return (
      <React.Fragment key={item.key}>
        <div className={className} style={disabledProps.style} onClick={onClick} title={disabled ? '即将开放' : undefined}>
          {item.icon ? <span className={styles.navIcon}>{item.icon}</span> : null}
          {t(item.labelKey)}
          {item.expandable ? (
            <span className={styles.expandIcon}>{isExpanded ? '▼' : '▶'}</span>
          ) : null}
        </div>

        {item.expandable && item.children && isExpanded ? (
          <div className={styles.subNav}>{item.children.map(renderChild)}</div>
        ) : null}
      </React.Fragment>
    );
  };

  const homeItem = authorSidebarConfig.find(i => i.key === 'home');
  const sectionItems = authorSidebarConfig.filter(i => i.key !== 'home');

  return (
    <aside className={styles.sidebar}>
      <nav className={styles.nav}>
        {homeItem ? renderItem(homeItem) : null}
        <div className={styles.navSection}>{sectionItems.map(renderItem)}</div>
      </nav>
    </aside>
  );
};


